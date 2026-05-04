import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchSensors, fetchShelters, fetchAlerts } from '../services/api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const TYPE_COLORS = { flood: '#0080ff', seismic: '#ff6b35', fire: '#ff2d55', gas: '#bf5af2' };
const TYPE_EMOJI = { flood: '🌊', seismic: '🌍', fire: '🔥', gas: '☣️' };

function FlyTo({ pos }) {
  const map = useMap();
  useEffect(() => {
    if (!pos || !Array.isArray(pos)) return;
    map.flyTo(pos, 8, { duration: 0.8 });
  }, [pos, map]);
  return null;
}

export default function SensorMap() {
  const [sensors, setSensors] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [types, setTypes] = useState({ flood: true, seismic: true, fire: true, gas: true });
  const [showSensors, setShowSensors] = useState(true);
  const [showShelters, setShowShelters] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [flyPos, setFlyPos] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [s, sh, al] = await Promise.all([fetchSensors(), fetchShelters(), fetchAlerts(100)]);
      setSensors(s);
      setShelters(sh);
      setAlerts(al);
    } catch (e) {
      setErr(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const critLocs = useMemo(() => {
    const pts = [];
    const seen = new Set();
    alerts
      .filter((a) => a.severity === 'critical' && !a.acknowledged)
      .forEach((a) => {
        let lat = a.latitude;
        let lon = a.longitude;
        if (lat == null || lon == null) {
          const s = sensors.find((x) => x.name === a.sensor_name);
          if (s) {
            lat = s.latitude;
            lon = s.longitude;
          }
        }
        if (lat == null || lon == null) return;
        const k = `${lat},${lon}`;
        if (seen.has(k)) return;
        seen.add(k);
        pts.push([lat, lon]);
      });
    return pts;
  }, [alerts, sensors]);

  const filteredSensors = sensors.filter((s) => types[s.type]);

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        <div className="skeleton-line" style={{ height: 16, width: '40%', marginBottom: 12 }} />
        <div className="skeleton-line" style={{ height: 400 }} />
      </div>
    );
  }

  return (
    <div style={{ animation: 'fade-in-up 0.25s ease' }}>
      <h1 style={{ fontFamily: 'Exo 2,sans-serif', fontSize: 26, marginBottom: 8 }}>Sensor network — India</h1>
      {err && (
        <div style={{ color: '#ff6b6b', marginBottom: 8 }}>
          {err}{' '}
          <button type="button" onClick={load} style={{ color: '#00d4ff' }}>
            Retry
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14 }} className="sensor-map-layout">
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(0,212,255,0.12)', height: '70vh', minHeight: 420 }}>
          <div
            style={{
              position: 'absolute',
              zIndex: 1000,
              top: 12,
              right: 12,
              background: 'rgba(2,4,8,0.9)',
              border: '1px solid rgba(0,212,255,0.2)',
              borderRadius: 10,
              padding: 12,
              maxWidth: 220,
              fontSize: 11,
              color: '#e8f4f8',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8, color: '#00d4ff' }}>Layers</div>
            {['flood', 'seismic', 'fire', 'gas'].map((t) => (
              <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={types[t]} onChange={() => setTypes((x) => ({ ...x, [t]: !x[t] }))} />
                <span style={{ color: TYPE_COLORS[t] }}>●</span> {t}
              </label>
            ))}
            <label style={{ display: 'flex', gap: 6, marginTop: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={showSensors} onChange={(e) => setShowSensors(e.target.checked)} /> Sensors
            </label>
            <label style={{ display: 'flex', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={showShelters} onChange={(e) => setShowShelters(e.target.checked)} /> Shelters
            </label>
            <label style={{ display: 'flex', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={showZones} onChange={(e) => setShowZones(e.target.checked)} /> Alert zones
            </label>
          </div>

          <MapContainer center={[22, 80]} zoom={5} style={{ height: '100%', width: '100%', background: '#020408' }}>
            <FlyTo pos={flyPos} />
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="© OSM © CARTO" />
            {showZones &&
              critLocs.map((center, i) => (
                <Circle key={`z-${i}`} center={center} radius={50000} pathOptions={{ color: '#ff2d55', fillColor: '#ff2d55', fillOpacity: 0.06, weight: 1 }} />
              ))}
            {showSensors &&
              filteredSensors.map((sensor) => {
                const hot = alerts.some((a) => a.sensor_name === sensor.name && a.severity === 'critical' && !a.acknowledged);
                return (
                  <React.Fragment key={sensor.id}>
                    <Circle
                      center={[sensor.latitude, sensor.longitude]}
                      radius={hot ? 120000 : 70000}
                      pathOptions={{ color: TYPE_COLORS[sensor.type], fillOpacity: hot ? 0.12 : 0.05, weight: 1 }}
                    />
                    <Marker position={[sensor.latitude, sensor.longitude]}>
                      <Popup>
                        <div style={{ fontFamily: 'Exo 2,sans-serif' }}>
                          <strong>
                            {TYPE_EMOJI[sensor.type]} {sensor.name}
                          </strong>
                          <div style={{ fontSize: 12 }}>{sensor.location}</div>
                          <div style={{ marginTop: 6, fontSize: 12 }}>Status: {sensor.status}</div>
                        </div>
                      </Popup>
                    </Marker>
                  </React.Fragment>
                );
              })}
            {showShelters &&
              shelters.map((sh) => (
                <CircleMarker key={sh.id} center={[sh.latitude, sh.longitude]} radius={7} pathOptions={{ color: '#00ff88', fillColor: '#00ff88', fillOpacity: 0.9 }}>
                  <Popup>
                    <div style={{ fontSize: 13 }}>
                      <strong>⛺ {sh.name}</strong>
                      <div>Cap {sh.capacity}</div>
                      <div>{sh.contact}</div>
                      <div style={{ fontSize: 12, color: '#555' }}>{sh.address}</div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
          </MapContainer>
        </div>

        <div style={{ background: 'linear-gradient(180deg,#0d1f35,#061018)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: 12, padding: 10, overflowY: 'auto', maxHeight: '70vh' }}>
          <div style={{ fontFamily: 'Exo 2,sans-serif', color: '#00d4ff', marginBottom: 10 }}>Nodes</div>
          {filteredSensors.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => setFlyPos([s.latitude, s.longitude])}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                marginBottom: 8,
                padding: 8,
                borderRadius: 8,
                border: `1px solid ${TYPE_COLORS[s.type]}33`,
                background: 'rgba(2,4,8,0.6)',
                color: '#e8f4f8',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              {TYPE_EMOJI[s.type]} {s.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
