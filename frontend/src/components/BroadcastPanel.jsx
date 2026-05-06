import React, { useCallback, useEffect, useState } from 'react';
import { sendBroadcast, fetchBroadcasts, deactivateBroadcast, fetchShelters } from '../services/api';
import { useToast } from './ToastNotification';

const CITIES = ['Mumbai','Delhi','Chennai','Kolkata','Bhopal','Guwahati','Visakhapatnam','Bhuj','Jaipur','Hyderabad','Nagpur','Bhubaneswar'];

export default function BroadcastPanel() {
  const toast = useToast();
  const [title, setTitle]           = useState('');
  const [message, setMessage]       = useState('');
  const [severity, setSeverity]     = useState('info');
  const [disasterType, setDisaster] = useState('flood');
  const [chips, setChips]           = useState([]);
  const [expiresIn, setExpires]     = useState('6h');
  const [shelterPick, setPickS]     = useState([]);
  const [phones, setPhones]         = useState('');
  const [shelters, setShelters]     = useState([]);
  const [list, setList]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [err, setErr]               = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [b, sh] = await Promise.all([fetchBroadcasts(), fetchShelters()]);
      setList(b); setShelters(sh);
    } catch (e) { setErr(e?.message || 'Load failed'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleChip = (c) =>
    setChips((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));

  const send = async () => {
    if (!title.trim() || !message.trim()) {
      toast.push({ type: 'warning', title: 'Missing fields', message: 'Title and message required.' });
      return;
    }
    if (!window.confirm('This will alert all connected dashboards. Confirm broadcast?')) return;
    const picked = shelters.filter((s) => shelterPick.includes(s.id));
    const phoneList = phones.split(/[\n,]+/).map((p) => p.trim()).filter(Boolean);
    try {
      await sendBroadcast({
        title, message, severity,
        disaster_type: disasterType,
        affected_areas: chips,
        shelter_locations: picked.length
          ? { shelters: picked.map((s) => ({ name: s.name, address: s.address, contact: s.contact })) }
          : {},
        contact_phones: phoneList,
        expires_in: expiresIn,
        created_by: 'operator',
      });
      toast.push({ type: 'info', title: 'Broadcast sent', message: title });
      setTitle(''); setMessage(''); setPhones(''); setChips([]); setPickS([]);
      load();
    } catch (e) {
      toast.push({ type: 'critical', title: 'Failed', message: e?.message || 'Error' });
    }
  };

  const deactivate = async (id) => {
    if (!window.confirm('Deactivate this broadcast?')) return;
    try { await deactivateBroadcast(id); load(); }
    catch (e) { toast.push({ type: 'warning', title: 'Failed', message: e?.message }); }
  };

  const exportCsv = () => {
    const rows = [['id','title','severity','created_at'],
      ...list.map((b) => [b.id, b.title, b.severity, b.created_at])];
    const csv = rows.map((r) => r.map((c) => `"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'broadcasts.csv'; a.click();
  };

  const sevColor = { info:'#00d4ff', warning:'#ffd700', critical:'#ff2d55', emergency:'#ff2d55' };

  if (loading) return <div style={{ padding: 40, color: '#7a9ab8' }}>Loading…</div>;

  return (
    <div style={{ animation: 'fade-in-up 0.25s ease' }}>
      <h1 style={{ fontFamily:'Exo 2,sans-serif', fontSize:26, marginBottom:8 }}>Emergency broadcasts</h1>
      {err && <div style={{ color:'#ff6b6b', marginBottom:12 }}>{err} <button type="button" onClick={load} style={{ color:'#00d4ff' }}>Retry</button></div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))', gap:20 }}>

        {/* ── Send form ── */}
        <div style={card}>
          <h3 style={{ fontFamily:'Exo 2,sans-serif', marginBottom:12 }}>Send broadcast</h3>

          <label style={lab}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={inp} placeholder="e.g. Flood Warning — Mumbai" />

          <label style={lab}>Message</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} style={inp} maxLength={2000} placeholder="Describe the situation and instructions clearly…" />
          <div style={{ textAlign:'right', fontSize:11, color:'#7a9ab8' }}>{message.length}/2000</div>

          <label style={lab}>Severity</label>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={inp}>
            <option value="info">INFO</option>
            <option value="warning">WARNING</option>
            <option value="critical">CRITICAL</option>
            <option value="emergency">EMERGENCY</option>
          </select>

          <label style={lab}>Disaster type</label>
          <select value={disasterType} onChange={(e) => setDisaster(e.target.value)} style={inp}>
            <option value="flood">🌊 Flood</option>
            <option value="seismic">🌍 Seismic</option>
            <option value="fire">🔥 Fire</option>
            <option value="gas">☣️ Gas</option>
          </select>

          <label style={lab}>Affected areas</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {CITIES.map((c) => (
              <button type="button" key={c} onClick={() => toggleChip(c)} style={{
                padding:'4px 10px', borderRadius:20, cursor:'pointer', fontSize:11,
                border: chips.includes(c) ? '1px solid #00d4ff' : '1px solid rgba(0,212,255,0.15)',
                background: chips.includes(c) ? 'rgba(0,212,255,0.15)' : 'transparent',
                color:'#e8f4f8',
              }}>{c}</button>
            ))}
          </div>

          <label style={lab}>📞 Emergency contact numbers <span style={{ color:'#555', fontWeight:400 }}>(one per line or comma-separated)</span></label>
          <textarea
            value={phones}
            onChange={(e) => setPhones(e.target.value)}
            rows={3}
            style={{ ...inp, fontFamily:'Share Tech Mono,monospace' }}
            placeholder={"+91-11-23379000\n+91-22-26592000\n1078 (NDRF helpline)"}
          />
          <div style={{ fontSize:11, color:'#7a9ab8', marginTop:3 }}>
            {phones.split(/[\n,]+/).map(p=>p.trim()).filter(Boolean).length} number(s) entered
          </div>

          <label style={lab}>Nearest shelters (hold Ctrl/Cmd to multi-select)</label>
          <select multiple value={shelterPick}
            onChange={(e) => setPickS([...e.target.selectedOptions].map((o) => o.value))}
            style={{ ...inp, height:110 }}>
            {shelters.map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {s.city} (cap {s.capacity})</option>
            ))}
          </select>

          <label style={lab}>Expires after</label>
          <select value={expiresIn} onChange={(e) => setExpires(e.target.value)} style={inp}>
            <option value="1h">1 hour</option>
            <option value="6h">6 hours</option>
            <option value="24h">24 hours</option>
          </select>

          {/* Preview */}
          <div style={{ marginTop:12, padding:12, background:'#020408', borderRadius:8, fontSize:12, color:'#7a9ab8', border:'1px solid rgba(0,212,255,0.08)' }}>
            <strong style={{ color:'#00d4ff' }}>Preview</strong>
            <div style={{ marginTop:6, color: sevColor[severity] || '#fff', fontWeight:700 }}>[{severity.toUpperCase()}] {title || '(title)'}</div>
            <div style={{ marginTop:4 }}>{message || '(message)'}</div>
            {chips.length > 0 && <div style={{ marginTop:4, color:'#7a9ab8' }}>Areas: {chips.join(', ')}</div>}
            {phones.split(/[\n,]+/).map(p=>p.trim()).filter(Boolean).length > 0 && (
              <div style={{ marginTop:4, color:'#00ff88' }}>
                📞 {phones.split(/[\n,]+/).map(p=>p.trim()).filter(Boolean).join(' · ')}
              </div>
            )}
          </div>

          <button type="button" onClick={send} style={{ ...btnSend, marginTop:14, width:'100%' }}>
            📡 SEND BROADCAST
          </button>
        </div>

        {/* ── History ── */}
        <div style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h3 style={{ fontFamily:'Exo 2,sans-serif' }}>History</h3>
            <button type="button" onClick={exportCsv} style={btnGhost}>Export CSV</button>
          </div>
          {list.length === 0 && <div style={{ color:'#7a9ab8', fontSize:13 }}>No broadcasts yet.</div>}
          <div style={{ overflowY:'auto', maxHeight:500 }}>
            {list.map((b) => (
              <div key={b.id} style={{
                marginBottom:10, padding:12, borderRadius:10,
                border:`1px solid ${sevColor[b.severity]||'rgba(0,212,255,0.1)'}33`,
                background:'rgba(2,4,8,0.5)',
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <span style={{ fontSize:10, fontWeight:700, color: sevColor[b.severity]||'#00d4ff',
                      background:`${sevColor[b.severity]||'#00d4ff'}22`, padding:'2px 8px', borderRadius:20 }}>
                      {b.severity?.toUpperCase()}
                    </span>
                    <span style={{ marginLeft:8, fontSize:13, fontWeight:600, color:'#e8f4f8' }}>{b.title}</span>
                  </div>
                  {b.is_active && (
                    <button type="button" onClick={() => deactivate(b.id)} style={btnGhost}>Deactivate</button>
                  )}
                </div>
                <div style={{ fontSize:12, color:'#7a9ab8', marginTop:6 }}>{b.message?.slice(0,120)}{b.message?.length>120?'…':''}</div>
                {b.affected_areas?.length > 0 && (
                  <div style={{ fontSize:11, color:'#00d4ff', marginTop:4 }}>📍 {b.affected_areas.join(', ')}</div>
                )}
                <div style={{ fontSize:11, color:'#555', marginTop:4 }}>
                  {b.is_active ? '🟢 Active' : '⚫ Inactive'} · {new Date(b.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const card    = { background:'linear-gradient(135deg,#0d1f35,#0a1628)', border:'1px solid rgba(0,212,255,0.1)', borderRadius:12, padding:20 };
const lab     = { display:'block', fontSize:11, color:'#7a9ab8', marginTop:12, marginBottom:4 };
const inp     = { width:'100%', background:'#020408', border:'1px solid rgba(0,212,255,0.2)', borderRadius:8, color:'#e8f4f8', padding:'8px 10px', fontFamily:'Share Tech Mono,monospace', fontSize:12, boxSizing:'border-box' };
const btnSend = { padding:'12px 18px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#ff2d55,#ff6b35)', color:'#fff', fontWeight:800, cursor:'pointer', fontSize:13 };
const btnGhost= { padding:'6px 10px', borderRadius:6, border:'1px solid rgba(0,212,255,0.25)', background:'transparent', color:'#00d4ff', cursor:'pointer', fontSize:11 };
