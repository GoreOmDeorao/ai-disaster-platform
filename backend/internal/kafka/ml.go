package kafka

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"
)

type mlPredictRequest struct {
	SensorType string    `json:"sensor_type"`
	Readings   []float64 `json:"readings"`
}

type mlPredictResponse struct {
	Confidence float64 `json:"confidence"`
}

// CallMLPredict POSTs last 24 readings to the ML service; returns confidence and ok=false if unavailable.
func CallMLPredict(sensorType string, readings []float64) (confidence float64, ok bool) {
	if len(readings) < 24 {
		return 0, false
	}
	base := os.Getenv("ML_SERVICE_URL")
	if base == "" {
		base = "http://127.0.0.1:8000"
	}
	body, err := json.Marshal(mlPredictRequest{SensorType: sensorType, Readings: readings})
	if err != nil {
		return 0, false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/predict", bytes.NewReader(body))
	if err != nil {
		return 0, false
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("[ml] predict request: %v", err)
		return 0, false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Printf("[ml] predict status %d", resp.StatusCode)
		return 0, false
	}
	var out mlPredictResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return 0, false
	}
	return out.Confidence, true
}
