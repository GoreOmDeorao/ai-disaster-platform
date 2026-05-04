import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAlerts, acknowledgeAlert } from '../services/api';

const SEV = {
  critical: { color: '#ff2d55', bg: 'rgba(255,45,85,0.1)', border: 'rgba(255,45,85,0.45)', label: 'CRITICAL' },
  high: { color: '#ff6b35', bg: 'rgba(255,107,53,0.08)', border: 'rgba(255,107,53,0.4)', label: 'HIGH' },
  medium: { color: '#ffd60a', bg: 'rgba(255,214,10,0.06)', border: 'rgba(255,214,10,0.3)', label: 'MEDIUM' },
  low: { color: '#00ff88', bg: 'rgba(0,255,136,0.05)', border: 'rgba(0,255,136,0.25)', label: 'LOW' },
};
const TYPE_EMOJI = { flood: '🌊', seismic: '🌍', fire: '🔥', gas: '☣️' };

const FILTERS = [
  ['all', 'ALL'],
  ['critical', 'CRITICAL'],
  ['high', 'HIGH'],
  ['medium', 'MEDIUM'],
  ['low', 'LOW'],
  ['unacked', 'UNACK'],
];

export default function AlertFeed({ onBroadcastRequest }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState(() => localStorage.getItem('alertFilter') || 'all');
  const [sort, setSort] = useState(() => localStorage.getItem('alertSort') || 'newest');
  const [auto, setAuto] = useState(() => localStorage.getItem('alertAuto') !== '0');
  const [lastUpd, setLastUpd] = useState('--');

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await fetchAlerts(200);
      setAlerts(data);
      setLastUpd(new Date().toLocaleTimeString('en-IN', { hour12: false }));
    } catch {
      setErr('Cannot reach backend');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (!auto) return undefined;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load, auto]);

  useEffect(() => {
    localStorage.setItem('alertFilter', filter);
  }, [filter]);
  useEffect(() => {
    localStorage.setItem('alertSort', sort);
  }, [sort]);
  useEffect(() => {
    localStorage.setItem('alertAuto', auto ? '1' : '0');
  }, [auto]);

  const filtered = useMemo(() => {
    let xs =
      filter === 'all'
        ? alerts
        : filter === 'unacked'
          ? alerts.filter((a) => !a.acknowledged)
          : alerts.filter((a) => a.severity === filter);
    xs = [...xs];
    xs.sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      if (sort === 'oldest') return ta - tb;
      if (sort === 'severity') {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
      }
      return tb - ta;
    });
    return xs;
  }, [alerts, filter, sort]);

  const critN = alerts.filter((a) => a.severity === 'critical' && !a.acknowledged).length;

  const ack = async (a) => {
    if (!window.confirm(`Confirm acknowledgement of ${a.sensor_name}?`)) return;
    try {
      await acknowledgeAlert(a.id);
      setAlerts((xs) => xs.map((x) => (x.id === a.id ? { ...x, acknowledged: true } : x)));
    } catch {
      setErr('Ack failed');
    }
  };

  const exportCsv = () => {
    const rows = [['id', 'sensor', 'severity', 'type', 'message', 'created']];
    filtered.forEach((a) => {
      rows.push([a.id, a.sensor_name, a.severity, a.disaster_type, a.message, a.created_at]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const x = document.createElement('a');
    x.href = URL.createObjectURL(blob);
    x.download = 'alerts.csv';
    x.click();
  };

  const rel = (d) => {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    return `${Math.floor(s / 3600)}h ago`;
  };

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        <div className="skeleton-line" style={{ height: 16, width: '30%', marginBottom: 12 }} />
        <div className="skeleton-line" style={{ height: 80 }} />
      </div>
    );
  }

  return (
    <div style={{ animation: 'fade-in-up 0.25s ease' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontFamily: 'Exo 2,sans-serif', fontSize: 26, margin: 0 }}>🚨 Alert console</h1>
          {critN > 0 && (
            <span
              style={{
                background: '#ff2d55',
                color: '#fff',
                borderRadius: 12,
                padding: '2px 10px',
                fontWeight: 800,
                fontSize: 12,
                animation: 'pulse-dot 1s infinite',
              }}
            >
              {critN}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={exportCsv} style={ghost}>
            Export CSV
          </button>
          <button type="button" onClick={load} style={ghost}>
            ↺ Refresh
          </button>
          <span style={{ fontFamily: 'Share Tech Mono,monospace', fontSize: 11, color: '#7a9ab8' }}>Updated {lastUpd}</span>
          <label style={{ ...ghost, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Auto
          </label>
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={sel}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="severity">Severity</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {FILTERS.map(([k, lab]) => (
          <button
            type="button"
            key={k}
            onClick={() => setFilter(k)}
            style={{
              ...ghost,
              background: filter === k ? 'rgba(0,212,255,0.12)' : 'transparent',
              border: filter === k ? '1px solid #00d4ff66' : '1px solid rgba(0,212,255,0.12)',
              color: filter === k ? '#00d4ff' : '#7a9ab8',
            }}
          >
            {lab}
          </button>
        ))}
      </div>

      {err && <div style={{ color: '#ff6b6b', marginBottom: 12 }}>{err}</div>}

      {filtered.length === 0 && (
        <div style={{ padding: 48, textAlign: 'center', color: '#7a9ab8', border: '1px dashed rgba(0,212,255,0.15)', borderRadius: 12 }}>
          No alerts match filters.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((alert, idx) => {
          const s = SEV[alert.severity] || SEV.low;
          const conf = Number(alert.confidence) || 0;
          return (
            <div
              key={alert.id}
              style={{
                display: 'flex',
                borderRadius: 10,
                overflow: 'hidden',
                border: `1px solid ${alert.acknowledged ? 'rgba(0,212,255,0.06)' : s.border}`,
                background: alert.acknowledged ? 'rgba(10,22,40,0.4)' : s.bg,
                opacity: alert.acknowledged ? 0.55 : 1,
                animation: `slide-in 0.25s ease ${idx * 0.02}s both`,
              }}
            >
              <div style={{ width: 5, background: s.color, flexShrink: 0 }} />
              <div style={{ flex: 1, padding: '14px 16px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 20 }}>{TYPE_EMOJI[alert.disaster_type]}</span>
                  <strong style={{ fontFamily: 'Exo 2,sans-serif', color: '#e8f4f8' }}>{alert.sensor_name}</strong>
                  <span style={{ fontFamily: 'Share Tech Mono,monospace', fontSize: 10, color: s.color, border: `1px solid ${s.color}55`, padding: '2px 8px', borderRadius: 4 }}>{s.label}</span>
                  <span style={{ fontSize: 10, color: '#7a9ab8' }} title={new Date(alert.created_at).toLocaleString()}>
                    🕐 {rel(alert.created_at)}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#7a9ab8', marginBottom: 6 }}>📍 {alert.location}</div>
                <div style={{ fontSize: 14, color: '#c0d8e8', marginBottom: 8 }}>{alert.message}</div>
                <div style={{ height: 6, background: '#0a1628', borderRadius: 4, overflow: 'hidden', maxWidth: 280, marginBottom: 10 }}>
                  <div style={{ width: `${Math.min(100, conf * 100)}%`, height: '100%', background: '#00d4ff' }} />
                </div>
                <div style={{ fontSize: 11, color: '#7a9ab8' }}>ML confidence {(conf * 100).toFixed(1)}%</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, justifyContent: 'center' }}>
                {!alert.acknowledged && (
                  <>
                    <button type="button" onClick={() => ack(alert)} style={ackBtn}>
                      ✓ Acknowledge
                    </button>
                    <button type="button" onClick={() => onBroadcastRequest?.(alert)} style={bcBtn}>
                      🔊 Broadcast
                    </button>
                  </>
                )}
                {alert.acknowledged && <span style={{ color: '#00ff88', fontSize: 12 }}>✓ Acknowledged</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ghost = {
  padding: '8px 12px',
  borderRadius: 8,
  background: 'transparent',
  color: '#00d4ff',
  border: '1px solid rgba(0,212,255,0.25)',
  cursor: 'pointer',
  fontFamily: 'Exo 2,sans-serif',
  fontSize: 12,
};
const sel = { ...ghost, padding: '6px 10px' };
const ackBtn = { ...ghost, borderColor: 'rgba(0,255,136,0.45)', color: '#00ff88', fontWeight: 700 };
const bcBtn = { ...ghost, borderColor: 'rgba(255,45,85,0.45)', color: '#ff6b6b' };
