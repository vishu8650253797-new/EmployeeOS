const { WebSocketServer } = require('ws');

const clients = new Set();

function initSocketServer(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    clients.add(ws);

    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));

    ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }));
  });

  wss.on('error', (err) => {
    console.error('WebSocket server error:', err.message);
  });

  return wss;
}

function broadcast(type, payload) {
  const message = JSON.stringify({ type, payload });
  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

module.exports = { initSocketServer, broadcast };
