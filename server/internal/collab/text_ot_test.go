package collab

import (
	"strings"
	"testing"
)

func TestApplyTextPatch(t *testing.T) {
	updated, err := applyTextPatch("hello world", &Patch{
		Kind:       PatchKindText,
		Field:      FieldTitle,
		Start:      6,
		DeleteText: "world",
		InsertText: "team",
	})
	if err != nil {
		t.Fatalf("applyTextPatch returned error: %v", err)
	}
	if updated != "hello team" {
		t.Fatalf("unexpected text patch result: %q", updated)
	}
}

func TestTransformHTMLPatchAllowsDifferentBlocks(t *testing.T) {
	incoming, err := transformHTMLPatch(&Patch{
		ID:           "b",
		Kind:         PatchKindHTML,
		Field:        FieldContent,
		BlockIndex:   1,
		BeforeBlocks: []string{"<p>b</p>"},
		AfterBlocks:  []string{"<p>beta</p>"},
	}, &AppliedPatch{
		Patch: Patch{
			ID:           "a",
			Kind:         PatchKindHTML,
			Field:        FieldContent,
			BlockIndex:   0,
			BeforeBlocks: []string{"<p>a</p>"},
			AfterBlocks:  []string{"<p>alpha</p>"},
		},
	})
	if err != nil {
		t.Fatalf("transformHTMLPatch returned error: %v", err)
	}
	if incoming.BlockIndex != 1 {
		t.Fatalf("expected block index to stay 1, got %d", incoming.BlockIndex)
	}
}

func TestApplyHTMLPatchReplacesBlockRange(t *testing.T) {
	updated, err := applyHTMLPatch("<p>one</p><p>two</p>", &Patch{
		Kind:         PatchKindHTML,
		Field:        FieldContent,
		BlockIndex:   1,
		BeforeBlocks: []string{"<p>two</p>"},
		AfterBlocks:  []string{"<p>second</p>"},
	})
	if err != nil {
		t.Fatalf("applyHTMLPatch returned error: %v", err)
	}
	if updated != "<p>one</p><p>second</p>" {
		t.Fatalf("unexpected HTML patch result: %q", updated)
	}
}

func TestTransformHTMLPatchRebasesSameBlockText(t *testing.T) {
	startA := 3
	startB := 9
	transformed, err := transformHTMLPatch(&Patch{
		ID:             "b",
		Kind:           PatchKindHTML,
		Field:          FieldContent,
		BlockIndex:     0,
		BeforeBlocks:   []string{"<p>hello world</p>"},
		AfterBlocks:    []string{"<p>hello brave world</p>"},
		HTMLStart:      &startB,
		HTMLDeleteText: "",
		HTMLInsertText: "brave ",
	}, &AppliedPatch{
		Patch: Patch{
			ID:             "a",
			Kind:           PatchKindHTML,
			Field:          FieldContent,
			BlockIndex:     0,
			BeforeBlocks:   []string{"<p>hello world</p>"},
			AfterBlocks:    []string{"<p>hey hello world</p>"},
			HTMLStart:      &startA,
			HTMLDeleteText: "",
			HTMLInsertText: "hey ",
		},
	})
	if err != nil {
		t.Fatalf("transformHTMLPatch returned error: %v", err)
	}
	if transformed.BeforeBlocks[0] != "<p>hey hello world</p>" {
		t.Fatalf("unexpected transformed before block: %q", transformed.BeforeBlocks[0])
	}
	if transformed.AfterBlocks[0] != "<p>hey hello brave world</p>" {
		t.Fatalf("unexpected transformed after block: %q", transformed.AfterBlocks[0])
	}
}

// Client (JavaScript) serializes void elements as <br> and <img>, but Go's html.Render
// outputs <br/> and <img .../>. Patches from the client use browser-serialized blocks,
// while the server normalizes to Go's form. This test verifies applyHTMLPatch tolerates
// the difference so inserting images or editing empty paragraphs doesn't cause conflicts.
func TestApplyHTMLPatch_ToleratesVoidElementSerializationDifference(t *testing.T) {
	// Server has <p><br/></p> (Go-normalized), client sends <br> form in beforeBlocks.
	updated, err := applyHTMLPatch("<p><br/></p>", &Patch{
		Kind:         PatchKindHTML,
		Field:        FieldContent,
		BlockIndex:   0,
		BeforeBlocks: []string{"<p><br></p>"},
		AfterBlocks:  []string{"<img src=\"/media/diagrams/test.svg\" alt=\"\" style=\"max-width: 100%;\">", "<p><br></p>"},
	})
	if err != nil {
		t.Fatalf("applyHTMLPatch returned error: %v", err)
	}
	if updated == "" {
		t.Fatal("expected non-empty result")
	}
}

// JavaScript string offsets are UTF-16 code units. For BMP Unicode characters
// (e.g. CJK) one JS char == one Go rune, but byte length differs. Without
// rune-based indexing the server splits strings in the middle of multi-byte
// characters, causing spurious ErrPatchConflict errors.
func TestApplyTextPatch_Unicode(t *testing.T) {
	// Insert "X" after "好" (position 2 in "你好嗎") – offsets as JS would send.
	updated, err := applyTextPatch("你好嗎！", &Patch{
		Kind:       PatchKindText,
		Field:      FieldTitle,
		Start:      2,
		DeleteText: "",
		InsertText: "X",
	})
	if err != nil {
		t.Fatalf("applyTextPatch returned error for Unicode input: %v", err)
	}
	if updated != "你好X嗎！" {
		t.Fatalf("unexpected result: %q (want %q)", updated, "你好X嗎！")
	}
}

func TestApplyTextPatch_UnicodeDeletion(t *testing.T) {
	// Delete "好" at rune position 1.
	updated, err := applyTextPatch("你好嗎！", &Patch{
		Kind:       PatchKindText,
		Field:      FieldTitle,
		Start:      1,
		DeleteText: "好",
		InsertText: "",
	})
	if err != nil {
		t.Fatalf("applyTextPatch returned error for Unicode deletion: %v", err)
	}
	if updated != "你嗎！" {
		t.Fatalf("unexpected result: %q (want %q)", updated, "你嗎！")
	}
}

func TestApplyHTMLPatch_InlineUnicode(t *testing.T) {
	// Inline HTML patch: insert "X" at rune offset 67+2=69 (after "你好") inside the block.
	// The span prefix "<p class=\"editor-paragraph\"><span style=\"white-space: pre-wrap;\">"
	// is 67 ASCII chars; "你"=rune 67, "好"=rune 68; insertion point = 69.
	prefix := `<p class="editor-paragraph"><span style="white-space: pre-wrap;">`
	beforeBlock := prefix + `你好嗎！</span></p>`
	afterBlock := prefix + `你好X嗎！</span></p>`
	start := len([]rune(prefix)) + 2 // rune offset after "你好"

	updated, err := applyHTMLPatch(beforeBlock, &Patch{
		Kind:           PatchKindHTML,
		Field:          FieldContent,
		BlockIndex:     0,
		BeforeBlocks:   []string{beforeBlock},
		AfterBlocks:    []string{afterBlock},
		HTMLStart:      &start,
		HTMLDeleteText: "",
		HTMLInsertText: "X",
	})
	if err != nil {
		t.Fatalf("applyHTMLPatch returned error for inline Unicode patch: %v", err)
	}

	// The result after Go normalization should contain X between 好 and 嗎.
	if !strings.Contains(updated, "你好X嗎！") {
		t.Fatalf("expected Chinese text with inserted X, got: %q", updated)
	}
}
