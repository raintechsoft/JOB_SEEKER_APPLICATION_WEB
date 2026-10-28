/**
 * Credentialed JSON transport for the Laravel API. Mutations initialize Sanctum CSRF
 * and preserve structured errors; callers decide success behavior and safe retry.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.body && typeof error.body === "object" && "message" in error.body && typeof error.body.message === "string") return error.body.message;
  return "The request could not be completed. Please try again.";
}

export function fieldErrors(error: unknown): Record<string, string[]> {
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== "object" || !("errors" in error.body) || !error.body.errors || typeof error.body.errors !== "object") return {};
  return Object.fromEntries(Object.entries(error.body.errors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every((value) => typeof value === "string")));
}

type Query = Record<string, string | number | boolean | string[] | undefined>;

export interface HttpClient {
  setUserContext(userId: string | null): void;
  get<T>(path: string, query?: Query, options?: { signal?: AbortSignal }): Promise<T>;
  post<T>(path: string, body?: unknown, options?: { signal?: AbortSignal }): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string, body?: unknown): Promise<T>;
  upload<T>(path: string, file: File, options?: { signal?: AbortSignal; onProgress?: (fraction: number) => void }): Promise<T>;
  blob(path: string): Promise<Blob>;
}

export function createHttpClient(baseUrl: string): HttpClient {
  let userContext: string | null = null;
  let contextEpoch = 0;
  let contextReady: Promise<void> | null = null;
  const setContext = (id: string | null) => {
    if (id !== userContext || id === null) { contextEpoch++; contextReady = null; }
    userContext = id;
  };
  async function request<T>(method: string, path: string, body?: unknown, query?: Query, binary = false, signal?: AbortSignal): Promise<T> {
    const mutation = method !== "GET";
    const scoped = /^(?:me|organizations|admin)(?:\/|$)/.test(path) || binary || mutation && /^(?:(?:media|jobs)(?:\/|$)|auth\/(?:logout|password|email))/.test(path);
    // Establish the actor before loading an owned form, including a direct workspace navigation.
    if (scoped && userContext === null) {
      if (!contextReady) {
        const epoch = contextEpoch;
        contextReady = request<{ data: { user: { id: string } } }>("GET", "auth/me").then((session) => { if (contextEpoch === epoch && userContext === null) setContext(session.data.user.id); });
      }
      const pending = contextReady;
      try { await pending; } finally { if (contextReady === pending) contextReady = null; }
    }
    const expectedUser = userContext, expectedEpoch = contextEpoch;
    const url = new URL(path.replace(/^\//, ""), baseUrl.endsWith("/") ? baseUrl : baseUrl + "/");
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === "") continue;
      for (const v of Array.isArray(value) ? value : [value]) url.searchParams.append(Array.isArray(value) ? key + "[]" : key, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
    }
    if (mutation) {
      // A fresh CSRF cookie is safe to request; never replay a failed mutation automatically.
      const csrf = await fetch(new URL("/sanctum/csrf-cookie", url), { credentials: "include", headers: { Accept: "application/json" } });
      if (!csrf.ok) throw new ApiError("Session initialization failed.", csrf.status);
    }
    const xsrf = typeof document === "undefined" ? undefined : document.cookie.split("; ").find((c) => c.startsWith("XSRF-TOKEN="))?.slice(11);
    if (scoped && contextEpoch !== expectedEpoch) throw new ApiError("Account context changed.", 412, { message: "Your signed-in account changed. Reload this page before continuing." });
    const response = await fetch(url, {
      method,
      credentials: "include",
      headers: { Accept: binary ? "application/octet-stream" : "application/json", ...(expectedUser ? { "X-Skillora-User": expectedUser } : {}), ...(body !== undefined && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...(mutation && xsrf ? { "X-XSRF-TOKEN": decodeURIComponent(xsrf) } : {}) },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
    });
    const payload = response.status === 204 ? undefined : binary && response.ok ? await response.blob() : await response.json().catch(() => undefined);
    if (!response.ok) { const retry = Number(response.headers.get("Retry-After")); throw new ApiError(`Request failed with status ${response.status}`, response.status, payload, response.status === 429 && retry > 0 ? Math.min(3600, Math.ceil(retry)) : undefined); }
    return payload as T;
  }
  return {
    setUserContext: setContext,
    get: (path, query, options) => request("GET", path, undefined, query, false, options?.signal),
    post: (path, body, options) => request("POST", path, body, undefined, false, options?.signal),
    patch: (path, body) => request("PATCH", path, body),
    delete: (path, body) => request("DELETE", path, body),
    async upload<T>(path: string, file: File, options = {} as { signal?: AbortSignal; onProgress?: (fraction: number) => void }): Promise<T> {
      if (!options.onProgress && !options.signal) { const data = new FormData(); data.set("file", file); return request("POST", path, data); }
      const epoch = contextEpoch, owner = userContext, url = new URL(path, baseUrl.replace(/\/?$/, "/"));
      const csrf = await fetch(new URL("/sanctum/csrf-cookie", url), { credentials: "include", signal: options.signal, headers: { Accept: "application/json" } });
      if (!csrf.ok) throw new ApiError("Session initialization failed.", csrf.status);
      if (epoch !== contextEpoch) throw new ApiError("Account context changed.", 412);
      options.signal?.throwIfAborted();
      return new Promise<T>((resolve, reject) => {
        const xhr = new XMLHttpRequest(), abort = () => xhr.abort();
        xhr.open("POST", url); xhr.withCredentials = true; xhr.timeout = 180000; xhr.setRequestHeader("Accept", "application/json");
        if (owner) xhr.setRequestHeader("X-Skillora-User", owner);
        const xsrf = document.cookie.split("; ").find(c => c.startsWith("XSRF-TOKEN="))?.slice(11);
        if (xsrf) xhr.setRequestHeader("X-XSRF-TOKEN", decodeURIComponent(xsrf));
        options.signal?.addEventListener("abort", abort, { once: true });
        const done = () => options.signal?.removeEventListener("abort", abort);
        xhr.upload.onprogress = e => { if (e.lengthComputable) options.onProgress?.(Math.min(1, e.loaded / e.total)); };
        xhr.onload = () => { done(); let body; try { body = JSON.parse(xhr.responseText); } catch { body = undefined; } if (xhr.status >= 200 && xhr.status < 300) resolve(body as T); else reject(new ApiError("Upload failed.", xhr.status, body)); };
        xhr.onerror = xhr.ontimeout = () => { done(); reject(new ApiError("The upload connection was interrupted.", 503)); };
        xhr.onabort = () => { done(); reject(new DOMException("Upload cancelled.", "AbortError")); };
        const data = new FormData(); data.set("file", file); xhr.send(data);
      });
    },
    blob: (path) => request<Blob>("GET", path, undefined, undefined, true),
  };
}
