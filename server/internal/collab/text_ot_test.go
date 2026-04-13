package collab

import "testing"

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
