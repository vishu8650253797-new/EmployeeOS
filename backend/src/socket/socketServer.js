const { Server } = require('socket.io');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { socketAuthMiddleware } = require('./socketAuth');
const { joinUserRooms, getUserRoom } = require('./socketRooms');
const { registerSocketEvents } = require('./socketEvents');

let io = null;

function initSocketServer(httpServer) {
  const clientOrigin = process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? '' : true);

  io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: clientOrigin,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Socket connected: ${socket.user.id} (org: ${socket.user.organizationId})`);
    }

    joinUserRooms(io, socket);
    socket.emit(SOCKET_EVENTS.CONNECTED, { success: true, userId: socket.user.id });
    registerSocketEvents(io, socket);
  });

  return io;
}

function getSocketInstance() {
  return io;
}

// Forces every live connection for a user off the real-time channel — used when
// their session/authorization can no longer be trusted (logout, password reset,
// account deactivation) rather than waiting up to the access-token TTL for a
// natural reconnect to re-run auth. Emits a reason first so the client can show
// a clean "signed out" state instead of a bare disconnect.
function disconnectUserSockets(userId, reason = 'Your session is no longer valid.') {
  if (!io || !userId) return;
  try {
    const room = getUserRoom(userId.toString());
    io.to(room).emit(SOCKET_EVENTS.SESSION_INVALIDATED, { reason });
    io.in(room).disconnectSockets(true);
  } catch (err) {
    console.error('[socket] failed to disconnect user sockets:', err);
  }
}

module.exports = { initSocketServer, getSocketInstance, disconnectUserSockets };
