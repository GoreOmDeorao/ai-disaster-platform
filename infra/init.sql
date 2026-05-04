-- AI Disaster Response Platform — PostgreSQL Schema

CREATE TABLE IF NOT EXISTS sensors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  type        VARCHAR(20) NOT NULL CHECK (type IN ('flood','seismic','fire','gas')),
  location    VARCHAR(200) NOT NULL,
  latitude    DECIMAL(9,6) NOT NULL,
  longitude   DECIMAL(9,6) NOT NULL,
  status      VARCHAR(20) DEFAULT 'active',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id   UUID NOT NULL REFERENCES sensors(id),
  value       DECIMAL(12,4) NOT NULL,
  unit        VARCHAR(20) NOT NULL,
  raw_json    JSONB,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_readings_sensor_time ON sensor_readings(sensor_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS alerts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id             UUID NOT NULL REFERENCES sensors(id),
  severity              VARCHAR(20) NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  disaster_type         VARCHAR(30) NOT NULL,
  message               TEXT NOT NULL,
  prediction_confidence DECIMAL(5,4),
  model_used            VARCHAR(50),
  acknowledged          BOOLEAN DEFAULT FALSE,
  acknowledged_by       VARCHAR(100),
  acknowledged_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_created  ON alerts(created_at DESC);

CREATE TABLE IF NOT EXISTS broadcasts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            VARCHAR(200) NOT NULL,
  message          TEXT NOT NULL,
  severity         VARCHAR(20) NOT NULL CHECK (severity IN ('info','warning','critical','emergency')),
  disaster_type    VARCHAR(30),
  affected_areas   TEXT[],
  shelter_locations JSONB,
  is_active        BOOLEAN DEFAULT TRUE,
  expires_at       TIMESTAMPTZ,
  created_by       VARCHAR(100) DEFAULT 'system',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_active ON broadcasts(is_active, expires_at);

CREATE TABLE IF NOT EXISTS shelters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(200) NOT NULL,
  address     TEXT NOT NULL,
  city        VARCHAR(100) NOT NULL,
  latitude    DECIMAL(9,6) NOT NULL,
  longitude   DECIMAL(9,6) NOT NULL,
  capacity    INTEGER DEFAULT 500,
  type        VARCHAR(50) DEFAULT 'general',
  contact     VARCHAR(100),
  is_active   BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_shelters_city ON shelters(city);

CREATE TABLE IF NOT EXISTS sound_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_type VARCHAR(30) NOT NULL,
  severity    VARCHAR(30) NOT NULL,
  location    TEXT NOT NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO sensors (name, type, location, latitude, longitude) VALUES
  ('Flood-Sensor-Mumbai-01',    'flood',   'Mumbai, Maharashtra',  19.0760, 72.8777),
  ('Flood-Sensor-Kolkata-01',   'flood',   'Kolkata, West Bengal', 22.5726, 88.3639),
  ('Seismic-Sensor-Delhi-01',   'seismic', 'New Delhi, Delhi',     28.6139, 77.2090),
  ('Seismic-Sensor-Nepal-01',   'seismic', 'Kathmandu Border',     27.7172, 85.3240),
  ('Fire-Sensor-Chennai-01',    'fire',    'Chennai, Tamil Nadu',  13.0827, 80.2707),
  ('Fire-Sensor-Odisha-01',     'fire',    'Bhubaneswar, Odisha',  20.2961, 85.8245),
  ('Gas-Sensor-Bhopal-01',      'gas',     'Bhopal, MP',           23.2599, 77.4126),
  ('Gas-Sensor-Vizag-01',       'gas',     'Visakhapatnam, AP',    17.6868, 83.2185),
  ('Flood-Sensor-Assam-01',     'flood',   'Guwahati, Assam',      26.1445, 91.7362),
  ('Seismic-Sensor-Gujarat-01', 'seismic', 'Bhuj, Gujarat',        23.2419, 69.6669);

INSERT INTO shelters (name, address, city, latitude, longitude, capacity, type, contact) VALUES
('Dharavi Community Center', 'Dharavi, Mumbai', 'Mumbai', 19.041000, 72.853000, 2000, 'flood', '+91-22-24011234'),
('Bandra Sports Complex', 'Bandra West, Mumbai', 'Mumbai', 19.054000, 72.835000, 1500, 'general', '+91-22-26401234'),
('Rajiv Gandhi Stadium', 'Bawana, Delhi', 'New Delhi', 28.782000, 77.038000, 5000, 'general', '+91-11-27841234'),
('Jawaharlal Nehru Stadium', 'Lodhi Road, Delhi', 'New Delhi', 28.582000, 77.233000, 8000, 'general', '+91-11-24361234'),
('YMCA Ground', 'Nandanam, Chennai', 'Chennai', 13.021000, 80.237000, 1200, 'general', '+91-44-24321234'),
('Island Grounds', 'Chennai', 'Chennai', 13.097000, 80.283000, 10000, 'flood', '+91-44-25361234'),
('Salt Lake Stadium', 'Salt Lake, Kolkata', 'Kolkata', 22.578000, 88.400000, 6000, 'general', '+91-33-23341234'),
('Netaji Indoor Stadium', 'Eden Gardens, Kolkata', 'Kolkata', 22.565000, 88.343000, 3000, 'general', '+91-33-22001234'),
('TT Nagar Stadium', 'TT Nagar, Bhopal', 'Bhopal', 23.234000, 77.401000, 2000, 'gas', '+91-755-2551234'),
('Lal Parade Ground', 'Bhopal', 'Bhopal', 23.263000, 77.408000, 5000, 'general', '+91-755-2741234'),
('Indoor Stadium', 'Sector 6, Guwahati', 'Guwahati', 26.156000, 91.723000, 1500, 'flood', '+91-361-2521234'),
('Nehru Stadium Guwahati', 'Chandmari, Guwahati', 'Guwahati', 26.189000, 91.745000, 3000, 'general', '+91-361-2601234'),
('VUDA Sports Complex', 'MVP Colony, Visakhapatnam', 'Visakhapatnam', 17.738000, 83.228000, 2500, 'gas', '+91-891-2751234'),
('Exhibition Ground', 'Suryabagh, Visakhapatnam', 'Visakhapatnam', 17.694000, 83.204000, 4000, 'general', '+91-891-2561234'),
('Bhuj Community Hall', 'Station Road, Bhuj', 'Bhuj', 23.251000, 69.658000, 800, 'seismic', '+91-2832-221234');
