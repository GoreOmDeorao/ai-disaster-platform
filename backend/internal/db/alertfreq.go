package db

import (
	"database/sql"
	"time"
)

// GetAlertFrequency24h returns hourly alert counts for the last 24 hours (UTC bucket).
func GetAlertFrequency24h(db *sql.DB) ([]map[string]interface{}, error) {
	rows, err := db.Query(`
		SELECT date_trunc('hour', created_at) AS h, COUNT(*)::int
		FROM alerts
		WHERE created_at >= NOW() - INTERVAL '24 hours'
		GROUP BY 1
		ORDER BY 1`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var pts []map[string]interface{}
	for rows.Next() {
		var h time.Time
		var c int
		if err := rows.Scan(&h, &c); err != nil {
			return nil, err
		}
		pts = append(pts, map[string]interface{}{"hour": h.Format(time.RFC3339), "count": c})
	}
	return pts, rows.Err()
}
