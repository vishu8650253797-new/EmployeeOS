import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';

export function useProjectSocket(projectId, handlers = {}) {
  const { socket } = useSocket();
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

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
      'project:created': (data) => handlersRef.current.onProjectCreated?.(data),
      'project:updated': (data) => handlersRef.current.onProjectUpdated?.(data),
      'project:deleted': (data) => handlersRef.current.onProjectDeleted?.(data),
      'project:member-added': (data) => handlersRef.current.onMemberAdded?.(data),
      'project:member-removed': (data) => handlersRef.current.onMemberRemoved?.(data),
      'task:created': (data) => handlersRef.current.onTaskCreated?.(data),
      'task:updated': (data) => handlersRef.current.onTaskUpdated?.(data),
      'task:assigned': (data) => handlersRef.current.onTaskAssigned?.(data),
      'task:status-changed': (data) => handlersRef.current.onStatusChanged?.(data),
      'task:deleted': (data) => handlersRef.current.onTaskDeleted?.(data),
      'task:comment-added': (data) => handlersRef.current.onCommentAdded?.(data),
    };

    Object.entries(eventHandlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, [socket]);
}
