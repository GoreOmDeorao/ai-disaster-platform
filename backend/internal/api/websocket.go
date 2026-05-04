package api

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/yourusername/ai-disaster-backend/internal/ws"
)

var wsUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool { return true },
}

// RegisterWebSocket registers GET /ws for real-time JSON envelopes.
func RegisterWebSocket(r *gin.Engine, hub *ws.Hub) {
	r.GET("/ws", func(c *gin.Context) {
		conn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("[ws] upgrade: %v", err)
			return
		}
		hub.Add(conn)
		go pumpWSClient(hub, conn)
	})
}

func pumpWSClient(hub *ws.Hub, c *websocket.Conn) {
	defer hub.Remove(c)
	_ = c.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.SetPongHandler(func(string) error {
		_ = c.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})
	for {
		if _, _, err := c.ReadMessage(); err != nil {
			break
		}
	}
}
