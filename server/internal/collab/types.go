package collab

import (
	"time"

	"wikirego/internal/pages"
)

const (
	MessageTypeSnapshot    = "snapshot"
	MessageTypeDocument    = "document"
	MessageTypePresence    = "presence"
	MessageTypeError       = "error"
	MessageTypePing        = "ping"
	MessageTypePong        = "pong"
	MessageTypeCursor      = "cursor"
	MessageTypeSyncRequest = "sync-request"
)

type Participant struct {
	ClientID string `json:"clientId"`
	UserID   string `json:"userId"`
}

type Snapshot struct {
	Page         *pages.Page   `json:"page"`
	ClientID     string        `json:"clientId,omitempty"`
	Participants []Participant `json:"participants,omitempty"`
	ShouldSeed   bool          `json:"shouldSeed,omitempty"`
	GeneratedAt  time.Time     `json:"generatedAt"`
}

type DocumentMessage struct {
	Update         string `json:"update"`
	TargetClientID string `json:"targetClientId,omitempty"`
	FullState      bool   `json:"fullState,omitempty"`
}

type ClientEnvelope struct {
	Type     string           `json:"type"`
	Document *DocumentMessage `json:"document,omitempty"`
	Cursor   *CursorPosition  `json:"cursor,omitempty"`
}

type ServerEnvelope struct {
	Type              string           `json:"type"`
	Snapshot          *Snapshot        `json:"snapshot,omitempty"`
	Document          *DocumentMessage `json:"document,omitempty"`
	Participants      []Participant    `json:"participants,omitempty"`
	Message           string           `json:"message,omitempty"`
	Cursor            *CursorPosition  `json:"cursor,omitempty"`
	RequesterClientID string           `json:"requesterClientId,omitempty"`
}

type CursorPosition struct {
	ClientID   string `json:"clientId"`
	UserID     string `json:"userId"`
	Field      string `json:"field"`
	Position   int    `json:"position,omitempty"`
	BlockIndex int    `json:"blockIndex,omitempty"`
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
