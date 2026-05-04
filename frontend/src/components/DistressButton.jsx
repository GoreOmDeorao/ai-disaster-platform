import React from 'react';

export default function DistressButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 14px',
        borderRadius: 8,
        border: '2px solid #ff2d55',
        background: 'linear-gradient(180deg, rgba(255,45,85,0.25), rgba(255,45,85,0.08))',
        color: '#ff2d55',
        fontFamily: 'Exo 2,sans-serif',
        fontWeight: 800,
        fontSize: 12,
        letterSpacing: 1,
        cursor: 'pointer',
        boxShadow: '0 0 20px rgba(255,45,85,0.35)',
      }}
    >
      DISTRESS SIGNAL
    </button>
  );
}
