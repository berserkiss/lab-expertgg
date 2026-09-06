import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { fetchMe, login as loginRequest, logoutRequest, User } from '../api/auth';
import { setAuthFailureHandler } from '../api/client';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // If a refresh ultimately fails (expired/revoked refresh token), the
    // API client already clears storage - this just clears the in-memory
    // session so the app falls back to SignIn.
    setAuthFailureHandler(() => setUser(null));
  }, []);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('access_token');
      if (token) {
        try {
          setUser(await fetchMe());
        } catch {
          await AsyncStorage.removeMany(['access_token', 'refresh_token']);
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { access, refresh } = await loginRequest(email, password);
    await AsyncStorage.setMany({ access_token: access, refresh_token: refresh });
    setUser(await fetchMe());
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = await AsyncStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        await logoutRequest(refreshToken);
      } catch {
        // Already invalid/expired - fine, we're clearing it locally either way.
      }
    }
    await AsyncStorage.removeMany(['access_token', 'refresh_token']);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    setUser(await fetchMe());
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
