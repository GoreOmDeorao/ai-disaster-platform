package db

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/lib/pq"
)

func InsertBroadcast(db *sql.DB, title, message, severity, disasterType string, areas []string, sheltersJSON []byte, expiresAt *time.Time, createdBy string) (string, error) {
	if areas == nil {
		areas = []string{}
	}
	var id string
	err := db.QueryRow(`
		INSERT INTO broadcasts (title, message, severity, disaster_type, affected_areas, shelter_locations, expires_at, created_by)
		VALUES ($1, $2, $3, NULLIF($4,''), $5, COALESCE($6::jsonb, '{}'::jsonb), $7, $8)
		RETURNING id`,
		title, message, severity, disasterType, pq.Array(areas), string(sheltersJSON), expiresAt, createdBy,
	).Scan(&id)
	return id, err
}

func ListActiveBroadcasts(db *sql.DB) ([]map[string]interface{}, error) {
	rows, err := db.Query(`
		SELECT id, title, message, severity, disaster_type, affected_areas, shelter_locations, is_active, expires_at, created_by, created_at
		FROM broadcasts
		WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW())
		ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanBroadcastRows(rows)
}

func ListAllBroadcasts(db *sql.DB, limit int) ([]map[string]interface{}, error) {
	if limit < 1 || limit > 500 {
		limit = 100
	}
	rows, err := db.Query(`
		SELECT id, title, message, severity, disaster_type, affected_areas, shelter_locations, is_active, expires_at, created_by, created_at
		FROM broadcasts
		ORDER BY created_at DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanBroadcastRows(rows)
}

func DeactivateBroadcast(db *sql.DB, id string) (int64, error) {
	res, err := db.Exec(`UPDATE broadcasts SET is_active = false WHERE id = $1`, id)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func scanBroadcastRows(rows *sql.Rows) ([]map[string]interface{}, error) {
	var out []map[string]interface{}
	for rows.Next() {
		var id, title, message, severity, createdBy string
		var disasterType sql.NullString
		var areas pq.StringArray
		var shelterJSON []byte
		var active bool
		var exp sql.NullTime
		var createdAt time.Time
		if err := rows.Scan(&id, &title, &message, &severity, &disasterType, &areas, &shelterJSON, &active, &exp, &createdBy, &createdAt); err != nil {
			return nil, err
		}
		m := map[string]interface{}{
			"id": id, "title": title, "message": message, "severity": severity,
			"affected_areas": []string(areas), "is_active": active, "created_by": createdBy, "created_at": createdAt,
		}
		if disasterType.Valid {
			m["disaster_type"] = disasterType.String
		}
		if len(shelterJSON) > 0 {
			m["shelter_locations"] = json.RawMessage(shelterJSON)
		}
		if exp.Valid {
			m["expires_at"] = exp.Time
		}
		out = append(out, m)
	}
	return out, rows.Err()
}
