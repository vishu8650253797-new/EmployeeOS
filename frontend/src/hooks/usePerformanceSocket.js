import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

export function usePerformanceSocket(employeeId, callbacks = {}) {
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !employeeId) return;

    const handlers = {
      'performance:cycle-created': (data) => callbacks.onCycleCreated?.(data),
      'performance:cycle-updated': (data) => callbacks.onCycleUpdated?.(data),
      'goal:created': (data) => callbacks.onGoalCreated?.(data),
      'goal:updated': (data) => callbacks.onGoalUpdated?.(data),
      'goal:progress-updated': (data) => callbacks.onGoalProgressUpdated?.(data),
      'goal:completed': (data) => callbacks.onGoalCompleted?.(data),
      'goal:at-risk': (data) => callbacks.onGoalAtRisk?.(data),
      'kpi:created': (data) => callbacks.onKPICreated?.(data),
      'kpi:updated': (data) => callbacks.onKPIUpdated?.(data),
      'kpi:value-updated': (data) => callbacks.onKPIValueUpdated?.(data),
      'review:started': (data) => callbacks.onReviewStarted?.(data),
      'review:assigned': (data) => callbacks.onReviewAssigned?.(data),
      'review:submitted': (data) => callbacks.onReviewSubmitted?.(data),
      'review:completed': (data) => callbacks.onReviewCompleted?.(data),
      'review:reopened': (data) => callbacks.onReviewReopened?.(data),
      'feedback:created': (data) => callbacks.onFeedbackCreated?.(data),
      'feedback:submitted': (data) => callbacks.onFeedbackSubmitted?.(data),
      'feedback:requested': (data) => callbacks.onFeedbackRequested?.(data),
      'performance:score-updated': (data) => callbacks.onScoreUpdated?.(data),
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      if (handler) {
        socket.on(event, handler);
      }
    });

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        if (handler) {
          socket.off(event, handler);
        }
      });
    };
  }, [socket, employeeId, callbacks]);
}
