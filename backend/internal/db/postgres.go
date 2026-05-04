package db

import (
	"database/sql"
	"time"

	_ "github.com/lib/pq"
)

func sqlFloat64(n sql.NullFloat64) float64 {
	if n.Valid {
		return n.Float64
	}
	return 0
}

func Connect(url string) (*sql.DB, error) {
	db, err := sql.Open("postgres", url)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		return nil, err
	}
	return db, nil
}

func InsertSensorReading(db *sql.DB, sensorID, unit string, value float64, rawJSON string) error {
	_, err := db.Exec(
		`INSERT INTO sensor_readings (sensor_id, value, unit, raw_json)
		 VALUES ((SELECT id FROM sensors WHERE name=$1 LIMIT 1), $2, $3, $4::jsonb)`,
		sensorID, value, unit, rawJSON,
	)
	return err
}

func CreateAlert(db *sql.DB, sensorID, severity, disasterType, message, model string, confidence float64) error {
	_, err := db.Exec(
		`INSERT INTO alerts (sensor_id, severity, disaster_type, message, prediction_confidence, model_used)
		 VALUES ((SELECT id FROM sensors WHERE name=$1 LIMIT 1), $2, $3, $4, $5, $6)`,
		sensorID, severity, disasterType, message, confidence, model,
	)
	return err
}

func GetAlerts(db *sql.DB, limit int) ([]map[string]interface{}, error) {
	rows, err := db.Query(
		`SELECT a.id, s.name, s.location, s.latitude::float8, s.longitude::float8, a.severity, a.disaster_type, a.message,
		        a.prediction_confidence, a.acknowledged, a.created_at
		 FROM alerts a JOIN sensors s ON a.sensor_id = s.id
		 ORDER BY a.created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []map[string]interface{}
	for rows.Next() {
		var id, name, location, severity, disasterType, message string
		var lat, lon float64
		var confidence sql.NullFloat64
		var acknowledged bool
		var createdAt time.Time
		if err := rows.Scan(&id, &name, &location, &lat, &lon, &severity, &disasterType, &message, &confidence, &acknowledged, &createdAt); err != nil {
			return nil, err
		}
		results = append(results, map[string]interface{}{
			"id": id, "sensor_name": name, "location": location,
			"latitude": lat, "longitude": lon,
			"severity": severity, "disaster_type": disasterType,
			"message": message, "confidence": sqlFloat64(confidence),
			"acknowledged": acknowledged, "created_at": createdAt,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return results, nil
}
