import type { User } from './types';
let token = '';
let refreshInFlight: Promise<{ access_token: string; user: User }> | null = null;
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export function setToken(value: string) { token = value; }
async function errorFrom(response: Response) {
  const data = await response.json().catch(() => ({}));
  return new ApiError(typeof data.detail === 'string' ? data.detail : response.status === 429 ? 'Too many requests. Give it a moment, then try again.' : 'Something went wrong. Please try again.', response.status);
}
export function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(async response => {
        if (!response.ok) throw await errorFrom(response);
        const data = await response.json();
        token = data.access_token;
        return data;
      }).finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}
export async function api<T = unknown>(path: string, method = 'GET', body?: unknown, retry = true): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api' + path, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch { throw new ApiError('Cannot reach EduQuiz. Check your connection and try again.', 0); }
  if (response.status === 401 && !path.startsWith('/auth/')) {
    if (retry) {
      try { await refreshSession(); }
      catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          token = ''; window.dispatchEvent(new Event('eduquiz:session-expired'));
        }
        throw error;
      }
      return api<T>(path, method, body, false);
    }
    token = ''; window.dispatchEvent(new Event('eduquiz:session-expired'));
  }
  if (!response.ok) throw await errorFrom(response);
  return response.json();
}
