function wsURLFromApiBase(apiBase) {
  if (typeof process !== 'undefined' && process.env.REACT_APP_WS_URL) {
    return process.env.REACT_APP_WS_URL;
  }
  const base = apiBase || 'http://127.0.0.1:8080';
  const wsBase = base.startsWith('https') ? base.replace(/^https/, 'wss') : base.replace(/^http/, 'ws');
  return wsBase.replace(/\/$/, '') + '/ws';
}

export class DisasterWebSocket {
  constructor(apiBase) {
    this.url = wsURLFromApiBase(apiBase);
    this.ws = null;
    this.reconnectMs = 2000;
    this.timer = null;
    this.handlers = { alert: [], broadcast: [], sound: [], raw: [], status: [] };
    this.manualClose = false;
  }

  emitStatus(state, detail) {
    this.handlers.status.forEach((fn) => fn(state, detail));
  }

  connect() {
    this.manualClose = false;
    this._open();
  }

  _open() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.emitStatus('reconnecting', this.url);
    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      this.emitStatus('disconnected', String(e));
      this._scheduleReconnect();
      return;
    }
    this.ws.onopen = () => this.emitStatus('connected', this.url);
    this.ws.onclose = () => {
      this.emitStatus('disconnected', 'closed');
      if (!this.manualClose) this._scheduleReconnect();
    };
    this.ws.onerror = () => this.emitStatus('disconnected', 'error');
    this.ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      this.handlers.raw.forEach((fn) => fn(msg));
      const t = msg.type;
      const p = msg.payload || {};
      if (t === 'NEW_ALERT' || t === 'THRESHOLD_BREACH') this.handlers.alert.forEach((fn) => fn(p, t));
      if (t === 'BROADCAST' || t === 'BROADCAST_DEACTIVATED') this.handlers.broadcast.forEach((fn) => fn(p, t));
      if (t === 'SOUND_ALERT') this.handlers.sound.forEach((fn) => fn(p));
    };
  }

  _scheduleReconnect() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this._open(), this.reconnectMs);
  }

  onAlert(cb) {
    this.handlers.alert.push(cb);
  }
  onBroadcast(cb) {
    this.handlers.broadcast.push(cb);
  }
  onSoundAlert(cb) {
    this.handlers.sound.push(cb);
  }
  onRaw(cb) {
    this.handlers.raw.push(cb);
  }
  onStatus(cb) {
    this.handlers.status.push(cb);
  }

  disconnect() {
    this.manualClose = true;
    clearTimeout(this.timer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.emitStatus('disconnected', 'manual');
  }
}
