/**
 * What happens when the token refresh does not succeed.
 *
 * There are two ways for it not to succeed and they must not be treated
 * alike: the server ruling that the session is over, and the server not
 * answering at all. Conflating them signs the user out whenever the backend
 * blinks - and every deploy ends in `systemctl restart expertgg`, so that
 * window is routine rather than theoretical. Signing someone out is not
 * recoverable from their side; they have to type a password again.
 */
const store: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => store[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      store[k] = v;
    }),
    setMany: jest.fn(async (entries: Record<string, string>) => {
      Object.assign(store, entries);
    }),
    removeMany: jest.fn(async (keys: string[]) => {
      keys.forEach(k => delete store[k]);
    }),
  },
}));

// Answers the original request with a 401 the first time and a 200 on the
// retry, which is the sequence the interceptor exists for. A custom adapter
// has to reject non-2xx itself - axios only applies validateStatus inside
// its own adapters.
function adapterThatExpiresOnce() {
  return jest.fn(async (config: any) => {
    if (config._retriedAfterRefresh) {
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    }
    const error: any = new Error('Request failed with status code 401');
    error.isAxiosError = true;
    error.config = config;
    error.response = { data: {}, status: 401, statusText: 'Unauthorized', headers: {}, config };
    throw error;
  });
}

// Fresh module state per test: the single-flight refresh promise lives at
// module scope, and a leftover one would make tests depend on each other.
// axios is required from inside the same isolated registry, because a spy
// on the outer copy would not be the object the client module imported -
// the refresh would then make a real request and every test would pass or
// fail for the wrong reason.
function load() {
  let mod: typeof import('../client');
  let axios: any;
  jest.isolateModules(() => {
    const required = require('axios');
    axios = required.default ?? required;
    mod = require('../client');
  });
  return { ...mod!, axios };
}

describe('the response interceptor when a refresh fails', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k]);
    store.access_token = 'expired-access';
    store.refresh_token = 'good-refresh';
    jest.restoreAllMocks();
  });

  it('retries the request once the refresh succeeds', async () => {
    const { apiClient, axios } = load();
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: { access: 'fresh-access', refresh: 'rotated-refresh' },
    } as any);
    apiClient.defaults.adapter = adapterThatExpiresOnce();

    const response = await apiClient.get('/matches/');

    expect(response.status).toBe(200);
    expect(store.access_token).toBe('fresh-access');
    expect(store.refresh_token).toBe('rotated-refresh');
  });

  it('keeps the session when the refresh gets no answer', async () => {
    // An axios network error: no `response` at all.
    const { apiClient, setAuthFailureHandler, axios } = load();
    jest.spyOn(axios, 'post').mockRejectedValue({ message: 'Network Error' });
    apiClient.defaults.adapter = adapterThatExpiresOnce();
    const onAuthFailure = jest.fn();
    setAuthFailureHandler(onAuthFailure);

    await expect(apiClient.get('/matches/')).rejects.toBeDefined();

    // The refresh token is good for another fourteen days - the one request
    // fails, the screen shows its error state, the next call retries.
    expect(store.refresh_token).toBe('good-refresh');
    expect(onAuthFailure).not.toHaveBeenCalled();
  });

  it('keeps the session when the refresh endpoint itself errors', async () => {
    // A 502 from nginx while gunicorn restarts is the server failing, not a
    // ruling on the token.
    const { apiClient, setAuthFailureHandler, axios } = load();
    jest.spyOn(axios, 'post').mockRejectedValue({ response: { status: 502 } });
    apiClient.defaults.adapter = adapterThatExpiresOnce();
    const onAuthFailure = jest.fn();
    setAuthFailureHandler(onAuthFailure);

    await expect(apiClient.get('/matches/')).rejects.toBeDefined();

    expect(store.refresh_token).toBe('good-refresh');
    expect(onAuthFailure).not.toHaveBeenCalled();
  });

  it('signs the user out when the server rejects the refresh token', async () => {
    // SimpleJWT answers 401 token_not_valid for an expired or blacklisted
    // refresh token. This is the one case that really is a dead session.
    const { apiClient, setAuthFailureHandler, axios } = load();
    jest.spyOn(axios, 'post').mockRejectedValue({
      response: { status: 401, data: { code: 'token_not_valid' } },
    });
    apiClient.defaults.adapter = adapterThatExpiresOnce();
    const onAuthFailure = jest.fn();
    setAuthFailureHandler(onAuthFailure);

    await expect(apiClient.get('/matches/')).rejects.toBeDefined();

    expect(store.access_token).toBeUndefined();
    expect(store.refresh_token).toBeUndefined();
    expect(onAuthFailure).toHaveBeenCalled();
  });
});
