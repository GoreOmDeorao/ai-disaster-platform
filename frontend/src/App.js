import React, { useCallback, useEffect, useState } from 'react';
import AlertFeed from './components/AlertFeed';
import SensorMap from './components/SensorMap';
import StatsPanel from './components/StatsPanel';
import BroadcastPanel from './components/BroadcastPanel';
import ShelterPanel from './components/ShelterPanel';
import BroadcastModal from './components/BroadcastModal';
import EmergencyOverlay from './components/EmergencyOverlay';
import DistressButton from './components/DistressButton';
import SystemStatus from './components/SystemStatus';
import { fetchApiStatus, fetchAlerts, fetchStats, sendBroadcast, fetchShelters, API_BASE } from './services/api';
import { DisasterWebSocket } from './services/websocket';
import { playDisasterAlarm, playDistressSignal, isSoundMuted, setSoundMuted } from './services/soundAlert';
import { useToast } from './components/ToastNotification';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'alerts', label: 'Alerts', icon: '⚠' },
  { id: 'map', label: 'Sensor map', icon: '◈' },
  { id: 'broadcasts', label: 'Broadcasts', icon: '📣' },
  { id: 'shelters', label: 'Shelters', icon: '⛺' },
];

export default function App() {
  const toast = useToast();
  const [tab, setTab] = useState('dashboard');
  const [time, setTime] = useState(new Date());
  const [apiOk, setApiOk] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [wsState, setWsState] = useState('disconnected');
  const [muted, setMuted] = useState(() => isSoundMuted());
  const [critCount, setCritCount] = useState(0);
  const [unacked, setUnacked] = useState(0);
  const [lastUpd, setLastUpd] = useState('--:--:--');
  const [broadcastModal, setBroadcastModal] = useState(null);
  const [emergency, setEmergency] = useState({ open: false, title: '', message: '', shelters: [], minDismiss: 0 });
  const [flash, setFlash] = useState(false);
  const pingApi = useCallback(async () => {
    const s = await fetchApiStatus();
    if (!s.live) setApiOk(false);
    else if (!s.ready) setApiOk('degraded');
    else setApiOk(true);
    try {
      const [alerts, st] = await Promise.all([fetchAlerts(200), fetchStats().catch(() => null)]);
      setCritCount(alerts.filter((a) => a.severity === 'critical' && !a.acknowledged).length);
      setUnacked(st?.active_alerts ?? alerts.filter((a) => !a.acknowledged).length);
      setLastUpd(new Date().toLocaleTimeString('en-IN', { hour12: false }));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    pingApi();
    const h = setInterval(pingApi, 15000);
    return () => clearInterval(h);
  }, [pingApi]);

  const openEmergency = useCallback((title, message, shelters, minDismiss) => {
    setEmergency({ open: true, title, message, shelters: shelters || [], minDismiss });
  }, []);

  const closeEmergency = useCallback(() => {
    setEmergency((e) => ({ ...e, open: false }));
  }, []);

  useEffect(() => {
    const w = new DisasterWebSocket(API_BASE);
    w.onStatus((st) => setWsState(st === 'connected' ? 'connected' : st === 'reconnecting' ? 'reconnecting' : 'disconnected'));
    w.onSoundAlert((p) => {
      if (!isSoundMuted()) playDisasterAlarm(p.severity || 'high');
      toast.push({ type: 'critical', title: 'Sound alert', message: p.message || '' });
    });
    w.onBroadcast((p, typ) => {
      if (typ === 'BROADCAST_DEACTIVATED') return;
      const sev = (p.severity || '').toLowerCase();
      if (sev === 'critical' || sev === 'emergency') {
        if (!isSoundMuted()) playDisasterAlarm('emergency');
        const sh = Array.isArray(p.shelter_locations) ? p.shelter_locations : [];
        openEmergency(p.title || 'Broadcast', p.message || '', sh, sev === 'emergency' ? 30 : 0);
      } else {
        toast.push({ type: 'info', title: p.title || 'Broadcast', message: p.message || '' });
      }
    });
    w.onAlert((p, typ) => {
      if (typ === 'NEW_ALERT' && p.severity === 'critical') {
        if (!isSoundMuted()) playDisasterAlarm('critical');
        setFlash(true);
        setTimeout(() => setFlash(false), 500);
        toast.push({
          type: 'critical',
          title: 'CRITICAL ALERT',
          message: `${p.location || ''} — ${p.message || ''}`,
        });
      }
    });
    w.connect();
    return () => w.disconnect();
  }, [toast, openEmergency]);

  const distress = useCallback(async () => {
    try {
      const shelters = await fetchShelters();
      await sendBroadcast({
        title: 'EMERGENCY DISTRESS SIGNAL',
        message:
          'EMERGENCY DISTRESS SIGNAL — All personnel evacuate immediately. Proceed to nearest shelter.',
        severity: 'emergency',
        disaster_type: 'general',
        affected_areas: ['India'],
        shelter_locations: shelters.slice(0, 10),
        expires_in: '24h',
        created_by: 'distress-button',
      });
      if (!isSoundMuted()) playDistressSignal();
      openEmergency(
        'EMERGENCY DISTRESS SIGNAL',
        'All personnel evacuate immediately. Proceed to nearest shelter.',
        shelters.slice(0, 8),
        30,
      );
    } catch (err) {
      toast.push({ type: 'warning', title: 'Distress failed', message: err?.message || 'Error' });
    }
  }, [toast, openEmergency]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setTab('broadcasts');
      }
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (window.confirm('Trigger emergency distress signal to all connected clients?')) {
          distress();
        }
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        const m = !isSoundMuted();
        setSoundMuted(m);
        setMuted(m);
        toast.push({ type: 'info', title: m ? 'Muted' : 'Unmuted', message: 'Sound alerts' });
      }
      if (e.key === 'Escape') {
        setBroadcastModal(null);
        closeEmergency();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toast, closeEmergency, distress]);

  const btnBase = {
    borderRadius: 8,
    fontFamily: 'Exo 2,sans-serif',
    fontWeight: 600,
    fontSize: 13,
    padding: '10px 16px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '1px solid transparent',
  };

  return (
    <div className="app-root tactical-grid-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#020408' }}>
      {flash && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 15000,
            background: 'rgba(255,45,85,0.35)',
            pointerEvents: 'none',
          }}
        />
      )}
      <EmergencyOverlay
        open={emergency.open}
        title={emergency.title}
        message={emergency.message}
        shelters={emergency.shelters}
        minDismissSeconds={emergency.minDismiss}
        onDismiss={closeEmergency}
      />
      {broadcastModal && (
        <BroadcastModal alert={broadcastModal} onClose={() => setBroadcastModal(null)} onSent={() => pingApi()} />
      )}

      <header
        style={{
          background: 'linear-gradient(90deg, #020408 0%, #061428 50%, #020408 100%)',
          borderBottom: '1px solid rgba(0,212,255,0.12)',
          padding: '0 clamp(12px, 2vw, 28px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 64,
          flexWrap: 'wrap',
          gap: 10,
          position: 'sticky',
          top: 0,
          zIndex: 5000,
          boxShadow: '0 4px 40px rgba(0,0,0,0.85)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #ff2d55, #ff6b35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              boxShadow: '0 0 22px rgba(255,45,85,0.45)',
            }}
          >
            ⚡
          </div>
          <div>
            <div style={{ fontFamily: 'Exo 2,sans-serif', fontWeight: 800, fontSize: 17, letterSpacing: 2, color: '#e8f4f8' }}>
              AI DISASTER RESPONSE
            </div>
            <div style={{ fontFamily: 'Share Tech Mono,monospace', fontSize: 10, color: 'rgba(0,212,255,0.65)', letterSpacing: 2 }}>
              NATIONAL MONITORING SYSTEM — INDIA
            </div>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }} aria-label="Main">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setTab(n.id)}
              aria-current={tab === n.id ? 'page' : undefined}
              style={{
                ...btnBase,
                background: tab === n.id ? 'rgba(0,212,255,0.14)' : 'transparent',
                borderColor: tab === n.id ? 'rgba(0,212,255,0.35)' : 'transparent',
                color: tab === n.id ? '#00d4ff' : '#7a9ab8',
              }}
            >
              <span style={{ marginRight: 6 }}>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {critCount > 0 && (
            <div
              style={{
                minWidth: 28,
                height: 28,
                borderRadius: 14,
                background: '#ff2d55',
                color: '#fff',
                fontWeight: 800,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: critCount > 0 ? 'pulse-dot 1.2s infinite' : 'none',
              }}
            >
              {critCount > 99 ? '99+' : critCount}
            </div>
          )}
          <DistressButton
            onClick={() => {
              if (window.confirm('This will trigger an emergency distress signal to ALL connected devices. Continue?')) {
                distress();
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              const m = !isSoundMuted();
              setSoundMuted(m);
              setMuted(m);
            }}
            style={{ ...btnBase, borderColor: 'rgba(0,212,255,0.25)', color: '#00d4ff' }}
            title="Ctrl+M"
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: apiOk === false ? '#ff2d55' : apiOk === 'degraded' ? '#ffd60a' : apiOk ? '#00ff88' : '#7a9ab8',
              }}
            />
            <span style={{ fontFamily: 'Share Tech Mono,monospace', fontSize: 10, color: '#7a9ab8' }}>API</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 12px #00ff88', animation: 'pulse-dot 2s infinite' }} />
            <span style={{ fontFamily: 'Share Tech Mono,monospace', fontSize: 11, color: '#00ff88', letterSpacing: 2 }}>LIVE</span>
          </div>
          <div style={{ fontFamily: 'Share Tech Mono,monospace', fontSize: 13, color: '#00d4ff' }}>
            {time.toLocaleTimeString('en-IN', { hour12: false })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: wsState === 'connected' ? '#00ff88' : wsState === 'reconnecting' ? '#ffd60a' : '#ff2d55',
              }}
            />
            <span style={{ fontFamily: 'Share Tech Mono,monospace', fontSize: 10, color: '#7a9ab8' }}>WS</span>
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SystemStatus collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((x) => !x)} />
        <main style={{ flex: 1, padding: 'clamp(14px,2vw,26px)', overflow: 'auto', maxWidth: '100%' }}>
          {tab === 'dashboard' && <StatsPanel />}
          {tab === 'alerts' && <AlertFeed onBroadcastRequest={(a) => setBroadcastModal(a)} />}
          {tab === 'map' && <SensorMap />}
          {tab === 'broadcasts' && <BroadcastPanel />}
          {tab === 'shelters' && <ShelterPanel />}
        </main>
      </div>

      <footer
        style={{
          borderTop: '1px solid rgba(0,212,255,0.08)',
          padding: '8px clamp(12px,2vw,24px)',
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          background: 'rgba(2,4,8,0.95)',
          fontFamily: 'Share Tech Mono,monospace',
          fontSize: 11,
          color: '#7a9ab8',
        }}
      >
        <span>
          Sensors active: 10 | Unacked alerts: {unacked} | Critical: {critCount} | Last update: {lastUpd} | API: {API_BASE} | WS:{' '}
          {wsState === 'connected' ? '🟢 Connected' : wsState === 'reconnecting' ? '🟡 Reconnecting' : '🔴 Disconnected'}
        </span>
        <span>{time.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
      </footer>
    </div>
  );
}
