import React, { useEffect, useState } from 'react';
import { fetchNearbyShelters, sendBroadcast, triggerSoundAlert, API_BASE } from '../services/api';
import { useToast } from './ToastNotification';

export default function BroadcastModal({ alert, onClose, onSent }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('warning');
  const [disasterType, setDisasterType] = useState('');
  const areas = [];
  const [shelters, setShelters] = useState([]);
  const [expiresIn, setExpiresIn] = useState('6h');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!alert) return;
    setTitle(`Alert: ${alert.sensor_name || 'Sensor'}`);
    setMessage(alert.message || '');
    setDisasterType(alert.disaster_type || '');
    setSeverity(alert.severity === 'critical' ? 'critical' : 'warning');
    const lat = alert.latitude;
    const lng = alert.longitude;
    if (lat != null && lng != null) {
      fetchNearbyShelters(lat, lng, 200).then(setShelters).catch(() => setShelters([]));
    } else {
      setShelters([]);
    }
  }, [alert]);

  if (!alert) return null;

  const send = async () => {
    setBusy(true);
    try {
      const shelterPayload = shelters.slice(0, 8).map((s) => ({
        id: s.id,
        name: s.name,
        distance_km: s.distance_km,
        contact: s.contact,
      }));
      await sendBroadcast({
        title,
        message,
        severity,
        disaster_type: disasterType,
        affected_areas: areas,
        shelter_locations: shelterPayload,
        expires_in: expiresIn,
        created_by: 'operator',
      });
      await triggerSoundAlert({
        sensor_type: disasterType || 'broadcast',
        severity,
        location: alert.location || '',
        message: title,
      });
      toast.push({ type: 'info', title: 'Broadcast sent', message: title });
      onSent?.();
      onClose();
    } catch (e) {
      toast.push({ type: 'warning', title: 'Send failed', message: e?.message || 'Error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={panel}>
        <h2 style={{ fontFamily: 'Exo 2,sans-serif', marginBottom: 12 }}>Emergency broadcast</h2>
        <label style={lab}>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={inp} />
        <label style={lab}>Message</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} style={inp} maxLength={2000} />
        <div style={{ fontSize: 11, color: '#7a9ab8', textAlign: 'right' }}>{message.length}/2000</div>
        <label style={lab}>Severity</label>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={inp}>
          <option value="info">INFO</option>
          <option value="warning">WARNING</option>
          <option value="critical">CRITICAL</option>
          <option value="emergency">EMERGENCY</option>
        </select>
        <label style={lab}>Disaster type</label>
        <input value={disasterType} onChange={(e) => setDisasterType(e.target.value)} style={inp} />
        <label style={lab}>Expires</label>
        <select value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)} style={inp}>
          <option value="1h">1 hour</option>
          <option value="6h">6 hours</option>
          <option value="24h">24 hours</option>
        </select>
        <div style={{ marginTop: 12, fontSize: 12, color: '#7a9ab8' }}>
          Nearby shelters: {shelters.length} (API: {API_BASE})
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={btnSec}>
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={send} style={btnPri}>
            {busy ? 'Sending…' : 'SEND BROADCAST'}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.75)',
  zIndex: 25000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
};
const panel = {
  width: 'min(520px, 100%)',
  background: '#0d1f35',
  border: '1px solid rgba(0,212,255,0.25)',
  borderRadius: 12,
  padding: 20,
  maxHeight: '90vh',
  overflowY: 'auto',
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
  fontSize: 13,
};
const btnSec = {
  padding: '10px 18px',
  borderRadius: 8,
  border: '1px solid rgba(0,212,255,0.3)',
  background: 'transparent',
  color: '#00d4ff',
  cursor: 'pointer',
};
const btnPri = {
  padding: '10px 18px',
  borderRadius: 8,
  border: 'none',
  background: 'linear-gradient(135deg,#ff2d55,#ff6b35)',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};
