import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { useTokenStore } from '@/store/auth';

// The gateway returns { code, message, data, meta, request_id };
// code === 0 means success. The interceptor unwraps data so callers
// receive the payload directly, and surfaces a typed ApiError otherwise.
export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
  meta?: { next_cursor?: string; has_more?: boolean };
  request_id?: string;
}

export class ApiError extends Error {
  code: number;
  requestId?: string;
  status: number;
  constructor(code: number, message: string, status: number, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

export const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 60000,
});

const refreshClient = axios.create({
  baseURL: '/api/v1',
  timeout: 60000,
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string | null> | null = null;

// Attach access token + request id.
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useTokenStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (!config.headers['X-Request-Id']) {
    config.headers['X-Request-Id'] = crypto.randomUUID();
  }
  return config;
});

// Unwrap envelope; reject on non-zero code.
// The gateway returns list collections under `items`, and emits `null`
// (not `[]`) when a collection is empty. Normalizing here keeps every
// caller from having to guard `.items.length` against null.
function normalizeData<T>(data: T): T {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    if ('items' in obj && obj.items == null) obj.items = [];
  }
  return data;
}

apiClient.interceptors.response.use(
  (resp) => {
    const env = resp.data as ApiEnvelope<unknown>;
    if (env && typeof env.code === 'number') {
      if (env.code === 0) {
        return { ...resp, data: normalizeData(env.data), meta: env.meta };
      }
      throw new ApiError(env.code, env.message, resp.status, env.request_id);
    }
    return resp;
  },
  async (err: AxiosError<ApiEnvelope<unknown>>) => {
    const config = err.config as RetryConfig | undefined;
    if (err.response?.status === 401 && config && !config._retry && !isAuthRequest(config.url)) {
      config._retry = true;
      const token = await refreshAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        return apiClient.request(config);
      }
    }
    return Promise.reject(toApiError(err));
  },
);

function isAuthRequest(url?: string) {
  return !!url && (url.includes('/users/login') || url.includes('/users/register') || url.includes('/users/token/refresh'));
}

async function refreshAccessToken() {
  const { refreshToken, logout, login } = useTokenStore.getState();
  if (!refreshToken) {
    logout();
    return null;
  }
  refreshPromise ??= refreshClient
    .post<ApiEnvelope<{ user_id: number; access_token: string; refresh_token: string }>>('/users/token/refresh', {
      refresh_token: refreshToken,
    })
    .then((resp: AxiosResponse<ApiEnvelope<{ user_id: number; access_token: string; refresh_token: string }>>) => {
      if (resp.data.code !== 0) throw new Error(resp.data.message);
      const data = resp.data.data;
      login({ access_token: data.access_token, refresh_token: data.refresh_token, user_id: data.user_id });
      return data.access_token;
    })
    .catch(() => {
      logout();
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

function toApiError(err: AxiosError<ApiEnvelope<unknown>>) {
  const env = err.response?.data;
  if (env && typeof env.code === 'number') {
    return new ApiError(env.code, env.message, err.response?.status ?? 0, env.request_id);
  }
  if (env && typeof env === 'object') {
    const obj = env as unknown as Record<string, unknown>;
    const message = typeof obj.error === 'string'
      ? obj.error
      : typeof obj.message === 'string'
        ? obj.message
        : err.message;
    return new ApiError(err.response?.status ?? 0, message, err.response?.status ?? 0);
  }
  return new ApiError(err.response?.status ?? 0, err.message, err.response?.status ?? 0);
}
