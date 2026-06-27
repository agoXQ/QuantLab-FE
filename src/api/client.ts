import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
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
  timeout: 30000,
});

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
  (err: AxiosError<ApiEnvelope<unknown>>) => {
    const env = err.response?.data;
    if (env && typeof env.code === 'number') {
      return Promise.reject(new ApiError(env.code, env.message, err.response?.status ?? 0, env.request_id));
    }
    if (env && typeof env === 'object') {
      const obj = env as unknown as Record<string, unknown>;
      const message = typeof obj.error === 'string'
        ? obj.error
        : typeof obj.message === 'string'
          ? obj.message
          : err.message;
      return Promise.reject(new ApiError(err.response?.status ?? 0, message, err.response?.status ?? 0));
    }
    return Promise.reject(new ApiError(err.response?.status ?? 0, err.message, err.response?.status ?? 0));
  },
);
