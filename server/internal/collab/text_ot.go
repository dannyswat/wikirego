package collab

import (
	"bytes"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

var ErrPatchConflict = errors.New("collaboration patch conflict")

func applyTextPatch(current string, patch *Patch) (string, error) {
	if patch.Start < 0 || patch.Start > len(current) {
		return "", fmt.Errorf("invalid patch start")
	}
	end := patch.Start + len(patch.DeleteText)
	if end > len(current) {
		return "", fmt.Errorf("invalid patch range")
	}
	if current[patch.Start:end] != patch.DeleteText {
		return "", ErrPatchConflict
	}
	return current[:patch.Start] + patch.InsertText + current[end:], nil
}

func transformTextPatch(incoming *Patch, applied *AppliedPatch) (*Patch, error) {
	patch := clonePatch(incoming)
	if patch == nil || applied == nil || patch.Field != applied.Field || patch.Kind != PatchKindText || applied.Kind != PatchKindText {
		return patch, nil
	}

	appliedStart := applied.Start
	appliedEnd := applied.Start + len(applied.DeleteText)
	incomingEnd := patch.Start + len(patch.DeleteText)
	delta := len(applied.InsertText) - len(applied.DeleteText)

	if len(applied.DeleteText) == 0 && len(patch.DeleteText) == 0 && appliedStart == patch.Start {
		if applied.ID < patch.ID {
			patch.Start += len(applied.InsertText)
		}
		return patch, nil
	}

	if appliedEnd <= patch.Start {
		patch.Start += delta
		return patch, nil
	}
	if incomingEnd <= appliedStart {
		return patch, nil
	}

	return nil, ErrPatchConflict
}

func normalizeHTMLFragment(fragment string) (string, error) {
	container := &html.Node{Type: html.ElementNode, Data: "div", DataAtom: atom.Div}
	nodes, err := html.ParseFragment(strings.NewReader(fragment), container)
	if err != nil {
		return "", err
	}
	var builder strings.Builder
	for _, node := range nodes {
		if shouldSkipTopLevelNode(node) {
			continue
		}
		if err := html.Render(&builder, node); err != nil {
			return "", err
		}
	}
	return builder.String(), nil
}

func splitHTMLBlocks(fragment string) ([]string, error) {
	container := &html.Node{Type: html.ElementNode, Data: "div", DataAtom: atom.Div}
	nodes, err := html.ParseFragment(strings.NewReader(fragment), container)
	if err != nil {
		return nil, err
	}
	blocks := make([]string, 0, len(nodes))
	for _, node := range nodes {
		if shouldSkipTopLevelNode(node) {
			continue
		}
		var buffer bytes.Buffer
		if err := html.Render(&buffer, node); err != nil {
			return nil, err
		}
		blocks = append(blocks, buffer.String())
	}
	return blocks, nil
}

func joinHTMLBlocks(blocks []string) string {
	return strings.Join(blocks, "")
}

func shouldSkipTopLevelNode(node *html.Node) bool {
	if node == nil {
		return true
	}
	if node.Type == html.CommentNode {
		return true
	}
	if node.Type == html.TextNode && strings.TrimSpace(node.Data) == "" {
		return true
	}
	return false
}

func transformHTMLPatch(incoming *Patch, applied *AppliedPatch) (*Patch, error) {
	patch := clonePatch(incoming)
	if patch == nil || applied == nil || patch.Field != FieldContent || patch.Kind != PatchKindHTML || applied.Kind != PatchKindHTML {
		return patch, nil
	}

	incomingStart := patch.BlockIndex
	incomingEnd := patch.BlockIndex + len(patch.BeforeBlocks)
	appliedStart := applied.BlockIndex
	appliedEnd := applied.BlockIndex + len(applied.BeforeBlocks)
	delta := len(applied.AfterBlocks) - len(applied.BeforeBlocks)

	if len(patch.BeforeBlocks) == 0 && len(applied.BeforeBlocks) == 0 && incomingStart == appliedStart {
		if applied.ID < patch.ID {
			patch.BlockIndex += len(applied.AfterBlocks)
		}
		return patch, nil
	}

	if incomingStart == appliedStart && incomingEnd == appliedEnd {
		return transformHTMLPatchWithinSameBlock(patch, applied)
	}

	if appliedEnd <= incomingStart {
		patch.BlockIndex += delta
		return patch, nil
	}
	if incomingEnd <= appliedStart {
		return patch, nil
	}

	return nil, ErrPatchConflict
}

func transformHTMLPatchWithinSameBlock(incoming *Patch, applied *AppliedPatch) (*Patch, error) {
	if !hasInlineHTMLTextPatch(incoming) || !hasInlineHTMLTextPatch(&applied.Patch) {
		return nil, ErrPatchConflict
	}
	if len(incoming.BeforeBlocks) != 1 || len(incoming.AfterBlocks) != 1 || len(applied.BeforeBlocks) != 1 || len(applied.AfterBlocks) != 1 {
		return nil, ErrPatchConflict
	}
	if incoming.BlockIndex != applied.BlockIndex {
		return nil, ErrPatchConflict
	}

	textPatch := &Patch{
		ID:         incoming.ID,
		Kind:       PatchKindText,
		Field:      FieldContent,
		Start:      *incoming.HTMLStart,
		DeleteText: incoming.HTMLDeleteText,
		InsertText: incoming.HTMLInsertText,
	}
	appliedText := &AppliedPatch{
		Patch: Patch{
			ID:         applied.ID,
			Kind:       PatchKindText,
			Field:      FieldContent,
			Start:      *applied.HTMLStart,
			DeleteText: applied.HTMLDeleteText,
			InsertText: applied.HTMLInsertText,
		},
	}
	transformedText, err := transformTextPatch(textPatch, appliedText)
	if err != nil {
		return nil, err
	}
	patch := clonePatch(incoming)
	patch.BeforeBlocks = []string{applied.AfterBlocks[0]}
	patch.AfterBlocks = make([]string, 1)
	patch.AfterBlocks[0], err = applyTextPatch(applied.AfterBlocks[0], transformedText)
	if err != nil {
		return nil, err
	}
	patch.HTMLStart = &transformedText.Start
	patch.HTMLDeleteText = transformedText.DeleteText
	patch.HTMLInsertText = transformedText.InsertText
	return patch, nil
}

func applyHTMLPatch(current string, patch *Patch) (string, error) {
	normalized, err := normalizeHTMLFragment(current)
	if err != nil {
		return "", err
	}
	blocks, err := splitHTMLBlocks(normalized)
	if err != nil {
		return "", err
	}
	if patch.BlockIndex < 0 || patch.BlockIndex > len(blocks) {
		return "", fmt.Errorf("invalid block index")
	}
	end := patch.BlockIndex + len(patch.BeforeBlocks)
	if end > len(blocks) {
		return "", fmt.Errorf("invalid block range")
	}
	for index, expected := range patch.BeforeBlocks {
		normalizedExpected, err := normalizeHTMLFragment(expected)
		if err != nil {
			return "", ErrPatchConflict
		}
		if blocks[patch.BlockIndex+index] != normalizedExpected {
			return "", ErrPatchConflict
		}
	}
	if hasInlineHTMLTextPatch(patch) {
		if len(patch.BeforeBlocks) != 1 || len(patch.AfterBlocks) != 1 {
			return "", ErrPatchConflict
		}
		updatedBlock, err := applyTextPatch(blocks[patch.BlockIndex], &Patch{
			Start:      *patch.HTMLStart,
			DeleteText: patch.HTMLDeleteText,
			InsertText: patch.HTMLInsertText,
		})
		if err != nil {
			return "", err
		}
		normalizedAfter, err := normalizeHTMLFragment(patch.AfterBlocks[0])
		if err != nil {
			return "", ErrPatchConflict
		}
		if updatedBlock != normalizedAfter {
			return "", ErrPatchConflict
		}
	}
	nextBlocks := make([]string, 0, len(blocks)-len(patch.BeforeBlocks)+len(patch.AfterBlocks))
	nextBlocks = append(nextBlocks, blocks[:patch.BlockIndex]...)
	nextBlocks = append(nextBlocks, patch.AfterBlocks...)
	nextBlocks = append(nextBlocks, blocks[end:]...)
	return joinHTMLBlocks(nextBlocks), nil
}

func hasInlineHTMLTextPatch(patch *Patch) bool {
	return patch != nil && patch.HTMLStart != nil
}
