import React, { useEffect, useState } from 'react';

export default function EmergencyOverlay({ open, title, message, shelters, minDismissSeconds, onDismiss }) {
  const [allow, setAllow] = useState(false);

  useEffect(() => {
    if (!open) {
      setAllow(false);
      return undefined;
    }
    setAllow(false);
    const sec = minDismissSeconds || 0;
    if (sec <= 0) {
      setAllow(true);
      return undefined;
    }
    const t = setTimeout(() => setAllow(true), sec * 1000);
    return () => clearTimeout(t);
  }, [open, minDismissSeconds]);

  if (!open) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 30000,
        background: 'rgba(180, 0, 0, 0.97)',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
        overflowY: 'auto',
      }}
    >
      <div style={{ maxWidth: 720, width: '100%' }}>
        <div style={{ fontSize: 14, letterSpacing: 4, fontWeight: 700, marginBottom: 12 }}>⚠️ EMERGENCY BROADCAST</div>
        <h1 style={{ fontFamily: 'Exo 2,sans-serif', fontSize: 'clamp(22px, 5vw, 36px)', marginBottom: 16, lineHeight: 1.2 }}>{title}</h1>
        <p style={{ fontSize: 'clamp(16px, 4vw, 22px)', lineHeight: 1.5, marginBottom: 28 }}>{message}</p>
        <div style={{ textAlign: 'left', marginBottom: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 18 }}>NEAREST SHELTERS</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(shelters || []).slice(0, 5).map((s, i) => (
              <li key={i} style={{ marginBottom: 14, fontSize: 16 }}>
                <strong>{s.name}</strong> — {s.distance_km != null ? `${s.distance_km} km` : '—'} —{' '}
                <a href={`tel:${String(s.contact || '').replace(/\s/g, '')}`} style={{ color: '#fff', textDecoration: 'underline' }}>
                  {s.contact || 'N/A'}
                </a>
                <div style={{ marginTop: 4, opacity: 0.9, fontSize: 14 }}>{s.address}</div>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#ff0', fontSize: 14 }}
                >
                  Open in Google Maps
                </a>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          disabled={!allow}
          onClick={onDismiss}
          style={{
            padding: '14px 32px',
            fontSize: 18,
            fontWeight: 800,
            borderRadius: 8,
            border: '2px solid #fff',
            background: allow ? '#fff' : 'rgba(255,255,255,0.3)',
            color: allow ? '#b00000' : 'rgba(255,255,255,0.5)',
            cursor: allow ? 'pointer' : 'not-allowed',
          }}
        >
          DISMISS
        </button>
        {!allow && <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>Button unlocks in {minDismissSeconds}s…</div>}
      </div>
    </div>
  );
}
