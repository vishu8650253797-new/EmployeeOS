import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';

export function usePerformanceSocket(employeeId, callbacks = {}) {
  const { socket } = useSocket();
  const callbacksRef = useRef(callbacks);

  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  useEffect(() => {
    if (!socket || !employeeId) return;

    const handlers = {
      'performance:cycle-created': (data) => callbacksRef.current.onCycleCreated?.(data),
      'performance:cycle-updated': (data) => callbacksRef.current.onCycleUpdated?.(data),
      'goal:created': (data) => callbacksRef.current.onGoalCreated?.(data),
      'goal:updated': (data) => callbacksRef.current.onGoalUpdated?.(data),
      'goal:progress-updated': (data) => callbacksRef.current.onGoalProgressUpdated?.(data),
      'goal:completed': (data) => callbacksRef.current.onGoalCompleted?.(data),
      'goal:at-risk': (data) => callbacksRef.current.onGoalAtRisk?.(data),
      'kpi:created': (data) => callbacksRef.current.onKPICreated?.(data),
      'kpi:updated': (data) => callbacksRef.current.onKPIUpdated?.(data),
      'kpi:value-updated': (data) => callbacksRef.current.onKPIValueUpdated?.(data),
      'review:started': (data) => callbacksRef.current.onReviewStarted?.(data),
      'review:assigned': (data) => callbacksRef.current.onReviewAssigned?.(data),
      'review:submitted': (data) => callbacksRef.current.onReviewSubmitted?.(data),
      'review:completed': (data) => callbacksRef.current.onReviewCompleted?.(data),
      'review:reopened': (data) => callbacksRef.current.onReviewReopened?.(data),
      'feedback:created': (data) => callbacksRef.current.onFeedbackCreated?.(data),
      'feedback:submitted': (data) => callbacksRef.current.onFeedbackSubmitted?.(data),
      'feedback:requested': (data) => callbacksRef.current.onFeedbackRequested?.(data),
      'performance:score-updated': (data) => callbacksRef.current.onScoreUpdated?.(data),
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, [socket, employeeId]);
}
