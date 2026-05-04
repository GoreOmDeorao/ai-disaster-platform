package db

import "database/sql"

func InsertSoundAlert(db *sql.DB, sensorType, severity, location, message string) error {
	_, err := db.Exec(
		`INSERT INTO sound_alerts (sensor_type, severity, location, message) VALUES ($1,$2,$3,$4)`,
		sensorType, severity, location, message,
	)
	return err
}
