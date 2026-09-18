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
let refreshPromise: Promise<RefreshResult> | null = null;

// Three outcomes, not two. "The server says this session is over" and "the
// server did not answer" both used to come back as null, and null meant log
// the user out - so a backend that was merely restarting (which is how every
// deploy ends) discarded a refresh token still good for fourteen days.
type RefreshResult =
  | { status: 'refreshed'; access: string }
  | { status: 'unavailable' }
  | { status: 'rejected' };

async function refreshAccessToken(): Promise<RefreshResult> {
  const refreshToken = await AsyncStorage.getItem('refresh_token');
  // No token to refresh with is a real dead end, not a transient one.
  if (!refreshToken) return { status: 'rejected' };
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
    return { status: 'refreshed', access: data.access };
  } catch (e: any) {
    // No response at all - offline, DNS, timeout, connection refused while
    // the service restarts. A 5xx is the same kind of thing: the server
    // failed, it did not rule on the token. Only an answer from the refresh
    // endpoint itself (SimpleJWT replies 401 token_not_valid for one that
    // is expired or blacklisted) means the session is genuinely over.
    const status = e?.response?.status;
    if (status === undefined || status >= 500) return { status: 'unavailable' };
    return { status: 'rejected' };
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
    const result = await refreshPromise;

    if (result.status === 'refreshed') {
      original.headers.Authorization = `Bearer ${result.access}`;
      return apiClient(original);
    }

    if (result.status === 'unavailable') {
      // Keep both tokens and let this one request fail. The screen shows its
      // error state, the next call retries, and the session survives the
      // blip - which is the whole point: signing someone out is not a
      // recoverable action from their side, they have to type a password.
      return Promise.reject(error);
    }

    await AsyncStorage.removeMany(['access_token', 'refresh_token']);
    authFailureHandler?.();
    return Promise.reject(error);
  },
);
