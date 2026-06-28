/**
 * Minimal type-safe API client.
 * - Reads JWT from localStorage (key: "token")
 * - Unwraps the standard { success, data } envelope
 * - Throws ApiError on HTTP errors so callers can handle them uniformly
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('auth');
    window.location.href = '/login';
    throw new ApiError(401, 'Unauthorized');
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = (json as any)?.message ?? res.statusText;
    throw new ApiError(res.status, msg, json);
  }

  // Unwrap envelope: { success: true, data: T }
  if (json && typeof json === 'object' && 'success' in json) {
    return (json as { success: boolean; data: T }).data;
  }

  // Some endpoints return the data directly (e.g. plain arrays)
  return json as T;
}

export const api = {
  get<T>(path: string) {
    return request<T>(path);
  },
  post<T>(path: string, body?: unknown) {
    return request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },
  put<T>(path: string, body?: unknown) {
    return request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },
  patch<T>(path: string, body?: unknown) {
    return request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },
  delete<T>(path: string) {
    return request<T>(path, { method: 'DELETE' });
  },
};
