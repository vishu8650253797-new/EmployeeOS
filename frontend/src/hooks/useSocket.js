import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

export function useSocketEvent(event, handler, deps = []) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !event || !handler) return undefined;
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, event, ...deps]);
}
