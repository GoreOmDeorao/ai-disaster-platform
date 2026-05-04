package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/yourusername/ai-disaster-backend/internal/db"
	"github.com/yourusername/ai-disaster-backend/internal/ws"
)

func corsMiddleware() gin.HandlerFunc {
	raw := os.Getenv("CORS_ORIGINS")
	var allowed []string
	if strings.TrimSpace(raw) == "" {
		allowed = []string{
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"http://localhost:8080",
		}
	} else {
		for _, p := range strings.Split(raw, ",") {
			if s := strings.TrimSpace(p); s != "" {
				allowed = append(allowed, s)
			}
		}
	}
	prod := strings.TrimSpace(os.Getenv("CORS_PRODUCTION_ORIGIN"))
	if prod != "" {
		allowed = append(allowed, prod)
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		ok := false
		for _, o := range allowed {
			if origin == o {
				c.Header("Access-Control-Allow-Origin", o)
				ok = true
				break
			}
		}
		if !ok && origin != "" {
			c.Header("Access-Control-Allow-Origin", allowed[0])
		}
		if c.GetHeader("Access-Control-Allow-Origin") == "" {
			c.Header("Access-Control-Allow-Origin", "*")
		}
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type,Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

// RegisterRoutes wires HTTP + WebSocket. hub may be nil (tests).
func RegisterRoutes(r *gin.Engine, database *sql.DB, rdb *redis.Client, hub *ws.Hub, startedAt time.Time) {
	r.Use(corsMiddleware())
	RegisterWebSocket(r, hub)

	r.GET("/health", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		dbOK, redisOK := true, true
		if err := database.PingContext(ctx); err != nil {
			dbOK = false
		}
		if err := rdb.Ping(ctx).Err(); err != nil {
			redisOK = false
		}
		ready := dbOK && redisOK
		c.JSON(http.StatusOK, gin.H{
			"status":  map[bool]string{true: "ok", false: "degraded"}[ready],
			"ready":   ready,
			"service": "ai-disaster-backend",
			"checks":  gin.H{"postgres": dbOK, "redis": redisOK},
		})
	})

	v1 := r.Group("/api/v1")

	v1.GET("/alerts", func(c *gin.Context) {
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
		if limit < 1 {
			limit = 50
		}
		if limit > 500 {
			limit = 500
		}
		alerts, err := db.GetAlerts(database, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"alerts": alerts, "count": len(alerts)})
	})

	v1.PUT("/alerts/:id/acknowledge", func(c *gin.Context) {
		id := c.Param("id")
		res, err := database.Exec(`UPDATE alerts SET acknowledged=true,
			acknowledged_at=NOW() WHERE id=$1`, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "alert not found", "id": id})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "alert acknowledged", "id": id})
	})

	v1.POST("/alerts/trigger-sound", func(c *gin.Context) {
		var body struct {
			SensorType string `json:"sensor_type"`
			Severity   string `json:"severity"`
			Location   string `json:"location"`
			Message    string `json:"message"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if body.SensorType == "" || body.Location == "" || body.Message == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sensor_type, location, message required"})
			return
		}
		if body.Severity == "" {
			body.Severity = "high"
		}
		if err := db.InsertSoundAlert(database, body.SensorType, body.Severity, body.Location, body.Message); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if hub != nil {
			hub.Broadcast("SOUND_ALERT", body)
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	v1.GET("/sensors", func(c *gin.Context) {
		rows, err := database.Query(`SELECT id,name,type,location,latitude,longitude,status FROM sensors ORDER BY name`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		var sensors []gin.H
		for rows.Next() {
			var id, name, stype, location, status string
			var lat, lon float64
			if err := rows.Scan(&id, &name, &stype, &location, &lat, &lon, &status); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			sensors = append(sensors, gin.H{
				"id": id, "name": name, "type": stype, "location": location,
				"latitude": lat, "longitude": lon, "status": status,
			})
		}
		if err := rows.Err(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"sensors": sensors})
	})

	v1.GET("/shelters", func(c *gin.Context) {
		list, err := db.ListShelters(database)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"shelters": list})
	})

	v1.GET("/shelters/nearby", func(c *gin.Context) {
		lat, _ := strconv.ParseFloat(c.Query("lat"), 64)
		lng, _ := strconv.ParseFloat(c.Query("lng"), 64)
		radius, _ := strconv.ParseFloat(c.DefaultQuery("radius", "50"), 64)
		if radius <= 0 {
			radius = 50
		}
		list, err := db.ListSheltersNearby(database, lat, lng, radius)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"shelters": list})
	})

	v1.GET("/stats", func(c *gin.Context) {
		st, err := db.GetDashboardStats(database, startedAt)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		freq, err := db.GetAlertFrequency24h(database)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		st["alert_frequency_24h"] = freq
		c.JSON(http.StatusOK, st)
	})

	v1.POST("/broadcasts", func(c *gin.Context) {
		var req struct {
			Title            string                   `json:"title"`
			Message          string                   `json:"message"`
			Severity         string                   `json:"severity"`
			DisasterType     string                   `json:"disaster_type"`
			AffectedAreas    []string                 `json:"affected_areas"`
			ShelterLocations json.RawMessage          `json:"shelter_locations"`
			ExpiresIn        string                   `json:"expires_in"`
			CreatedBy        string                   `json:"created_by"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if req.Title == "" || req.Message == "" || req.Severity == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "title, message, severity required"})
			return
		}
		if req.CreatedBy == "" {
			req.CreatedBy = "dashboard"
		}
		var exp *time.Time
		switch strings.ToLower(strings.TrimSpace(req.ExpiresIn)) {
		case "1h", "1hr":
			t := time.Now().Add(time.Hour)
			exp = &t
		case "6h", "6hr":
			t := time.Now().Add(6 * time.Hour)
			exp = &t
		case "24h", "24hr":
			t := time.Now().Add(24 * time.Hour)
			exp = &t
		}
		sj := []byte("{}")
		if len(req.ShelterLocations) > 0 {
			sj = req.ShelterLocations
		}
		id, err := db.InsertBroadcast(database, req.Title, req.Message, req.Severity, req.DisasterType, req.AffectedAreas, sj, exp, req.CreatedBy)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if hub != nil {
			var shelterIface interface{}
			_ = json.Unmarshal(sj, &shelterIface)
			hub.Broadcast("BROADCAST", gin.H{
				"id": id, "title": req.Title, "message": req.Message, "severity": req.Severity,
				"disaster_type": req.DisasterType, "affected_areas": req.AffectedAreas,
				"shelter_locations": shelterIface,
			})
			if req.Severity == "critical" || req.Severity == "emergency" {
				hub.Broadcast("SOUND_ALERT", gin.H{
					"sensor_type": req.DisasterType, "severity": req.Severity, "location": strings.Join(req.AffectedAreas, ", "),
					"message": req.Message,
				})
			}
		}
		if os.Getenv("FCM_SERVER_KEY") != "" {
			// FCM hook: configure FCM_SERVER_KEY and device tokens to enable push
		}
		c.JSON(http.StatusCreated, gin.H{"id": id, "status": "created"})
	})

	v1.GET("/broadcasts", func(c *gin.Context) {
		list, err := db.ListAllBroadcasts(database, 200)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"broadcasts": list})
	})

	v1.GET("/broadcasts/active", func(c *gin.Context) {
		list, err := db.ListActiveBroadcasts(database)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"broadcasts": list})
	})

	v1.PUT("/broadcasts/:id/deactivate", func(c *gin.Context) {
		id := c.Param("id")
		n, err := db.DeactivateBroadcast(database, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if hub != nil {
			hub.Broadcast("BROADCAST_DEACTIVATED", gin.H{"id": id})
		}
		c.JSON(http.StatusOK, gin.H{"status": "deactivated", "id": id})
	})
}
