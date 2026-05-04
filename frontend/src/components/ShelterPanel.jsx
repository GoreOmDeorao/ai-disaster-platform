import React, { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchShelters } from '../services/api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

function loadPct(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h += id.charCodeAt(i);
  return 30 + (h % 55);
}

function colorForLoad(pct) {
  if (pct < 50) return '#00ff88';
  if (pct < 80) return '#ffd60a';
  return '#ff2d55';
}

export default function ShelterPanel() {
  const [shelters, setShelters] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [focus, setFocus] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setShelters(await fetchShelters());
    } catch (e) {
      setErr(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = shelters.filter(
    (s) =>
      !q.trim() ||
      `${s.name} ${s.city} ${s.address}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        <div className="skeleton-line" style={{ height: 14, marginBottom: 10 }} />
        <div className="skeleton-line" style={{ height: 14, width: '60%' }} />
      </div>
    );
  }

  return (
    <div className="shelter-grid-layout" style={{ minHeight: 520 }}>
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(0,212,255,0.12)', minHeight: 480 }}>
        <MapContainer center={[22, 80]} zoom={5} style={{ height: '100%', minHeight: 480, background: '#020408' }}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="© OSM © CARTO" />
          {filtered.map((s) => {
            const pct = loadPct(s.id);
            const col = colorForLoad(pct);
            return (
              <CircleMarker
                key={s.id}
                center={[s.latitude, s.longitude]}
                radius={8 + (pct % 6)}
                pathOptions={{ color: col, fillColor: col, fillOpacity: 0.85, weight: 2 }}
                eventHandlers={{ click: () => setFocus(s.id) }}
              >
                <Popup>
                  <div style={{ fontFamily: 'Exo 2,sans-serif', fontSize: 13 }}>
                    <strong>{s.name}</strong>
                    <div style={{ fontSize: 12, color: '#555' }}>{s.address}</div>
                    <div>Capacity: {s.capacity}</div>
                    <div>Simulated load: {pct}%</div>
                    <div>{s.contact}</div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
      <div style={{ background: 'linear-gradient(135deg,#0d1f35,#0a1628)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: 12, padding: 16, overflow: 'auto' }}>
        <h2 style={{ fontFamily: 'Exo 2,sans-serif', marginBottom: 12 }}>Shelter directory</h2>
        <input
          placeholder="Search name, city…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            width: '100%',
            marginBottom: 12,
            padding: 8,
            borderRadius: 8,
            border: '1px solid rgba(0,212,255,0.2)',
            background: '#020408',
            color: '#e8f4f8',
          }}
        />
        {err && (
          <div style={{ color: '#ff6b6b', marginBottom: 8 }}>
            {err}{' '}
            <button type="button" onClick={load} style={{ color: '#00d4ff' }}>
              Retry
            </button>
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: '#7a9ab8', textAlign: 'left' }}>
              <th style={{ padding: 6 }}>Name</th>
              <th style={{ padding: 6 }}>City</th>
              <th style={{ padding: 6 }}>Cap</th>
              <th style={{ padding: 6 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const pct = loadPct(s.id);
              const col = colorForLoad(pct);
              return (
                <tr
                  key={s.id}
                  onClick={() => setFocus(s.id)}
                  style={{
                    borderTop: '1px solid rgba(0,212,255,0.06)',
                    background: focus === s.id ? 'rgba(0,212,255,0.08)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <td style={{ padding: 8, color: '#e8f4f8' }}>{s.name}</td>
                  <td style={{ padding: 8, color: '#7a9ab8' }}>{s.city}</td>
                  <td style={{ padding: 8 }}>{s.capacity}</td>
                  <td style={{ padding: 8, color: col }}>{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
