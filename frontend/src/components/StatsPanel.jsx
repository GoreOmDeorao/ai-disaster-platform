import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { fetchAlerts, fetchSensors, fetchStats } from '../services/api';

const TYPE_COLORS = { flood: '#0080ff', seismic: '#ff6b35', fire: '#ff2d55', gas: '#bf5af2' };
const SEV_COLORS = { critical: '#ff2d55', high: '#ff6b35', medium: '#ffd60a', low: '#00ff88' };
const TYPE_EMOJI = { flood: '🌊', seismic: '🌍', fire: '🔥', gas: '☣️' };

function useCountUp(target, durationMs = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    let id;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setV(Math.round(from + (target - from) * eased));
      if (t < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target, durationMs]);
  return v;
}

const card = (extra = {}) => ({
  background: 'linear-gradient(135deg, #0d1f35 0%, #0a1628 100%)',
  border: '1px solid rgba(0,212,255,0.1)',
  borderRadius: 12,
  padding: 20,
  position: 'relative',
  overflow: 'hidden',
  ...extra,
});

export default function StatsPanel() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [st, a, s] = await Promise.all([fetchStats(), fetchAlerts(100), fetchSensors()]);
      setStats(st);
      setAlerts(a);
      setSensors(s);
    } catch (e) {
      setErr(e?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const cSensors = useCountUp(stats?.total_sensors ?? sensors.length);
  const cAlerts = useCountUp(stats?.active_alerts ?? alerts.filter((x) => !x.acknowledged).length);
  const cCrit = useCountUp(stats?.critical_alerts ?? alerts.filter((x) => x.severity === 'critical' && !x.acknowledged).length);
  const cUnack = useCountUp(alerts.filter((x) => !x.acknowledged).length);

  const byType = useMemo(() => {
    const m = stats?.alerts_by_type || {};
    return ['flood', 'seismic', 'fire', 'gas'].map((t) => ({
      name: t,
      count: m[t] ?? alerts.filter((a) => a.disaster_type === t).length,
      fill: TYPE_COLORS[t],
    }));
  }, [stats, alerts]);

  const bySev = useMemo(() => {
    const m = stats?.alerts_by_severity || {};
    return ['critical', 'high', 'medium', 'low']
      .map((s) => ({ name: s, value: m[s] ?? alerts.filter((a) => a.severity === s).length }))
      .filter((x) => x.value > 0);
  }, [stats, alerts]);

  const lineData = useMemo(() => {
    const raw = stats?.alert_frequency_24h || [];
    return raw.map((p) => ({
      t: new Date(p.hour).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit' }),
      count: p.count,
    }));
  }, [stats]);

  const recent = useMemo(() => alerts.slice(0, 5), [alerts]);

  const timeAgo = (d) => {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    return `${Math.floor(s / 3600)}h ago`;
  };

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div className="skeleton-line" style={{ height: 18, width: '40%', marginBottom: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-line" style={{ height: 100 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fade-in-up 0.25s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Exo 2,sans-serif', fontSize: 28, color: '#e8f4f8', letterSpacing: 2 }}>Operations overview</h1>
          <p style={{ fontFamily: 'Share Tech Mono,monospace', fontSize: 11, color: '#3a5470' }}>Live • 5s refresh • Readings today: {stats?.total_readings_today ?? '—'}</p>
        </div>
        {err && (
          <button type="button" onClick={load} style={{ color: '#ff6b6b', border: '1px solid #ff6b6b', borderRadius: 8, padding: '8px 14px', background: 'transparent' }}>
            Retry
          </button>
        )}
      </div>
      {err && <div style={{ color: '#ff8a8a', marginBottom: 12 }}>{err}</div>}

      <div className="dashboard-stat-grid" style={{ marginBottom: 18 }}>
        <StatCard label="Total sensors" value={cSensors} color="#00d4ff" sub="India mesh" />
        <StatCard label="Active alerts" value={cAlerts} color="#ff6b35" sub="Unacknowledged count" />
        <StatCard label="Critical events" value={cCrit} color="#ff2d55" sub="Immediate action" />
        <StatCard label="Unacknowledged" value={cUnack} color="#ffd60a" sub="Pending review" />
      </div>

      <div className="dashboard-type-row" style={{ marginBottom: 18 }}>
        {['flood', 'seismic', 'fire', 'gas'].map((type) => {
          const sc = sensors.filter((s) => s.type === type).length;
          const ac = alerts.filter((a) => a.disaster_type === type).length;
          return (
            <div key={type} style={{ ...card({ padding: 14 }), borderLeft: `3px solid ${TYPE_COLORS[type]}`, display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 26 }}>{TYPE_EMOJI[type]}</span>
              <div>
                <div style={{ fontFamily: 'Exo 2,sans-serif', fontWeight: 700, color: TYPE_COLORS[type], textTransform: 'uppercase' }}>{type}</div>
                <div style={{ fontFamily: 'Share Tech Mono,monospace', fontSize: 10, color: '#7a9ab8' }}>
                  {sc} sensors • {ac} alerts
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="dashboard-charts-row" style={{ marginBottom: 18 }}>
        <div style={{ ...card(), gridColumn: 'span 1' }}>
          <div style={{ fontFamily: 'Exo 2,sans-serif', color: '#7a9ab8', marginBottom: 10 }}>Alerts by type</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byType}>
              <XAxis dataKey="name" stroke="#3a5470" tick={{ fill: '#7a9ab8', fontSize: 11 }} />
              <YAxis stroke="#3a5470" tick={{ fill: '#3a5470', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#0a1628', border: '1px solid #00d4ff55' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {byType.map((e, i) => (
                  <Cell key={i} fill={e.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={card()}>
          <div style={{ fontFamily: 'Exo 2,sans-serif', color: '#7a9ab8', marginBottom: 10 }}>Severity</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={bySev.length ? bySev : [{ name: 'none', value: 1 }]} innerRadius={50} outerRadius={75} dataKey="value">
                {(bySev.length ? bySev : [{ name: 'low', value: 1 }]).map((e, i) => (
                  <Cell key={i} fill={SEV_COLORS[e.name] || '#3a5470'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={card()}>
          <div style={{ fontFamily: 'Exo 2,sans-serif', color: '#7a9ab8', marginBottom: 10 }}>Alert frequency (24h)</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData.length ? lineData : [{ t: '—', count: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a3350" />
              <XAxis dataKey="t" tick={{ fill: '#5a7394', fontSize: 9 }} interval={3} />
              <YAxis tick={{ fill: '#3a5470', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#0a1628', border: '1px solid #00d4ff44' }} />
              <Line type="monotone" dataKey="count" stroke="#00d4ff" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontFamily: 'Exo 2,sans-serif', color: '#7a9ab8', marginBottom: 12 }}>Recent activity</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recent.length === 0 && <div style={{ color: '#7a9ab8' }}>No recent alerts.</div>}
          {recent.map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,212,255,0.06)', paddingBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700, color: '#e8f4f8' }}>{a.sensor_name}</div>
                <div style={{ fontSize: 12, color: '#7a9ab8' }}>{a.message}</div>
              </div>
              <div style={{ fontFamily: 'Share Tech Mono,monospace', fontSize: 11, color: '#00d4ff' }} title={new Date(a.created_at).toLocaleString()}>
                {timeAgo(a.created_at)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ ...card(), borderTop: `3px solid ${color}`, boxShadow: `0 0 24px ${color}22` }}>
      <div style={{ fontFamily: 'Share Tech Mono,monospace', fontSize: 10, color: '#7a9ab8', letterSpacing: 2 }}>{label}</div>
      <div style={{ fontFamily: 'Exo 2,sans-serif', fontWeight: 800, fontSize: 44, color, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#5a7394', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
