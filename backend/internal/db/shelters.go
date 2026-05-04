package db

import (
	"database/sql"
	"math"
)

const earthRadiusKm = 6371.0

func haversineKm(lat1, lon1, lat2, lon2 float64) float64 {
	p1 := lat1 * math.Pi / 180
	p2 := lat2 * math.Pi / 180
	d := (lat2 - lat1) * math.Pi / 180
	dl := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(d/2)*math.Sin(d/2) + math.Cos(p1)*math.Cos(p2)*math.Sin(dl/2)*math.Sin(dl/2)
	return 2 * earthRadiusKm * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

func ListShelters(db *sql.DB) ([]map[string]interface{}, error) {
	rows, err := db.Query(`
		SELECT id, name, address, city, latitude::float8, longitude::float8, capacity, type, contact, is_active
		FROM shelters WHERE is_active = true ORDER BY city, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id, name, addr, city, typ, contact string
		var lat, lon float64
		var cap int
		var active bool
		if err := rows.Scan(&id, &name, &addr, &city, &lat, &lon, &cap, &typ, &contact, &active); err != nil {
			return nil, err
		}
		list = append(list, map[string]interface{}{
			"id": id, "name": name, "address": addr, "city": city,
			"latitude": lat, "longitude": lon, "capacity": cap, "type": typ, "contact": contact, "is_active": active,
		})
	}
	return list, rows.Err()
}

func ListSheltersNearby(db *sql.DB, lat, lng, radiusKm float64) ([]map[string]interface{}, error) {
	all, err := ListShelters(db)
	if err != nil {
		return nil, err
	}
	var out []map[string]interface{}
	for _, s := range all {
		slat := s["latitude"].(float64)
		slng := s["longitude"].(float64)
		d := haversineKm(lat, lng, slat, slng)
		if d <= radiusKm {
			cp := map[string]interface{}{}
			for k, v := range s {
				cp[k] = v
			}
			cp["distance_km"] = math.Round(d*100) / 100
			out = append(out, cp)
		}
	}
	return out, nil
}
