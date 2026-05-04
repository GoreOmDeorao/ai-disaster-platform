import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastCtx = createContext(null);

let idSeq = 0;

export function useToast() {
  const v = useContext(ToastCtx);
  if (!v) throw new Error('useToast needs ToastProvider');
  return v;
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const dismiss = useCallback((id) => {
    setItems((xs) => xs.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast) => {
      const id = ++idSeq;
      const t = {
        id,
        type: toast.type || 'info',
        title: toast.title || '',
        message: toast.message || '',
        sticky: toast.type === 'critical',
        ...toast,
      };
      setItems((xs) => [...xs, t]);
      if (!t.sticky) {
        setTimeout(() => dismiss(id), toast.duration || 5000);
      }
      return id;
    },
    [dismiss],
  );

  const val = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  const colors = {
    info: { bg: 'rgba(0,212,255,0.12)', border: 'rgba(0,212,255,0.4)', fg: '#00d4ff' },
    warning: { bg: 'rgba(255,107,53,0.12)', border: 'rgba(255,107,53,0.45)', fg: '#ff6b35' },
    critical: { bg: 'rgba(255,45,85,0.2)', border: 'rgba(255,45,85,0.55)', fg: '#ff2d55' },
  };

  return (
    <ToastCtx.Provider value={val}>
      {children}
      <div
        style={{
          position: 'fixed',
          top: 72,
          right: 16,
          zIndex: 20000,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 380,
          pointerEvents: 'none',
        }}
      >
        {items.map((t) => {
          const c = colors[t.type] || colors.info;
          return (
            <div
              key={t.id}
              style={{
                pointerEvents: 'auto',
                background: c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: 10,
                padding: '12px 14px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                animation: 'slide-in 0.25s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: 'Exo 2,sans-serif', fontWeight: 700, color: c.fg, fontSize: 14 }}>{t.title}</div>
                  <div style={{ fontFamily: 'Share Tech Mono,monospace', fontSize: 11, color: '#c0d8e8', marginTop: 4, lineHeight: 1.4 }}>
                    {t.message}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#7a9ab8',
                    cursor: 'pointer',
                    fontSize: 16,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
