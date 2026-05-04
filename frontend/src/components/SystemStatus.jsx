import React, { useEffect, useState } from 'react';
import { API_BASE, ML_BASE, fetchApiStatus, fetchMlHealth } from '../services/api';

export default function SystemStatus({ collapsed, onToggle }) {
  const [api, setApi] = useState(null);
  const [ml, setMl] = useState(null);

  const tick = async () => {
    const s = await fetchApiStatus();
    setApi(s);
    const mh = await fetchMlHealth();
    setMl(mh && mh.status === 'ok');
  };

  useEffect(() => {
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);

  const row = (label, ok) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ fontFamily: 'Share Tech Mono,monospace', fontSize: 11, color: '#7a9ab8' }}>{label}</span>
      <span style={{ color: ok ? '#00ff88' : '#ff2d55', fontSize: 10, fontWeight: 700 }}>{ok ? '● ONLINE' : '● OFFLINE'}</span>
    </div>
  );

  return (
    <aside
      style={{
        width: collapsed ? 44 : 220,
        minWidth: collapsed ? 44 : 220,
        background: 'linear-gradient(180deg,#061018,#020408)',
        borderRight: '1px solid rgba(0,212,255,0.08)',
        padding: collapsed ? 8 : 16,
        transition: 'width 0.2s',
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          marginBottom: 12,
          background: 'rgba(0,212,255,0.08)',
          border: '1px solid rgba(0,212,255,0.2)',
          color: '#00d4ff',
          borderRadius: 6,
          padding: 6,
          cursor: 'pointer',
          fontSize: 11,
        }}
      >
        {collapsed ? '⟩' : '⟨ collapse'}
      </button>
      {!collapsed && (
        <>
          <div style={{ fontFamily: 'Exo 2,sans-serif', fontWeight: 700, fontSize: 13, color: '#00d4ff', marginBottom: 14 }}>System status</div>
          {row('Backend API', api?.live && api?.ready)}
          {row('PostgreSQL', api?.checks?.postgres)}
          {row('Redis', api?.checks?.redis)}
          {row('ML service', ml === true)}
          {row('Kafka', api?.live)}
          <div style={{ fontSize: 10, color: '#3a5470', marginTop: 12, wordBreak: 'break-all' }}>
            API {API_BASE}
            <br />
            ML {ML_BASE}
          </div>
        </>
      )}
    </aside>
  );
}
