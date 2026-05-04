package ws

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const writeWait = 10 * time.Second

// Hub tracks WebSocket clients and broadcasts JSON envelopes: {"type":"...","payload":...}
type Hub struct {
	mu      sync.RWMutex
	clients map[*websocket.Conn]struct{}
}

func NewHub() *Hub {
	return &Hub{clients: make(map[*websocket.Conn]struct{})}
}

func (h *Hub) Add(c *websocket.Conn) {
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()
}

func (h *Hub) Remove(c *websocket.Conn) {
	h.mu.Lock()
	if _, ok := h.clients[c]; !ok {
		h.mu.Unlock()
		return
	}
	delete(h.clients, c)
	h.mu.Unlock()
	_ = c.Close()
}

// Broadcast sends a JSON message to all connected clients (best-effort).
func (h *Hub) Broadcast(msgType string, payload interface{}) {
	env := map[string]interface{}{"type": msgType, "payload": payload}
	data, err := json.Marshal(env)
	if err != nil {
		log.Printf("[ws] marshal: %v", err)
		return
	}
	h.mu.RLock()
	var dead []*websocket.Conn
	for c := range h.clients {
		_ = c.SetWriteDeadline(time.Now().Add(writeWait))
		if err := c.WriteMessage(websocket.TextMessage, data); err != nil {
			dead = append(dead, c)
		}
	}
	h.mu.RUnlock()
	for _, c := range dead {
		h.Remove(c)
	}
}
