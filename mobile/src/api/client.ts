import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Platform } from 'react-native';

// Local dev API root. The Android emulator maps 10.0.2.2 -> the host
// machine's localhost; iOS simulator/device setups differ, hence the
// platform switch. For a physical device or the deployed backend, replace
// this with the real host (LAN IP while developing, the production domain
// once deployed) - this is the one line to change for that.
const DEV_HOST = Platform.select({ android: '10.0.2.2', default: 'localhost' });

export const API_BASE_URL = __DEV__
  ? `http://${DEV_HOST}:8000/api`
  : 'https://159-89-14-160.sslip.io/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Shape of every DRF ListAPIView response now that pagination is enabled
// (PageNumberPagination, PAGE_SIZE=20 - see backend config/settings.py).
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

apiClient.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Called when a request still fails with 401 after a refresh attempt (or
// there was no refresh token to try). AuthContext registers this to log the
// user out and send them back to SignIn.
let authFailureHandler: (() => void) | null = null;
export function setAuthFailureHandler(handler: () => void) {
  authFailureHandler = handler;
}

// Access tokens live 1 hour (see backend SIMPLE_JWT). Without this, every
// screen just starts silently failing an hour after login. Multiple
// requests failing at once share a single in-flight refresh call instead of
// each firing their own.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem('refresh_token');
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
      refresh: refreshToken,
    });
    const updates: Record<string, string> = { access_token: data.access };
    // ROTATE_REFRESH_TOKENS is on server-side, so a fresh refresh token
    // comes back too and the old one is now blacklisted.
    if (data.refresh) {
      updates.refresh_token = data.refresh;
    }
    await AsyncStorage.setMany(updates);
    return data.access;
  } catch {
    return null;
  }
}

apiClient.interceptors.response.use(
  response => response,
  async error => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retriedAfterRefresh) {
      return Promise.reject(error);
    }
    original._retriedAfterRefresh = true;

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newAccessToken = await refreshPromise;

    if (newAccessToken) {
      original.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(original);
    }

    await AsyncStorage.removeMany(['access_token', 'refresh_token']);
    authFailureHandler?.();
    return Promise.reject(error);
  },
);
