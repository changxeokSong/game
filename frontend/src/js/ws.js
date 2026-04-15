/**
 * WSClient — thin wrapper around the native WebSocket API.
 * Connects to /ws (nginx proxies to backend).
 */
export class WSClient {
  constructor() {
    this._ws       = null;
    this._handlers = new Map();
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this._ws = new WebSocket(`${proto}://${location.host}/ws`);

    this._ws.onmessage = ({ data }) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      const h = this._handlers.get(msg.type);
      if (h) h(msg);
      const all = this._handlers.get('*');
      if (all) all(msg);
    };

    return new Promise((resolve, reject) => {
      this._ws.onopen  = resolve;
      this._ws.onerror = reject;
      this._ws.onclose = () => this._handlers.get('close')?.();
    });
  }

  /** Register a typed message handler. Use '*' to catch everything. */
  on(type, handler) {
    this._handlers.set(type, handler);
    return this;  // chainable
  }

  send(msg) {
    if (this._ws?.readyState === WebSocket.OPEN)
      this._ws.send(JSON.stringify(msg));
  }

  close() { this._ws?.close(); }
}
