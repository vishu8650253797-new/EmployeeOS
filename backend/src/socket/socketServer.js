const { Server } = require('socket.io');
const SOCKET_EVENTS = require('../utils/socketEvents');
const { socketAuthMiddleware } = require('./socketAuth');
const { joinUserRooms } = require('./socketRooms');
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

module.exports = { initSocketServer, getSocketInstance };
