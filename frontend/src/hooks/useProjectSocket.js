import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

export function useProjectSocket(projectId, handlers = {}) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !projectId) return undefined;

    socket.emit('project:join', projectId, (response) => {
      if (!response.success) {
        console.error('Failed to join project room:', response.error);
      }
    });

    return () => {
      socket.emit('project:leave', projectId);
    };
  }, [socket, projectId]);

  useEffect(() => {
    if (!socket) return undefined;

    const eventHandlers = {
      'project:created': handlers.onProjectCreated,
      'project:updated': handlers.onProjectUpdated,
      'project:deleted': handlers.onProjectDeleted,
      'project:member-added': handlers.onMemberAdded,
      'project:member-removed': handlers.onMemberRemoved,
      'task:created': handlers.onTaskCreated,
      'task:updated': handlers.onTaskUpdated,
      'task:assigned': handlers.onTaskAssigned,
      'task:status-changed': handlers.onStatusChanged,
      'task:deleted': handlers.onTaskDeleted,
      'task:comment-added': handlers.onCommentAdded,
    };

    Object.entries(eventHandlers).forEach(([event, handler]) => {
      if (handler) socket.on(event, handler);
    });

    return () => {
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        if (handler) socket.off(event, handler);
      });
    };
  }, [socket, handlers]);
}
