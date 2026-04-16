package collab

import (
	"encoding/json"
	"sort"
	"sync"
	"time"

	"wikirego/internal/pages"
)

type Session struct {
	pageID int
	page   *pages.Page

	mu            sync.Mutex
	clients       map[string]*Connection
	persistedDocs []DocumentMessage
	store         *StateStore
	onEmpty       func(int)
}

func NewSession(page *pages.Page, persistedDocs []DocumentMessage, store *StateStore, onEmpty func(int)) *Session {
	return &Session{
		pageID:        page.ID,
		page:          clonePage(page),
		clients:       make(map[string]*Connection),
		persistedDocs: append([]DocumentMessage(nil), persistedDocs...),
		store:         store,
		onEmpty:       onEmpty,
	}
}

func (s *Session) Snapshot(clientID string) *Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	return &Snapshot{
		Page:         clonePage(s.page),
		ClientID:     clientID,
		Participants: s.participantsLocked(),
		ShouldSeed:   len(s.persistedDocs) == 0 && len(s.clients) == 1,
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
	hasPersistedDocs := len(s.persistedDocs) > 0
	s.mu.Unlock()

	s.broadcast(&ServerEnvelope{Type: MessageTypePresence, Participants: participants})
	if !hasPersistedDocs && len(participants) > 1 {
		s.BroadcastSyncRequest(connection.ID)
	}
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

func (s *Session) SendPersistedDocuments(connection *Connection) error {
	s.mu.Lock()
	documents := append([]DocumentMessage(nil), s.persistedDocs...)
	s.mu.Unlock()

	for _, document := range documents {
		doc := document
		if err := connection.SendEnvelope(&ServerEnvelope{
			Type:     MessageTypeDocument,
			Document: &doc,
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *Session) RelayDocument(senderClientID string, document *DocumentMessage) {
	if document == nil || document.Update == "" {
		return
	}
	s.persistDocument(document)
	message := &ServerEnvelope{Type: MessageTypeDocument, Document: document}
	if document.TargetClientID != "" {
		s.sendToClient(document.TargetClientID, message)
		return
	}
	s.broadcastExcept(senderClientID, message)
}

func (s *Session) ResetPage(page *pages.Page) {
	s.mu.Lock()
	s.page = clonePage(page)
	s.persistedDocs = nil
	s.mu.Unlock()
	if s.store != nil {
		_ = s.store.Clear(s.pageID)
	}
}

func (s *Session) BroadcastSyncRequest(requesterClientID string) {
	s.broadcastExcept(requesterClientID, &ServerEnvelope{
		Type:              MessageTypeSyncRequest,
		RequesterClientID: requesterClientID,
	})
}

func (s *Session) BroadcastCursorExcept(senderClientID string, cursor *CursorPosition) {
	s.broadcastExcept(senderClientID, &ServerEnvelope{Type: MessageTypeCursor, Cursor: cursor})
}

func (s *Session) sendToClient(clientID string, envelope *ServerEnvelope) {
	message, err := json.Marshal(envelope)
	if err != nil {
		return
	}
	s.mu.Lock()
	client := s.clients[clientID]
	s.mu.Unlock()
	if client != nil {
		client.Enqueue(message)
	}
}

func (s *Session) broadcast(envelope *ServerEnvelope) {
	s.broadcastExcept("", envelope)
}

func (s *Session) broadcastExcept(excludedClientID string, envelope *ServerEnvelope) {
	message, err := json.Marshal(envelope)
	if err != nil {
		return
	}
	s.mu.Lock()
	clients := make([]*Connection, 0, len(s.clients))
	for id, client := range s.clients {
		if excludedClientID != "" && id == excludedClientID {
			continue
		}
		clients = append(clients, client)
	}
	s.mu.Unlock()
	for _, client := range clients {
		client.Enqueue(message)
	}
}

func (s *Session) persistDocument(document *DocumentMessage) {
	persisted := DocumentMessage{Update: document.Update, FullState: document.FullState}

	s.mu.Lock()
	if persisted.FullState {
		s.persistedDocs = []DocumentMessage{persisted}
	} else {
		s.persistedDocs = append(s.persistedDocs, persisted)
	}
	s.mu.Unlock()

	if s.store != nil {
		if err := s.store.Append(s.pageID, &persisted); err != nil {
			// Keep the session running even if persistence fails; other clients still receive the update.
		}
	}
}
