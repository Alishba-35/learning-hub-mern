import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './authContext.js';
import { request, refreshSession, setAccessToken, setAuthFailureHandler } from '../services/api.js';
import { clearAllLocalDrafts } from '../services/draftStore.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Page khulte hi refresh cookie se purana login wapas lao (yehi "bar bar login na karna" hai)
  useEffect(() => {
    setAuthFailureHandler(() => setUser(null));
    refreshSession()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const startSession = useCallback((data) => {
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const login = useCallback(
    async (credentials) => {
      startSession(await request('/auth/login', { method: 'POST', body: credentials, auth: false }));
    },
    [startSession]
  );

  const register = useCallback(
    async (details) => {
      startSession(await request('/auth/register', { method: 'POST', body: details, auth: false }));
    },
    [startSession]
  );

  const logout = useCallback(async () => {
    try {
      await request('/auth/logout', { method: 'POST', auth: false });
    } catch {
      // server tak na pahunche tab bhi local logout zaroori hai
    }
    setAccessToken(null);
    clearAllLocalDrafts(); // shared computer par pichle user ka code na rahe
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
