/**
 * Minimal JSON HTTP client for the future backend API. Feature services will use it once
 * `NEXT_PUBLIC_DATA_SOURCE=http` implementations are written (see docs/frontend-architecture.md).
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Query = Record<string, string | number | boolean | string[] | undefined>;

export interface HttpClient {
  get<T>(path: string, query?: Query): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}

export function createHttpClient(baseUrl: string, getToken?: () => string | undefined): HttpClient {
  async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
    const url = new URL(path.replace(/^\//, ""), baseUrl.endsWith("/") ? baseUrl : baseUrl + "/");
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === "") continue;
      for (const v of Array.isArray(value) ? value : [value]) url.searchParams.append(key, String(v));
    }
    const token = getToken?.();
    const response = await fetch(url, {
      method,
      credentials: "include",
      headers: { Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = response.status === 204 ? undefined : await response.json().catch(() => undefined);
    if (!response.ok) throw new ApiError(`Request failed with status ${response.status}`, response.status, payload);
    return payload as T;
  }
  return {
    get: (path, query) => request("GET", path, undefined, query),
    post: (path, body) => request("POST", path, body),
    patch: (path, body) => request("PATCH", path, body),
    delete: (path) => request("DELETE", path),
  };
}
