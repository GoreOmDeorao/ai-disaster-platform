package main

import (
	"log"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/ai-disaster-backend/internal/api"
	"github.com/yourusername/ai-disaster-backend/internal/db"
	"github.com/yourusername/ai-disaster-backend/internal/kafka"
	"github.com/yourusername/ai-disaster-backend/internal/redis"
	"github.com/yourusername/ai-disaster-backend/internal/ws"
)

const defaultDatabaseURL = "postgres://disaster_user:disaster_pass@127.0.0.1:5432/disaster_db?sslmode=disable"

func ensureSSLMode(u string) string {
	u = strings.TrimSpace(u)
	if u == "" {
		return defaultDatabaseURL
	}
	if strings.Contains(u, "sslmode=") {
		return u
	}
	if strings.Contains(u, "?") {
		return u + "&sslmode=disable"
	}
	return u + "?sslmode=disable"
}

func main() {
	log.Println("=== AI Disaster Response Backend Starting ===")

	if os.Getenv("GIN_MODE") == "release" || os.Getenv("APP_ENV") == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	databaseURL := ensureSSLMode(os.Getenv("DATABASE_URL"))
	if os.Getenv("DATABASE_URL") == "" {
		log.Println("ℹ️  DATABASE_URL not set, using local default (disaster_db @ 127.0.0.1:5432)")
	}

	database, err := db.Connect(databaseURL)
	if err != nil {
		log.Fatalf("❌ Failed to connect to PostgreSQL: %v", err)
	}
	defer database.Close()
	log.Println("✅ PostgreSQL connected")

	rdb := redis.NewClient(os.Getenv("REDIS_URL"))
	log.Println("✅ Redis connected")

	hub := ws.NewHub()
	startedAt := time.Now()

	go kafka.StartConsumer(database, rdb, hub)
	log.Println("✅ Kafka consumer started")

	r := gin.Default()
	api.RegisterRoutes(r, database, rdb, hub, startedAt)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("✅ HTTP server listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("❌ Server failed: %v", err)
	}
}
