import { io } from 'socket.io-client';
import { authService } from './authService';

const SOCKET_URL = import.meta.env.DEV ? 'http://127.0.0.1:5100' : import.meta.env.VITE_API_BASE_URL || '';

let socket = null;

export function getSocket() {
  return socket;
}

export function connectSocket() {
  if (socket?.connected) return socket;
  if (socket) socket.disconnect();

  socket = io(SOCKET_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: {
      token: authService.getAccessToken(),
    },
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    if (import.meta.env.DEV) console.log('Socket connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    if (import.meta.env.DEV) console.log('Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    if (import.meta.env.DEV) console.error('Socket connect error:', error.message);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
