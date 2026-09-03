import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { connectSocket, disconnectSocket } from '../services/socketService';
import { SOCKET_EVENTS } from '../utils/socketEvents';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      setIsConnected(false);
      socketRef.current = null;
      return undefined;
    }

    const socket = connectSocket();
    socketRef.current = socket;

    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    // The server force-disconnects a user's socket(s) when their session can no
    // longer be trusted (logout elsewhere, password change, account
    // deactivation) — reflect that immediately in the UI rather than leaving a
    // dead connection until the access token naturally expires.
    function onSessionInvalidated(payload) {
      toast(payload?.reason || 'Your session has ended. Please sign in again.', 'error');
      logout();
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on(SOCKET_EVENTS.SESSION_INVALIDATED, onSessionInvalidated);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(SOCKET_EVENTS.SESSION_INVALIDATED, onSessionInvalidated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const value = {
    socket: socketRef.current,
    isConnected,
    connect: () => {
      const s = connectSocket();
      socketRef.current = s;
      return s;
    },
    disconnect: disconnectSocket,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within a SocketProvider');
  return context;
}
