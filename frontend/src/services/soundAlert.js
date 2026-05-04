/** Web Audio API — no external sound files */

function beep(ctx, freq, start, dur, vol = 0.15) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g);
  g.connect(ctx.destination);
  o.start(start);
  o.stop(start + dur);
}

export function playDisasterAlarm(severity) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const now = ctx.currentTime;
  const pattern =
    severity === 'critical' || severity === 'emergency'
      ? [0, 0.22, 0.44]
      : severity === 'high'
        ? [0, 0.35]
        : [0];
  pattern.forEach((off, i) => {
    beep(ctx, 880 + i * 120, now + off, 0.18, 0.12);
  });
  if (severity === 'emergency') {
    for (let k = 0; k < 8; k++) {
      beep(ctx, 520 + (k % 2) * 180, now + 0.7 + k * 0.12, 0.08, 0.1);
    }
  }
  setTimeout(() => ctx.close(), 2500);
}

export function playDistressSignal() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const now = ctx.currentTime;
  const dot = 0.08;
  const gap = 0.06;
  const dash = 0.22;
  let t = now;
  const s = () => {
    beep(ctx, 740, t, dot, 0.14);
    t += dot + gap;
  };
  const l = () => {
    beep(ctx, 740, t, dash, 0.14);
    t += dash + gap;
  };
  for (let i = 0; i < 3; i++) s();
  t += 0.12;
  for (let i = 0; i < 3; i++) l();
  t += 0.12;
  for (let i = 0; i < 3; i++) s();
  setTimeout(() => ctx.close(), 4000);
}

export function isSoundMuted() {
  return localStorage.getItem('soundMuted') === '1';
}

export function setSoundMuted(m) {
  localStorage.setItem('soundMuted', m ? '1' : '0');
}
