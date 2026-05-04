import React, { useCallback, useEffect, useState } from 'react';
import {
  sendBroadcast,
  fetchBroadcasts,
  deactivateBroadcast,
  fetchShelters,
} from '../services/api';
import { useToast } from './ToastNotification';

const CITIES = ['Mumbai', 'Delhi', 'Chennai', 'Kolkata', 'Bhopal', 'Guwahati', 'Visakhapatnam', 'Bhuj'];

export default function BroadcastPanel() {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('info');
  const [disasterType, setDisasterType] = useState('flood');
  const [chips, setChips] = useState([]);
  const [expiresIn, setExpiresIn] = useState('6h');
  const [shelterPick, setShelterPick] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [b, sh] = await Promise.all([fetchBroadcasts(), fetchShelters()]);
      setList(b);
      setShelters(sh);
    } catch (e) {
      setErr(e?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleChip = (c) => {
    setChips((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));
  };

  const send = async () => {
    if (!title.trim() || !message.trim()) {
      toast.push({ type: 'warning', title: 'Missing fields', message: 'Title and message required.' });
      return;
    }
    if (!window.confirm('This will alert all connected dashboards. Confirm broadcast?')) return;
    const picked = shelters.filter((s) => shelterPick.includes(s.id));
    try {
      await sendBroadcast({
        title,
        message,
        severity,
        disaster_type: disasterType,
        affected_areas: chips,
        shelter_locations: picked,
        expires_in: expiresIn,
        created_by: 'operator',
      });
      toast.push({ type: 'info', title: 'Broadcast queued', message: title });
      setTitle('');
      setMessage('');
      load();
    } catch (e) {
      toast.push({ type: 'critical', title: 'Failed', message: e?.message || 'Error' });
    }
  };

  const deactivate = async (id) => {
    if (!window.confirm('Deactivate this broadcast?')) return;
    try {
      await deactivateBroadcast(id);
      load();
    } catch (e) {
      toast.push({ type: 'warning', title: 'Deactivate failed', message: e?.message });
    }
  };

  const exportCsv = () => {
    const rows = [['id', 'title', 'severity', 'created_at'], ...list.map((b) => [b.id, b.title, b.severity, b.created_at])];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'broadcasts.csv';
    a.click();
  };

  if (loading) {
    return (
      <div style={{ padding: 40, color: '#7a9ab8' }}>
        <div className="skeleton-line" style={{ height: 14, marginBottom: 10 }} />
        <div className="skeleton-line" style={{ height: 14, width: '70%' }} />
      </div>
    );
  }

  return (
    <div style={{ animation: 'fade-in-up 0.25s ease' }}>
      <h1 style={{ fontFamily: 'Exo 2,sans-serif', fontSize: 26, marginBottom: 8 }}>Emergency broadcasts</h1>
      {err && (
        <div style={{ color: '#ff6b6b', marginBottom: 12 }}>
          {err}{' '}
          <button type="button" onClick={load} style={{ color: '#00d4ff' }}>
            Retry
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20 }}>
        <div style={card}>
          <h3 style={{ fontFamily: 'Exo 2,sans-serif', marginBottom: 12 }}>Send broadcast</h3>
          <label style={lab}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={inp} />
          <label style={lab}>Message</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} style={inp} maxLength={2000} />
          <div style={{ textAlign: 'right', fontSize: 11, color: '#7a9ab8' }}>{message.length}/2000</div>
          <label style={lab}>Severity</label>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={inp}>
            <option value="info">INFO</option>
            <option value="warning">WARNING</option>
            <option value="critical">CRITICAL</option>
            <option value="emergency">EMERGENCY</option>
          </select>
          <label style={lab}>Disaster type</label>
          <select value={disasterType} onChange={(e) => setDisasterType(e.target.value)} style={inp}>
            <option value="flood">flood</option>
            <option value="seismic">seismic</option>
            <option value="fire">fire</option>
            <option value="gas">gas</option>
          </select>
          <label style={lab}>Affected areas</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CITIES.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => toggleChip(c)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  border: chips.includes(c) ? '1px solid #00d4ff' : '1px solid rgba(0,212,255,0.15)',
                  background: chips.includes(c) ? 'rgba(0,212,255,0.15)' : 'transparent',
                  color: '#e8f4f8',
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                {c}
              </button>
            ))}
          </div>
          <label style={lab}>Nearest shelters (multi)</label>
          <select
            multiple
            value={shelterPick}
            onChange={(e) => setShelterPick([...e.target.selectedOptions].map((o) => o.value))}
            style={{ ...inp, height: 120 }}
          >
            {shelters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.city}
              </option>
            ))}
          </select>
          <label style={lab}>Expires</label>
          <select value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)} style={inp}>
            <option value="1h">1 hour</option>
            <option value="6h">6 hours</option>
            <option value="24h">24 hours</option>
          </select>
          <div style={{ marginTop: 12, padding: 12, background: '#020408', borderRadius: 8, fontSize: 12, color: '#7a9ab8' }}>
            <strong style={{ color: '#00d4ff' }}>Preview</strong>
            <div style={{ marginTop: 6 }}>{title || '(title)'}</div>
            <div style={{ marginTop: 4 }}>{message || '(message)'}</div>
          </div>
          <button type="button" onClick={send} style={{ ...btnSend, marginTop: 14, width: '100%' }}>
            SEND BROADCAST
          </button>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: 'Exo 2,sans-serif' }}>History</h3>
            <button type="button" onClick={exportCsv} style={btnGhost}>
              Export CSV
            </button>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: '#7a9ab8', textAlign: 'left' }}>
                  <th style={th}>Sev</th>
                  <th style={th}>Title</th>
                  <th style={th}>Active</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.id} style={{ borderTop: '1px solid rgba(0,212,255,0.08)' }}>
                    <td style={td}>{b.severity}</td>
                    <td style={td}>{b.title}</td>
                    <td style={td}>{b.is_active ? 'yes' : 'no'}</td>
                    <td style={td}>
                      {b.is_active && (
                        <button type="button" onClick={() => deactivate(b.id)} style={btnGhost}>
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const card = {
  background: 'linear-gradient(135deg,#0d1f35,#0a1628)',
  border: '1px solid rgba(0,212,255,0.1)',
  borderRadius: 12,
  padding: 20,
};
const lab = { display: 'block', fontSize: 11, color: '#7a9ab8', marginTop: 10, marginBottom: 4 };
const inp = {
  width: '100%',
  background: '#020408',
  border: '1px solid rgba(0,212,255,0.2)',
  borderRadius: 8,
  color: '#e8f4f8',
  padding: '8px 10px',
  fontFamily: 'Share Tech Mono,monospace',
  fontSize: 12,
};
const btnSend = {
  padding: '12px 18px',
  borderRadius: 8,
  border: 'none',
  background: 'linear-gradient(135deg,#ff2d55,#ff6b35)',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
};
const btnGhost = {
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid rgba(0,212,255,0.25)',
  background: 'transparent',
  color: '#00d4ff',
  cursor: 'pointer',
  fontSize: 11,
};
const th = { padding: '8px 6px' };
const td = { padding: '8px 6px', verticalAlign: 'middle' };
