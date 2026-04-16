package collab

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"sync"
	"time"

	"wikirego/internal/pages"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10
)

type Hub struct {
	pageService *pages.PageService
	stateStore  *StateStore

	mu       sync.Mutex
	sessions map[int]*Session
}

func NewHub(pageService *pages.PageService, dataPath string) *Hub {
	return &Hub{
		pageService: pageService,
		stateStore:  NewStateStore(filepath.Join(dataPath, "collab")),
		sessions:    make(map[int]*Session),
	}
}

func (h *Hub) Session(pageID int) (*Session, error) {
	h.mu.Lock()
	if session, ok := h.sessions[pageID]; ok {
		h.mu.Unlock()
		return session, nil
	}
	h.mu.Unlock()

	page, err := h.pageService.GetPageByID(pageID)
	if err != nil {
		return nil, err
	}
	if h.stateStore != nil {
		_ = h.stateStore.Clear(pageID)
	}
	// Relay-only mode: start every fresh session from the current DB page and
	// keep collaboration state in memory while editors are connected.
	session := NewSession(page, nil, nil, h.removeSession)

	h.mu.Lock()
	defer h.mu.Unlock()
	if existing, ok := h.sessions[pageID]; ok {
		return existing, nil
	}
	h.sessions[pageID] = session
	return session, nil
}

func (h *Hub) removeSession(pageID int) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.sessions, pageID)
}

func (h *Hub) ResetPageState(page *pages.Page) error {
	if page == nil {
		return nil
	}
	h.mu.Lock()
	session := h.sessions[page.ID]
	h.mu.Unlock()
	if session != nil {
		session.ResetPage(page)
		return nil
	}
	return h.stateStore.Clear(page.ID)
}

func (h *Hub) DeletePageState(pageID int) error {
	if err := h.stateStore.Clear(pageID); err != nil {
		return err
	}
	h.mu.Lock()
	delete(h.sessions, pageID)
	h.mu.Unlock()
	return nil
}

type Connection struct {
	ID      string
	UserID  string
	conn    *websocket.Conn
	session *Session
	send    chan []byte
	once    sync.Once
}

func NewConnection(userID string, conn *websocket.Conn, session *Session) *Connection {
	return &Connection{
		ID:      uuid.NewString(),
		UserID:  userID,
		conn:    conn,
		session: session,
		send:    make(chan []byte, 256),
	}
}

func (c *Connection) Run() {
	c.session.Register(c)
	defer c.Close()
	go c.writeLoop()

	if err := c.session.SendSnapshot(c); err != nil {
		return
	}
	if err := c.session.SendPersistedDocuments(c); err != nil {
		return
	}
	c.readLoop()
}

func (c *Connection) SendEnvelope(envelope *ServerEnvelope) error {
	message, err := json.Marshal(envelope)
	if err != nil {
		return err
	}
	c.Enqueue(message)
	return nil
}

func (c *Connection) Enqueue(message []byte) {
	select {
	case c.send <- message:
	default:
		c.Close()
	}
}

func (c *Connection) Close() {
	c.once.Do(func() {
		c.session.Unregister(c.ID)
		close(c.send)
		_ = c.conn.Close()
	})
}

func (c *Connection) readLoop() {
	c.conn.SetReadLimit(1 << 20)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		var envelope ClientEnvelope
		if err := c.conn.ReadJSON(&envelope); err != nil {
			return
		}
		switch envelope.Type {
		case MessageTypeDocument:
			c.session.RelayDocument(c.ID, envelope.Document)
		case MessageTypeCursor:
			if envelope.Cursor != nil {
				envelope.Cursor.ClientID = c.ID
				envelope.Cursor.UserID = c.UserID
				c.session.BroadcastCursorExcept(c.ID, envelope.Cursor)
			}
		case MessageTypePong:
			_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
		}
	}
}

func (c *Connection) writeLoop() {
	ticker := time.NewTicker(pingPeriod)
	defer ticker.Stop()
	for {
		select {
		case message, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func DefaultUpgrader() websocket.Upgrader {
	return websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
}
