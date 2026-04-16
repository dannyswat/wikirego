package collab

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

type persistedDocumentState struct {
	BaseUpdate string   `json:"baseUpdate,omitempty"`
	Updates    []string `json:"updates,omitempty"`
}

type StateStore struct {
	rootPath string
	mu       sync.Mutex
}

func NewStateStore(rootPath string) *StateStore {
	return &StateStore{rootPath: rootPath}
}

func (s *StateStore) Load(pageID int) ([]DocumentMessage, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	state, err := s.readLocked(pageID)
	if err != nil {
		return nil, err
	}
	if state == nil {
		return nil, nil
	}

	messages := make([]DocumentMessage, 0, len(state.Updates)+1)
	if state.BaseUpdate != "" {
		messages = append(messages, DocumentMessage{Update: state.BaseUpdate, FullState: true})
	}
	for _, update := range state.Updates {
		if update == "" {
			continue
		}
		messages = append(messages, DocumentMessage{Update: update})
	}
	return messages, nil
}

func (s *StateStore) Append(pageID int, document *DocumentMessage) error {
	if document == nil || document.Update == "" {
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	state, err := s.readLocked(pageID)
	if err != nil {
		return err
	}
	if state == nil {
		state = &persistedDocumentState{}
	}

	if document.FullState {
		state.BaseUpdate = document.Update
		state.Updates = nil
	} else {
		state.Updates = append(state.Updates, document.Update)
	}

	return s.writeLocked(pageID, state)
}

func (s *StateStore) Clear(pageID int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	path := s.filePath(pageID)
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (s *StateStore) filePath(pageID int) string {
	return filepath.Join(s.rootPath, fmt.Sprintf("page-%d.json", pageID))
}

func (s *StateStore) readLocked(pageID int) (*persistedDocumentState, error) {
	path := s.filePath(pageID)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return nil, nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	state := &persistedDocumentState{}
	if err := json.Unmarshal(data, state); err != nil {
		return nil, err
	}
	return state, nil
}

func (s *StateStore) writeLocked(pageID int, state *persistedDocumentState) error {
	if err := os.MkdirAll(s.rootPath, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath(pageID), data, 0644)
}
