package collab

import (
	"encoding/json"
	"net/http"
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

	mu       sync.Mutex
	sessions map[int]*Session
}

func NewHub(pageService *pages.PageService) *Hub {
	return &Hub{
		pageService: pageService,
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
	session := NewSession(page, h.removeSession)

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
		send:    make(chan []byte, 32),
	}
}

func (c *Connection) Run() {
	c.session.Register(c)
	defer c.Close()

	if err := c.session.SendSnapshot(c); err != nil {
		return
	}

	go c.writeLoop()
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
		case MessageTypePatch:
			applied, err := c.session.ApplyPatch(c.ID, c.UserID, envelope.Patch)
			if err != nil {
				_ = c.SendEnvelope(&ServerEnvelope{
					Type:     MessageTypeError,
					Message:  err.Error(),
					Snapshot: c.session.Snapshot(c.ID),
				})
				continue
			}
			c.session.BroadcastPatch(applied)
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
