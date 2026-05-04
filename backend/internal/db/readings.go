package db

import (
	"database/sql"
)

// GetLastReadingsForSensorName returns up to n most recent values, oldest-first (chronological for ML).
func GetLastReadingsForSensorName(db *sql.DB, sensorName string, n int) ([]float64, error) {
	rows, err := db.Query(`
		SELECT sr.value FROM sensor_readings sr
		JOIN sensors s ON s.id = sr.sensor_id
		WHERE s.name = $1
		ORDER BY sr.recorded_at DESC
		LIMIT $2`, sensorName, n)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var rev []float64
	for rows.Next() {
		var v float64
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		rev = append(rev, v)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	// reverse to chronological
	for i, j := 0, len(rev)-1; i < j; i, j = i+1, j-1 {
		rev[i], rev[j] = rev[j], rev[i]
	}
	return rev, nil
}
