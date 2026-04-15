'use strict';
const WebSocket = require('ws');

/**
 * Factory: returns broadcast helpers bound to the shared clients Map.
 * @param {Map<WebSocket, object>} clients
 */
function createBroadcast(clients) {
  const send = (ws, msg) => {
    if (ws.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify(msg));
  };

  const bcast = (predFn, msg) => {
    const raw = JSON.stringify(msg);
    for (const [ws, info] of clients)
      if (predFn(info) && ws.readyState === WebSocket.OPEN)
        ws.send(raw);
  };

  return {
    send,
    bcastAll:   msg       => bcast(() => true,        msg),
    bcastLobby: msg       => bcast(i => i.room === 'lobby', msg),
    bcastRoom:  (id, msg) => bcast(i => i.room === id, msg),
  };
}

module.exports = { createBroadcast };
