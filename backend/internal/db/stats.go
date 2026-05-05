package db

import (
	"database/sql"
	"fmt"
	"time"
)

func formatUptime(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
	h := int(d.Hours())
	m := int(d.Minutes()) % 60
	if h > 0 {
		return fmt.Sprintf("%dh %dm", h, m)
	}
	return fmt.Sprintf("%dm", int(d.Minutes()))
}

func GetDashboardStats(db *sql.DB, startedAt time.Time) (map[string]interface{}, error) {
	var totalSensors, activeAlerts, criticalAlerts, readingsToday int
	if err := db.QueryRow(`SELECT COUNT(*) FROM sensors`).Scan(&totalSensors); err != nil {
		return nil, err
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM alerts WHERE acknowledged = false`).Scan(&activeAlerts); err != nil {
		return nil, err
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM alerts WHERE severity = 'critical' AND acknowledged = false`).Scan(&criticalAlerts); err != nil {
		return nil, err
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM sensor_readings WHERE recorded_at >= CURRENT_DATE`).Scan(&readingsToday); err != nil {
		return nil, err
	}

	byType := map[string]int{"flood": 0, "seismic": 0, "fire": 0, "gas": 0}
	rows, err := db.Query(`SELECT disaster_type, COUNT(*) FROM alerts GROUP BY disaster_type`)
	if err == nil {
		for rows.Next() {
			var t string
			var c int
			_ = rows.Scan(&t, &c)
			byType[t] = c
		}
		rows.Close()
	}

	bySev := map[string]int{"critical": 0, "high": 0, "medium": 0, "low": 0}
	rows2, err := db.Query(`SELECT severity, COUNT(*) FROM alerts GROUP BY severity`)
	if err == nil {
		for rows2.Next() {
			var s string
			var c int
			_ = rows2.Scan(&s, &c)
			bySev[s] = c
		}
		rows2.Close()
	}

	uptime := formatUptime(time.Since(startedAt))

	return map[string]interface{}{
		"total_sensors":        totalSensors,
		"active_alerts":        activeAlerts,
		"critical_alerts":      criticalAlerts,
		"total_readings_today": readingsToday,
		"alerts_by_type":       byType,
		"alerts_by_severity":   bySev,
		"system_uptime":        uptime,
		"kafka_lag":            0,
		"generated_at":         time.Now().UTC(),
	}, nil
}
