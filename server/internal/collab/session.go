package collab

import (
	"encoding/json"
	"fmt"
	"sort"
	"sync"
	"time"

	"wikirego/internal/pages"
)

const maxHistoryEntries = 128

type Session struct {
	pageID  int
	page    *pages.Page
	version int

	mu      sync.Mutex
	clients map[string]*Connection
	history []*AppliedPatch
	onEmpty func(int)
}

func NewSession(page *pages.Page, onEmpty func(int)) *Session {
	return &Session{
		pageID:  page.ID,
		page:    clonePage(page),
		clients: make(map[string]*Connection),
		onEmpty: onEmpty,
	}
}

func (s *Session) Version() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.version
}

func (s *Session) Snapshot(clientID string) *Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.snapshotLocked(clientID)
}

func (s *Session) snapshotLocked(clientID string) *Snapshot {
	return &Snapshot{
		Page:         clonePage(s.page),
		Version:      s.version,
		ClientID:     clientID,
		Participants: s.participantsLocked(),
		GeneratedAt:  time.Now().UTC(),
	}
}

func (s *Session) participantsLocked() []Participant {
	participants := make([]Participant, 0, len(s.clients))
	for _, client := range s.clients {
		participants = append(participants, Participant{ClientID: client.ID, UserID: client.UserID})
	}
	sort.Slice(participants, func(i, j int) bool {
		if participants[i].UserID == participants[j].UserID {
			return participants[i].ClientID < participants[j].ClientID
		}
		return participants[i].UserID < participants[j].UserID
	})
	return participants
}

func (s *Session) Register(connection *Connection) {
	s.mu.Lock()
	s.clients[connection.ID] = connection
	participants := s.participantsLocked()
	s.mu.Unlock()
	s.broadcast(&ServerEnvelope{Type: MessageTypePresence, Participants: participants})
}

func (s *Session) Unregister(clientID string) {
	s.mu.Lock()
	if _, ok := s.clients[clientID]; !ok {
		s.mu.Unlock()
		return
	}
	delete(s.clients, clientID)
	participants := s.participantsLocked()
	empty := len(s.clients) == 0
	s.mu.Unlock()

	if empty {
		if s.onEmpty != nil {
			s.onEmpty(s.pageID)
		}
		return
	}
	s.broadcast(&ServerEnvelope{Type: MessageTypePresence, Participants: participants})
}

func (s *Session) SendSnapshot(connection *Connection) error {
	return connection.SendEnvelope(&ServerEnvelope{
		Type:     MessageTypeSnapshot,
		Snapshot: s.Snapshot(connection.ID),
	})
}

func (s *Session) ApplyPatch(clientID, userID string, patch *Patch) (*AppliedPatch, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if patch == nil {
		return nil, fmt.Errorf("missing patch")
	}
	transformed := clonePatch(patch)
	for _, applied := range s.history {
		if applied.Version <= transformed.BaseVersion || applied.Field != transformed.Field {
			continue
		}
		var err error
		switch transformed.Kind {
		case PatchKindText:
			transformed, err = transformTextPatch(transformed, applied)
		case PatchKindHTML:
			transformed, err = transformHTMLPatch(transformed, applied)
		case PatchKindSet:
			transformed = clonePatch(transformed)
		default:
			return nil, fmt.Errorf("unsupported patch kind")
		}
		if err != nil {
			return nil, err
		}
	}

	if err := s.applyPatchLocked(transformed); err != nil {
		return nil, err
	}
	if transformed.Field == FieldContent {
		normalized, err := normalizeHTMLFragment(s.page.Content)
		if err != nil {
			return nil, err
		}
		s.page.Content = normalized
	}

	s.version++
	applied := &AppliedPatch{
		Patch:     *transformed,
		Version:   s.version,
		ClientID:  clientID,
		UserID:    userID,
		AppliedAt: time.Now().UTC(),
	}
	s.history = append(s.history, applied)
	if len(s.history) > maxHistoryEntries {
		s.history = append([]*AppliedPatch(nil), s.history[len(s.history)-maxHistoryEntries:]...)
	}
	return applied, nil
}

func (s *Session) applyPatchLocked(patch *Patch) error {
	switch patch.Kind {
	case PatchKindText:
		return s.applyTextFieldLocked(patch)
	case PatchKindSet:
		return s.applyScalarFieldLocked(patch)
	case PatchKindHTML:
		if patch.Field != FieldContent {
			return fmt.Errorf("html patch only supports content field")
		}
		updated, err := applyHTMLPatch(s.page.Content, patch)
		if err != nil {
			return err
		}
		s.page.Content = updated
		return nil
	default:
		return fmt.Errorf("unsupported patch kind")
	}
}

func (s *Session) applyTextFieldLocked(patch *Patch) error {
	current, err := s.getStringFieldLocked(patch.Field)
	if err != nil {
		return err
	}
	next, err := applyTextPatch(current, patch)
	if err != nil {
		return err
	}
	return s.setStringFieldLocked(patch.Field, next)
}

func (s *Session) getStringFieldLocked(field string) (string, error) {
	switch field {
	case FieldTitle:
		return s.page.Title, nil
	case FieldURL:
		return s.page.Url, nil
	case FieldShortDesc:
		return s.page.ShortDesc, nil
	case FieldContent:
		return s.page.Content, nil
	default:
		return "", fmt.Errorf("unsupported string field")
	}
}

func (s *Session) setStringFieldLocked(field, value string) error {
	switch field {
	case FieldTitle:
		s.page.Title = value
	case FieldURL:
		s.page.Url = value
	case FieldShortDesc:
		s.page.ShortDesc = value
	case FieldContent:
		s.page.Content = value
	default:
		return fmt.Errorf("unsupported string field")
	}
	return nil
}

func (s *Session) applyScalarFieldLocked(patch *Patch) error {
	switch patch.Field {
	case FieldParentID:
		var raw *int
		if len(patch.Value) > 0 && string(patch.Value) != "null" {
			decoded := 0
			if err := json.Unmarshal(patch.Value, &decoded); err != nil {
				return err
			}
			raw = &decoded
		}
		s.page.ParentID = raw
		return nil
	case FieldProtected:
		return decodeBool(patch.Value, func(value bool) { s.page.IsProtected = value })
	case FieldPinned:
		return decodeBool(patch.Value, func(value bool) { s.page.IsPinned = value })
	case FieldCategory:
		return decodeBool(patch.Value, func(value bool) { s.page.IsCategoryPage = value })
	case FieldSortDesc:
		return decodeBool(patch.Value, func(value bool) { s.page.SortChildrenDesc = value })
	default:
		return fmt.Errorf("unsupported scalar field")
	}
}

func decodeBool(raw json.RawMessage, assign func(bool)) error {
	value := false
	if err := json.Unmarshal(raw, &value); err != nil {
		return err
	}
	assign(value)
	return nil
}

func (s *Session) broadcast(envelope *ServerEnvelope) {
	message, err := json.Marshal(envelope)
	if err != nil {
		return
	}
	s.mu.Lock()
	clients := make([]*Connection, 0, len(s.clients))
	for _, client := range s.clients {
		clients = append(clients, client)
	}
	s.mu.Unlock()
	for _, client := range clients {
		client.Enqueue(message)
	}
}

func (s *Session) BroadcastPatch(applied *AppliedPatch) {
	s.broadcast(&ServerEnvelope{Type: MessageTypePatch, Patch: applied})
}

func (s *Session) BroadcastCursorExcept(senderClientID string, cursor *CursorPosition) {
	message, err := json.Marshal(&ServerEnvelope{Type: MessageTypeCursor, Cursor: cursor})
	if err != nil {
		return
	}
	s.mu.Lock()
	clients := make([]*Connection, 0, len(s.clients))
	for id, client := range s.clients {
		if id != senderClientID {
			clients = append(clients, client)
		}
	}
	s.mu.Unlock()
	for _, client := range clients {
		client.Enqueue(message)
	}
}
