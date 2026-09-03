const SOCKET_EVENTS = require('../utils/socketEvents');
const {
  joinProjectRoom,
  leaveProjectRoom,
  joinDocumentRoom,
  leaveDocumentRoom,
  joinDocumentRequestRoom,
  leaveDocumentRequestRoom,
} = require('./socketRooms');
const { Project, EmployeeDocument, DocumentRequest } = require('../models');
const { isRateLimited } = require('./socketRateLimit');

const MAX_CLIENT_EVENTS_PER_WINDOW = 30;
const CLIENT_EVENT_WINDOW_MS = 10 * 1000;

// Wraps a client-originated handler so a single misbehaving/compromised client
// can't flood room-join lookups (each does a DB read) or any other custom event.
// Silently drops over-limit calls rather than erroring — a client that's
// already spamming doesn't need a reason to keep retrying.
function throttled(socket, handler) {
  return (...args) => {
    if (isRateLimited(`event:${socket.id}`, MAX_CLIENT_EVENTS_PER_WINDOW, CLIENT_EVENT_WINDOW_MS)) {
      const callback = args[args.length - 1];
      if (typeof callback === 'function') callback({ success: false, error: 'Too many requests. Please slow down.' });
      return;
    }
    handler(...args);
  };
}

function registerSocketEvents(io, socket) {
  // Client can request a refresh of notifications; this avoids forcing a full reconnect.
  socket.on(SOCKET_EVENTS.NOTIFICATION_READ, () => {
    // acknowledgment handled by REST API; nothing to do here.
  });

  socket.on('project:join', throttled(socket, async (projectId, callback) => {
    try {
      const project = await joinProjectRoom(io, socket, projectId, Project);
      callback?.({ success: true, project });
    } catch (error) {
      callback?.({ success: false, error: error.message });
    }
  }));

  socket.on('project:leave', throttled(socket, (projectId) => {
    leaveProjectRoom(socket, projectId);
  }));

  socket.on('document:join', throttled(socket, async (documentId, callback) => {
    try {
      const document = await joinDocumentRoom(io, socket, documentId, EmployeeDocument);
      callback?.({ success: true, document });
    } catch (error) {
      callback?.({ success: false, error: error.message });
    }
  }));

  socket.on('document:leave', throttled(socket, (documentId) => {
    leaveDocumentRoom(socket, documentId);
  }));

  socket.on('document-request:join', throttled(socket, async (requestId, callback) => {
    try {
      const request = await joinDocumentRequestRoom(io, socket, requestId, DocumentRequest);
      callback?.({ success: true, request });
    } catch (error) {
      callback?.({ success: false, error: error.message });
    }
  }));

  socket.on('document-request:leave', throttled(socket, (requestId) => {
    leaveDocumentRequestRoom(socket, requestId);
  }));

  socket.on('disconnect', () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Socket disconnected: ${socket.user?.id}`);
    }
  });
}

module.exports = { registerSocketEvents };
