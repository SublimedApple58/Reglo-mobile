import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { ApiError, ApiResponse, ApiSuccess } from '../types/regloApi';

const DEFAULT_BASE_URL = 'https://app.reglo.it/api';
const TOKEN_KEY = 'reglo_token';
const COMPANY_KEY = 'reglo_active_company_id';
const IS_WEB = Platform.OS === 'web';

const getWebStorage = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
};

const safeStorage = {
  getItem: async (key: string) => {
    try {
      if (IS_WEB) {
        return getWebStorage()?.getItem(key) ?? null;
      }
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.warn('[Reglo] Storage get error', error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      if (IS_WEB) {
        getWebStorage()?.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.warn('[Reglo] Storage set error', error);
    }
  },
  deleteItem: async (key: string) => {
    try {
      if (IS_WEB) {
        getWebStorage()?.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn('[Reglo] Storage delete error', error);
    }
  },
};

type RequestOptions = {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  token?: string | null;
  companyId?: string | null;
};

export class RegloApiError extends Error {
  status?: number;
  payload?: unknown;

  constructor(message: string, status?: number, payload?: unknown) {
    super(message);
    this.name = 'RegloApiError';
    this.status = status;
    this.payload = payload;
  }
}

const buildUrl = (baseUrl: string, path: string) => {
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  if (trimmedBase.endsWith('/api') && withSlash.startsWith('/api/')) {
    return `${trimmedBase}${withSlash.replace(/^\/api/, '')}`;
  }
  return `${trimmedBase}${withSlash}`;
};

const withQuery = (url: string, params?: RequestOptions['params']) => {
  if (!params) return url;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    search.append(key, String(value));
  });
  const query = search.toString();
  if (!query) return url;
  return `${url}?${query}`;
};

const safeJson = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const toError = (status: number | undefined, json: ApiError | null, fallback: string) => {
  if (json?.message) return new RegloApiError(json.message, status, json);
  return new RegloApiError(fallback, status, json);
};

export const authStorage = {
  getToken: async () => safeStorage.getItem(TOKEN_KEY),
  setToken: async (token: string) => safeStorage.setItem(TOKEN_KEY, token),
  getActiveCompanyId: async () => safeStorage.getItem(COMPANY_KEY),
  setActiveCompanyId: async (companyId: string | null) => {
    if (!companyId) {
      await safeStorage.deleteItem(COMPANY_KEY);
      return;
    }
    await safeStorage.setItem(COMPANY_KEY, companyId);
  },
  clear: async () => {
    await safeStorage.deleteItem(TOKEN_KEY);
    await safeStorage.deleteItem(COMPANY_KEY);
  },
};

export const createApiClient = (baseUrl = DEFAULT_BASE_URL) => {
  const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
    const url = withQuery(buildUrl(baseUrl, path), options.params);
    const token = options.token ?? (await authStorage.getToken());
    const companyId = options.companyId ?? (await authStorage.getActiveCompanyId());

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    };

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (companyId) {
      headers['x-reglo-company-id'] = companyId;
    }

    const response = await fetch(url, {
      method: options.method ?? (options.body ? 'POST' : 'GET'),
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const json = (await safeJson(response)) as ApiResponse<T> | null;

    if (!response.ok) {
      console.error('[Reglo API] HTTP error', response.status, json);
      throw toError(response.status, json as ApiError | null, response.statusText);
    }

    if (json && 'success' in json) {
      if (!json.success) {
        console.error('[Reglo API] Application error', json);
        throw toError(response.status, json as ApiError, 'Request failed');
      }
      return (json as ApiSuccess<T>).data;
    }

    return json as T;
  };

  return {
    baseUrl,
    request,
  };
};
