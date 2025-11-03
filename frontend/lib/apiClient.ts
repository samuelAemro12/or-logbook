import { auth } from '../FirebaseConfig';

// Default to the local Firebase functions emulator URL used during development.
// You can override this by setting EXPO_PUBLIC_API_BASE_URL in your environment.
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://127.0.0.1:5001/or-logbook/us-central1/api';

type FetchOptions = RequestInit & { retry?: boolean };

export type ApiError = {
  code: 'UNAUTHENTICATED' | 'UNAUTHORIZED' | string;
  message: string;
  status?: number;
  body?: any;
};

/**
 * apiFetch: fetch wrapper that always attaches Firebase ID token and normalizes errors.
 * Throws ApiError on failure.
 */
export default async function apiFetch<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;

  // Build headers, preserve any custom headers passed in
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  // Ensure we have a logged-in user and attach token
  const current = auth.currentUser;
  if (!current) {
    console.warn('apiClient: no authenticated user (auth.currentUser is null)');
    const e: ApiError = { code: 'UNAUTHENTICATED', message: 'You need to log in.' };
    throw e;
  }

  let token: string | null = null;
  try {
    token = await current.getIdToken();
  } catch (err) {
    console.warn('apiClient: failed to obtain ID token', err);
    const e: ApiError = { code: 'UNAUTHENTICATED', message: 'You need to log in.' };
    throw e;
  }

  if (!token) {
    const e: ApiError = { code: 'UNAUTHENTICATED', message: 'You need to log in.' };
    throw e;
  }

  headers.Authorization = `Bearer ${token}`;

  const init: RequestInit = {
    ...options,
    headers,
  };

  const res = await fetch(url, init);

  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    // Normalize common auth errors
    if (res.status === 401) {
      const err: ApiError = { code: 'UNAUTHENTICATED', message: (body && body.message) || 'You need to log in.', status: 401, body };
      throw err;
    }

    if (res.status === 403) {
      const err: ApiError = { code: 'UNAUTHORIZED', message: (body && body.message) || 'You lack permissions.', status: 403, body };
      throw err;
    }

    const err: ApiError = { code: `HTTP_${res.status}`, message: (body && body.message) || `Request failed with status ${res.status}`, status: res.status, body };
    throw err;
  }

  return body as T;
}

// Convenience helpers for common endpoints used by the app
export async function createPatient(payload: any) {
  return apiFetch('/api/patients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function createOperation(payload: any) {
  return apiFetch('/api/operations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getSurgeons() {
  return apiFetch('/api/surgeons');
}
