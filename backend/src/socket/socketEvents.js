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

function registerSocketEvents(io, socket) {
  // Client can request a refresh of notifications; this avoids forcing a full reconnect.
  socket.on(SOCKET_EVENTS.NOTIFICATION_READ, () => {
    // acknowledgment handled by REST API; nothing to do here.
  });

  socket.on('project:join', async (projectId, callback) => {
    try {
      const project = await joinProjectRoom(io, socket, projectId, Project);
      callback?.({ success: true, project });
    } catch (error) {
      callback?.({ success: false, error: error.message });
    }
  });

  socket.on('project:leave', (projectId) => {
    leaveProjectRoom(socket, projectId);
  });

  socket.on('document:join', async (documentId, callback) => {
    try {
      const document = await joinDocumentRoom(io, socket, documentId, EmployeeDocument);
      callback?.({ success: true, document });
    } catch (error) {
      callback?.({ success: false, error: error.message });
    }
  });

  socket.on('document:leave', (documentId) => {
    leaveDocumentRoom(socket, documentId);
  });

  socket.on('document-request:join', async (requestId, callback) => {
    try {
      const request = await joinDocumentRequestRoom(io, socket, requestId, DocumentRequest);
      callback?.({ success: true, request });
    } catch (error) {
      callback?.({ success: false, error: error.message });
    }
  });

  socket.on('document-request:leave', (requestId) => {
    leaveDocumentRequestRoom(socket, requestId);
  });

  socket.on('disconnect', () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Socket disconnected: ${socket.user?.id}`);
    }
  });
}

module.exports = { registerSocketEvents };
