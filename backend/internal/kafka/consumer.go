package kafka

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"

	"github.com/go-redis/redis/v8"
	segkafka "github.com/segmentio/kafka-go"
	"github.com/yourusername/ai-disaster-backend/internal/db"
	"github.com/yourusername/ai-disaster-backend/internal/ws"
)

type SensorMessage struct {
	SensorID   string  `json:"sensor_id"`
	SensorType string  `json:"sensor_type"`
	Value      float64 `json:"value"`
	Unit       string  `json:"unit"`
	Location   string  `json:"location"`
	Latitude   float64 `json:"latitude"`
	Longitude  float64 `json:"longitude"`
	Timestamp  string  `json:"timestamp"`
}

var thresholds = map[string]struct {
	value    float64
	severity string
}{
	"flood":   {180, "critical"},
	"seismic": {5.5, "critical"},
	"fire":    {85, "high"},
	"gas":     {1000, "high"},
}

var (
	readingsMu     sync.Mutex
	sensorReadings = make(map[string][]float64)
)

func appendReadingWindow(sensorID string, value float64) []float64 {
	readingsMu.Lock()
	defer readingsMu.Unlock()
	readings := sensorReadings[sensorID]
	readings = append(readings, value)
	if len(readings) > 24 {
		readings = readings[len(readings)-24:]
	}
	sensorReadings[sensorID] = readings
	out := make([]float64, len(readings))
	copy(out, readings)
	return out
}

func StartConsumer(database *sql.DB, rdb *redis.Client, hub *ws.Hub) {
	_ = rdb

	broker := os.Getenv("KAFKA_BROKERS")
	if broker == "" {
		broker = "localhost:9092"
	}

	r := segkafka.NewReader(segkafka.ReaderConfig{
		Brokers:  []string{broker},
		Topic:    "sensor-raw",
		GroupID:  "disaster-backend-consumer",
		MinBytes: 1,
		MaxBytes: 1e6,
	})
	defer r.Close()

	log.Println("[Kafka] Listening on topic: sensor-raw")
	for {
		msg, err := r.ReadMessage(context.Background())
		if err != nil {
			log.Printf("[Kafka] Read error: %v", err)
			continue
		}

		var reading SensorMessage
		if err := json.Unmarshal(msg.Value, &reading); err != nil {
			log.Printf("[Kafka] Bad JSON: %v", err)
			continue
		}

		raw, _ := json.Marshal(reading)
		if err := db.InsertSensorReading(database, reading.SensorID, reading.Unit, reading.Value, string(raw)); err != nil {
			log.Printf("[Kafka] Insert reading failed (sensor_id=%q): %v", reading.SensorID, err)
			continue
		}

		window := appendReadingWindow(reading.SensorID, reading.Value)

		if th, ok := thresholds[reading.SensorType]; ok && reading.Value >= th.value {
			mlConf, mlOK := CallMLPredict(reading.SensorType, window)
			conf := 1.0
			modelUsed := "threshold-rule"
			if mlOK {
				conf = mlConf
				modelUsed = "lstm+threshold"
			}

			alertMsg := fmt.Sprintf("⚠️ %s alert at %s: %.2f %s (threshold: %.2f)",
				reading.SensorType, reading.Location, reading.Value, reading.Unit, th.value)
			if err := db.CreateAlert(database, reading.SensorID, th.severity, reading.SensorType, alertMsg, modelUsed, conf); err != nil {
				log.Printf("[Kafka] Create alert failed: %v", err)
			} else {
				log.Printf("[ALERT] %s (ml_conf=%.4f ok=%v)", alertMsg, conf, mlOK)
				if hub != nil {
					hub.Broadcast("NEW_ALERT", map[string]interface{}{
						"sensor_id":   reading.SensorID,
						"sensor_type": reading.SensorType,
						"severity":    th.severity,
						"location":    reading.Location,
						"latitude":    reading.Latitude,
						"longitude":   reading.Longitude,
						"message":     alertMsg,
						"confidence":  conf,
					})
					hub.Broadcast("THRESHOLD_BREACH", map[string]interface{}{
						"sensor_id": reading.SensorID, "value": reading.Value, "unit": reading.Unit,
						"type": reading.SensorType, "location": reading.Location,
					})
				}
			}
		}
	}
}
