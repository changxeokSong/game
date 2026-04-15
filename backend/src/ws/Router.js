'use strict';

/**
 * Simple message router.
 * Handlers are registered per message type and called with (ws, msg, ctx).
 */
class Router {
  constructor() {
    this._routes = new Map();
  }

  /** Register a handler for a message type. */
  on(type, handler) {
    this._routes.set(type, handler);
    return this;
  }

  /** Dispatch a parsed message to the correct handler. */
  async dispatch(ws, msg, ctx) {
    const handler = this._routes.get(msg.type);
    if (!handler) return;
    try {
      await handler(ws, msg, ctx);
    } catch (err) {
      console.error(`[Router] handler error for '${msg.type}':`, err.message);
    }
  }
}

module.exports = Router;
