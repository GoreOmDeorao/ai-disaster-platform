import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchSensors, fetchShelters, fetchAlerts } from '../services/api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl:       require('leaflet/dist/images/marker-icon.png'),
  shadowUrl:     require('leaflet/dist/images/marker-shadow.png'),
});

const TYPE_COLORS = { flood:'#0080ff', seismic:'#ff6b35', fire:'#ff2d55', gas:'#bf5af2' };
const TYPE_EMOJI  = { flood:'🌊', seismic:'🌍', fire:'🔥', gas:'☣️' };
const TYPE_BG     = { flood:'#003080', seismic:'#7a2800', fire:'#7a0020', gas:'#4a006a' };

// Build a colored SVG pin icon for each sensor type
function makePinIcon(color, hot) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">
    <filter id="glow">
      <feGaussianBlur stdDeviation="${hot?3:1.5}" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <path filter="url(#glow)"
      d="M14 1C7.4 1 2 6.4 2 13c0 9 12 24 12 24s12-15 12-24C26 6.4 20.6 1 14 1z"
      fill="${color}" stroke="${hot?'#fff':'rgba(255,255,255,0.4)'}" stroke-width="${hot?2:1}"/>
    <circle cx="14" cy="13" r="5" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -38],
  });
}

function shelterIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
    <circle cx="11" cy="11" r="10" fill="#00ff88" opacity="0.9" stroke="white" stroke-width="1.5"/>
    <text x="11" y="15" text-anchor="middle" font-size="11" fill="#000">⛺</text>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -14] });
}

function FlyTo({ pos }) {
  const map = useMap();
  useEffect(() => {
    if (!pos || !Array.isArray(pos)) return;
    map.flyTo(pos, 9, { duration: 0.9 });
  }, [pos, map]);
  return null;
}

export default function SensorMap() {
  const [sensors,  setSensors]  = useState([]);
  const [shelters, setShelters] = useState([]);
  const [alerts,   setAlerts]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState(null);
  const [types,    setTypes]    = useState({ flood:true, seismic:true, fire:true, gas:true });
  const [showSensors,  setShowSensors]  = useState(true);
  const [showShelters, setShowShelters] = useState(true);
  const [showZones,    setShowZones]    = useState(true);
  const [flyPos, setFlyPos] = useState(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [s, sh, al] = await Promise.all([fetchSensors(), fetchShelters(), fetchAlerts(100)]);
      setSensors(s); setShelters(sh); setAlerts(al);
    } catch (e) { setErr(e?.message || 'Failed to load map data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const critLocs = useMemo(() => {
    const pts = []; const seen = new Set();
    alerts.filter((a) => a.severity === 'critical' && !a.acknowledged).forEach((a) => {
      let lat = a.latitude, lon = a.longitude;
      if (lat == null || lon == null) {
        const s = sensors.find((x) => x.name === a.sensor_name);
        if (s) { lat = s.latitude; lon = s.longitude; }
      }
      if (lat == null || lon == null) return;
      const k = `${lat},${lon}`;
      if (seen.has(k)) return;
      seen.add(k); pts.push([lat, lon]);
    });
    return pts;
  }, [alerts, sensors]);

  const filteredSensors = sensors.filter((s) =>
    types[s.type] && (search === '' || s.name.toLowerCase().includes(search.toLowerCase()) || s.location?.toLowerCase().includes(search.toLowerCase()))
  );

  const SHELTER_ICON = useMemo(() => shelterIcon(), []);

  if (loading) return (
    <div style={{ padding:40 }}>
      <div className="skeleton-line" style={{ height:16, width:'40%', marginBottom:12 }} />
      <div className="skeleton-line" style={{ height:400 }} />
    </div>
  );

  return (
    <div style={{ animation:'fade-in-up 0.25s ease' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <h1 style={{ fontFamily:'Exo 2,sans-serif', fontSize:26, margin:0 }}>Sensor network — India</h1>
        <div style={{ fontSize:12, color:'#7a9ab8' }}>
          {sensors.length} sensors · {shelters.length} shelters · {critLocs.length} critical zones
        </div>
      </div>

      {err && (
        <div style={{ color:'#ff6b6b', marginBottom:8, padding:'8px 12px', background:'rgba(255,45,85,0.1)', borderRadius:8 }}>
          {err} <button type="button" onClick={load} style={{ color:'#00d4ff', marginLeft:8 }}>Retry</button>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 260px', gap:14 }} className="sensor-map-layout">

        {/* ── Map ── */}
        <div style={{ position:'relative', borderRadius:12, overflow:'hidden', border:'1px solid rgba(0,212,255,0.12)', height:'72vh', minHeight:420 }}>

          {/* Layer control */}
          <div style={{
            position:'absolute', zIndex:1000, top:12, right:12,
            background:'rgba(2,4,8,0.92)', border:'1px solid rgba(0,212,255,0.2)',
            borderRadius:10, padding:12, width:170, fontSize:11, color:'#e8f4f8',
          }}>
            <div style={{ fontWeight:700, marginBottom:8, color:'#00d4ff', letterSpacing:1 }}>Layers</div>
            {['flood','seismic','fire','gas'].map((t) => (
              <label key={t} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5, cursor:'pointer' }}>
                <input type="checkbox" checked={types[t]} onChange={() => setTypes((x) => ({ ...x, [t]:!x[t] }))} />
                <span style={{ color:TYPE_COLORS[t], fontSize:14 }}>●</span>
                <span style={{ textTransform:'capitalize' }}>{t}</span>
              </label>
            ))}
            <div style={{ borderTop:'1px solid rgba(0,212,255,0.1)', marginTop:8, paddingTop:8 }}>
              <label style={{ display:'flex', gap:6, marginBottom:5, cursor:'pointer' }}>
                <input type="checkbox" checked={showSensors} onChange={(e) => setShowSensors(e.target.checked)} /> Sensors
              </label>
              <label style={{ display:'flex', gap:6, marginBottom:5, cursor:'pointer' }}>
                <input type="checkbox" checked={showShelters} onChange={(e) => setShowShelters(e.target.checked)} />
                <span style={{ color:'#00ff88' }}>⛺</span> Shelters
              </label>
              <label style={{ display:'flex', gap:6, cursor:'pointer' }}>
                <input type="checkbox" checked={showZones} onChange={(e) => setShowZones(e.target.checked)} /> Alert zones
              </label>
            </div>
            <div style={{ marginTop:10, borderTop:'1px solid rgba(0,212,255,0.1)', paddingTop:8 }}>
              <div style={{ marginBottom:4, color:'#7a9ab8' }}>Legend</div>
              {Object.entries(TYPE_COLORS).map(([t,c]) => (
                <div key={t} style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:c }} />
                  <span style={{ textTransform:'capitalize', fontSize:10 }}>{t}</span>
                </div>
              ))}
              <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:3 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:'#00ff88' }} />
                <span style={{ fontSize:10 }}>Shelter</span>
              </div>
            </div>
          </div>

          <MapContainer center={[22,80]} zoom={5} style={{ height:'100%', width:'100%', background:'#020408' }}>
            <FlyTo pos={flyPos} />
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="© OSM © CARTO" />

            {/* Critical alert zones */}
            {showZones && critLocs.map((center, i) => (
              <Circle key={`z-${i}`} center={center} radius={80000}
                pathOptions={{ color:'#ff2d55', fillColor:'#ff2d55', fillOpacity:0.08, weight:1.5, dashArray:'6 4' }} />
            ))}

            {/* Sensor markers — color coded by type */}
            {showSensors && filteredSensors.map((sensor) => {
              const hot = alerts.some((a) => a.sensor_name === sensor.name && a.severity === 'critical' && !a.acknowledged);
              const color = TYPE_COLORS[sensor.type] || '#ffffff';
              const icon = makePinIcon(color, hot);
              return (
                <React.Fragment key={sensor.id}>
                  {/* Pulse ring for active sensor */}
                  <Circle center={[sensor.latitude, sensor.longitude]}
                    radius={hot ? 130000 : 55000}
                    pathOptions={{ color, fillColor:color, fillOpacity: hot ? 0.10 : 0.04, weight: hot ? 1.5 : 0.8 }} />
                  <Marker position={[sensor.latitude, sensor.longitude]} icon={icon}>
                    <Popup>
                      <div style={{ fontFamily:'Exo 2,sans-serif', minWidth:180 }}>
                        <div style={{ fontSize:15, fontWeight:700, color: TYPE_COLORS[sensor.type] }}>
                          {TYPE_EMOJI[sensor.type]} {sensor.name}
                        </div>
                        <div style={{ fontSize:12, color:'#555', marginTop:3 }}>{sensor.location}</div>
                        <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                          <div style={{ padding:'6px 8px', background: TYPE_BG[sensor.type]||'#111', borderRadius:6, fontSize:11, textAlign:'center', color:'#fff' }}>
                            Type<br/><strong style={{ color: TYPE_COLORS[sensor.type] }}>{sensor.type.toUpperCase()}</strong>
                          </div>
                          <div style={{ padding:'6px 8px', background:'#111', borderRadius:6, fontSize:11, textAlign:'center', color:'#fff' }}>
                            Status<br/><strong style={{ color: sensor.status==='active'?'#00ff88':'#ff6b6b' }}>{sensor.status}</strong>
                          </div>
                        </div>
                        <div style={{ marginTop:8, fontSize:11, color:'#555' }}>
                          📍 {sensor.latitude.toFixed(4)}, {sensor.longitude.toFixed(4)}
                        </div>
                        {hot && (
                          <div style={{ marginTop:6, padding:'4px 8px', background:'rgba(255,45,85,0.15)', borderRadius:6, fontSize:11, color:'#ff2d55', fontWeight:700 }}>
                            ⚠️ CRITICAL ALERT ACTIVE
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                </React.Fragment>
              );
            })}

            {/* Shelter markers */}
            {showShelters && shelters.map((sh) => (
              <Marker key={sh.id} position={[sh.latitude, sh.longitude]} icon={SHELTER_ICON}>
                <Popup>
                  <div style={{ fontFamily:'Exo 2,sans-serif', minWidth:200 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#00ff88' }}>⛺ {sh.name}</div>
                    <div style={{ fontSize:12, color:'#555', marginTop:2 }}>{sh.address}</div>
                    <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                      <div style={{ padding:'6px 8px', background:'#0a2a0a', borderRadius:6, fontSize:11, textAlign:'center', color:'#fff' }}>
                        Capacity<br/><strong style={{ color:'#00ff88' }}>{sh.capacity.toLocaleString()}</strong>
                      </div>
                      <div style={{ padding:'6px 8px', background:'#0a2a0a', borderRadius:6, fontSize:11, textAlign:'center', color:'#fff' }}>
                        Type<br/><strong style={{ color:'#00ff88', textTransform:'capitalize' }}>{sh.type}</strong>
                      </div>
                    </div>
                    <div style={{ marginTop:8, fontSize:12, color:'#333', background:'#f0f9f0', padding:'4px 8px', borderRadius:6 }}>
                      📞 <a href={`tel:${sh.contact}`} style={{ color:'#006600' }}>{sh.contact}</a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* ── Nodes panel ── */}
        <div style={{ background:'linear-gradient(180deg,#0d1f35,#061018)', border:'1px solid rgba(0,212,255,0.1)', borderRadius:12, padding:10, overflowY:'auto', maxHeight:'72vh', display:'flex', flexDirection:'column' }}>
          <div style={{ fontFamily:'Exo 2,sans-serif', color:'#00d4ff', marginBottom:8, fontWeight:700 }}>Nodes</div>

          {/* Search */}
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sensor…"
            style={{ width:'100%', background:'#020408', border:'1px solid rgba(0,212,255,0.15)', borderRadius:6, color:'#e8f4f8', padding:'6px 8px', fontSize:11, marginBottom:8, boxSizing:'border-box' }} />

          {/* Stats row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:10 }}>
            {Object.entries(TYPE_COLORS).map(([t,c]) => {
              const count = sensors.filter(s=>s.type===t).length;
              const hotCount = sensors.filter(s=>s.type===t && alerts.some(a=>a.sensor_name===s.name&&a.severity==='critical'&&!a.acknowledged)).length;
              return (
                <div key={t} style={{ padding:'6px 8px', borderRadius:8, background:`${c}15`, border:`1px solid ${c}33`, fontSize:10 }}>
                  <div style={{ color:c, fontWeight:700, textTransform:'capitalize' }}>{TYPE_EMOJI[t]} {t}</div>
                  <div style={{ color:'#e8f4f8' }}>{count} sensor{count!==1?'s':''}</div>
                  {hotCount > 0 && <div style={{ color:'#ff2d55', fontSize:9 }}>⚠️ {hotCount} critical</div>}
                </div>
              );
            })}
          </div>

          {/* Sensor list */}
          <div style={{ fontSize:10, color:'#7a9ab8', marginBottom:6, letterSpacing:1 }}>SENSORS ({filteredSensors.length})</div>
          {filteredSensors.map((s) => {
            const hot = alerts.some((a) => a.sensor_name === s.name && a.severity === 'critical' && !a.acknowledged);
            return (
              <button type="button" key={s.id} onClick={() => setFlyPos([s.latitude, s.longitude])}
                style={{
                  display:'block', width:'100%', textAlign:'left', marginBottom:5,
                  padding:'7px 9px', borderRadius:8, cursor:'pointer', fontSize:11, color:'#e8f4f8',
                  border: hot ? `1px solid ${TYPE_COLORS[s.type]}` : `1px solid ${TYPE_COLORS[s.type]}33`,
                  background: hot ? `${TYPE_COLORS[s.type]}18` : 'rgba(2,4,8,0.6)',
                }}>
                <span style={{ color: TYPE_COLORS[s.type] }}>{TYPE_EMOJI[s.type]}</span> {s.name}
                {hot && <span style={{ float:'right', color:'#ff2d55', fontSize:9 }}>⚠️ CRIT</span>}
                <div style={{ fontSize:10, color:'#7a9ab8', marginTop:2 }}>{s.location}</div>
              </button>
            );
          })}

          {/* Shelter list */}
          <div style={{ fontSize:10, color:'#7a9ab8', marginTop:12, marginBottom:6, letterSpacing:1 }}>SHELTERS ({shelters.length})</div>
          {shelters.slice(0,8).map((sh) => (
            <button type="button" key={sh.id} onClick={() => setFlyPos([sh.latitude, sh.longitude])}
              style={{
                display:'block', width:'100%', textAlign:'left', marginBottom:5,
                padding:'7px 9px', borderRadius:8, cursor:'pointer', fontSize:11,
                border:'1px solid #00ff8833', background:'rgba(0,255,136,0.04)', color:'#e8f4f8',
              }}>
              <span style={{ color:'#00ff88' }}>⛺</span> {sh.name}
              <div style={{ fontSize:10, color:'#7a9ab8', marginTop:2 }}>{sh.city} · cap {sh.capacity.toLocaleString()}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
