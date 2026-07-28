import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const hasSession = document.cookie.includes('employeeos_session=1');
    if (!hasSession) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    authService
      .initialize()
      .then((authenticatedUser) => {
        if (cancelled) return;
        setUser(authenticatedUser);
        setIsAuthenticated(true);
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setIsAuthenticated(false);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const authenticatedUser = await authService.login(credentials);
    setUser(authenticatedUser);
    setIsAuthenticated(true);
    return authenticatedUser;
  }, []);

  const register = useCallback(async (payload) => {
    const authenticatedUser = await authService.register(payload);
    setUser(authenticatedUser);
    setIsAuthenticated(true);
    return authenticatedUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
      toast('You have been logged out.');
    } catch (err) {
      toast(err.message || 'Logout failed', 'error');
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      navigate('/login');
    }
  }, [navigate, toast]);

  const refreshSession = useCallback(async () => {
    try {
      const authenticatedUser = await authService.initialize();
      setUser(authenticatedUser);
      setIsAuthenticated(true);
      return authenticatedUser;
    } catch {
      setUser(null);
      setIsAuthenticated(false);
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated, isLoading, login, register, logout, refreshSession }),
    [user, isAuthenticated, isLoading, login, register, logout, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
