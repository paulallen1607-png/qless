import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../lib/api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  const login = useCallback((token, u, remember = true) => {
    setToken(token, { remember });
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem('qless_cart');
    setUser(null);
  }, []);

  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener('qless:unauthorized', onUnauthorized);
    return () => window.removeEventListener('qless:unauthorized', onUnauthorized);
  }, [logout]);

  return <AuthCtx.Provider value={{ user, ready, login, logout, setUser }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
