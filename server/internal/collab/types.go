package collab

import (
	"encoding/json"
	"time"

	"wikirego/internal/pages"
)

const (
	MessageTypeSnapshot = "snapshot"
	MessageTypePatch    = "patch"
	MessageTypePresence = "presence"
	MessageTypeError    = "error"
	MessageTypePing     = "ping"
	MessageTypePong     = "pong"

	PatchKindText = "text"
	PatchKindSet  = "set"
	PatchKindHTML = "html"

	FieldTitle     = "title"
	FieldURL       = "url"
	FieldShortDesc = "shortDesc"
	FieldContent   = "content"
	FieldParentID  = "parentId"
	FieldProtected = "isProtected"
	FieldPinned    = "isPinned"
	FieldCategory  = "isCategoryPage"
	FieldSortDesc  = "sortChildrenDesc"
)

type Participant struct {
	ClientID string `json:"clientId"`
	UserID   string `json:"userId"`
}

type Snapshot struct {
	Page         *pages.Page   `json:"page"`
	Version      int           `json:"version"`
	ClientID     string        `json:"clientId,omitempty"`
	Participants []Participant `json:"participants,omitempty"`
	GeneratedAt  time.Time     `json:"generatedAt"`
}

type Patch struct {
	ID             string          `json:"id"`
	Kind           string          `json:"kind"`
	Field          string          `json:"field"`
	BaseVersion    int             `json:"baseVersion"`
	Start          int             `json:"start,omitempty"`
	DeleteText     string          `json:"deleteText,omitempty"`
	InsertText     string          `json:"insertText,omitempty"`
	Value          json.RawMessage `json:"value,omitempty"`
	BlockIndex     int             `json:"blockIndex,omitempty"`
	BeforeBlocks   []string        `json:"beforeBlocks,omitempty"`
	AfterBlocks    []string        `json:"afterBlocks,omitempty"`
	HTMLStart      *int            `json:"htmlStart,omitempty"`
	HTMLDeleteText string          `json:"htmlDeleteText,omitempty"`
	HTMLInsertText string          `json:"htmlInsertText,omitempty"`
}

type AppliedPatch struct {
	Patch
	Version   int       `json:"version"`
	ClientID  string    `json:"clientId"`
	UserID    string    `json:"userId"`
	AppliedAt time.Time `json:"appliedAt"`
}

type ClientEnvelope struct {
	Type  string `json:"type"`
	Patch *Patch `json:"patch,omitempty"`
}

type ServerEnvelope struct {
	Type         string        `json:"type"`
	Snapshot     *Snapshot     `json:"snapshot,omitempty"`
	Patch        *AppliedPatch `json:"patch,omitempty"`
	Participants []Participant `json:"participants,omitempty"`
	Message      string        `json:"message,omitempty"`
}

func clonePage(page *pages.Page) *pages.Page {
	if page == nil {
		return nil
	}
	clone := *page
	if page.Tags != nil {
		clone.Tags = append([]string(nil), page.Tags...)
	}
	return &clone
}

func clonePatch(patch *Patch) *Patch {
	if patch == nil {
		return nil
	}
	clone := *patch
	if patch.Value != nil {
		clone.Value = append(json.RawMessage(nil), patch.Value...)
	}
	if patch.BeforeBlocks != nil {
		clone.BeforeBlocks = append([]string(nil), patch.BeforeBlocks...)
	}
	if patch.AfterBlocks != nil {
		clone.AfterBlocks = append([]string(nil), patch.AfterBlocks...)
	}
	return &clone
}

func isTextField(field string) bool {
	switch field {
	case FieldTitle, FieldURL, FieldShortDesc:
		return true
	default:
		return false
	}
}
