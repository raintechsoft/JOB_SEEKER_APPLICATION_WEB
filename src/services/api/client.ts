/**
 * Credentialed JSON transport for the Laravel API. Mutations initialize Sanctum CSRF
 * and preserve structured errors; callers decide success behavior and safe retry.
 */
import { friendlyErrorMessage } from "@/lib/errors/error-state";

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

/** People-facing text for a failed request; framework and status errors never show raw. */
export function errorMessage(error: unknown): string {
  return friendlyErrorMessage(error);
}

export function fieldErrors(error: unknown): Record<string, string[]> {
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== "object" || !("errors" in error.body) || !error.body.errors || typeof error.body.errors !== "object") return {};
  return Object.fromEntries(Object.entries(error.body.errors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every((value) => typeof value === "string")));
}

type Query = Record<string, string | number | boolean | string[] | undefined>;

function xsrfToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const raw = document.cookie.split("; ").find((cookie) => cookie.startsWith("XSRF-TOKEN="))?.slice(11);
  return raw ? decodeURIComponent(raw) : undefined;
}

async function ensureCsrfCookie(url: URL, signal?: AbortSignal, force = false) {
  if (!force && xsrfToken()) return;
  const csrf = await fetch(new URL("/sanctum/csrf-cookie", url), { credentials: "include", headers: { Accept: "application/json" }, ...(signal ? { signal } : {}) });
  if (!csrf.ok) throw new ApiError("Session initialization failed.", csrf.status);
}

export interface HttpClient {
  setUserContext(userId: string | null): void;
  get<T>(path: string, query?: Query, options?: { signal?: AbortSignal }): Promise<T>;
  post<T>(path: string, body?: unknown, options?: { signal?: AbortSignal; headers?: Record<string,string> }): Promise<T>;
  put<T>(path: string, body?: unknown, options?: {headers?: Record<string,string>}): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: {headers?: Record<string,string>}): Promise<T>;
  delete<T>(path: string, body?: unknown): Promise<T>;
  upload<T>(path: string, file: File, options?: { signal?: AbortSignal; onProgress?: (fraction: number) => void }): Promise<T>;
  blob(path: string): Promise<Blob>;
  /** Fire-and-forget POST that survives the page closing. Returns false when it could not be sent. */
  beacon(path: string, body: unknown): boolean;
}

export function createHttpClient(baseUrl: string): HttpClient {
  let userContext: string | null = null;
  let contextEpoch = 0;
  let contextReady: Promise<void> | null = null;
  const setContext = (id: string | null) => {
    if (id !== userContext || id === null) { contextEpoch++; contextReady = null; }
    userContext = id;
  };
  async function request<T>(method: string, path: string, body?: unknown, query?: Query, binary = false, signal?: AbortSignal, headers?: Record<string,string>): Promise<T> {
    const mutation = method !== "GET";
    const scoped = /^(?:me|organizations|admin|media)(?:\/|$)/.test(path) || /^jobs\/[^/]+\/application-context$/.test(path) || binary || mutation && /^(?:(?:media|jobs)(?:\/|$)|auth\/(?:logout|password|email))/.test(path);
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
    // Reuse a current XSRF cookie so receipts are not blocked behind a CSRF prefetch; never replay a failed mutation.
    if (mutation) await ensureCsrfCookie(url);
    if (scoped && contextEpoch !== expectedEpoch) throw new ApiError("Account context changed.", 412, { message: "Your signed-in account changed. Reload this page before continuing." });
    const send = async (refreshCsrf: boolean) => {
      if (refreshCsrf) await ensureCsrfCookie(url, signal, true);
      const xsrf = xsrfToken();
      return fetch(url, {
        method,
        credentials: "include",
        headers: { ...headers, Accept: binary ? "application/octet-stream" : "application/json", ...(expectedUser ? { "X-Skillora-User": expectedUser } : {}), ...(body !== undefined && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...(mutation && xsrf ? { "X-XSRF-TOKEN": xsrf } : {}) },
        body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
      });
    };
    let response = await send(false);
    // Stale XSRF cookies produce a fast 419 before the controller; refresh once and retry.
    if (mutation && response.status === 419) response = await send(true);
    const payload = response.status === 204 ? undefined : binary && response.ok ? await response.blob() : await response.json().catch(() => undefined);
    if ((scoped || /^jobs(?:\/|$)/.test(path)) && contextEpoch !== expectedEpoch) throw new ApiError("Account context changed.", 412);
    if (!response.ok) { const retry = Number(response.headers.get("Retry-After")); throw new ApiError(`Request failed with status ${response.status}`, response.status, payload, response.status === 429 && retry > 0 ? Math.min(3600, Math.ceil(retry)) : undefined); }
    return payload as T;
  }
  return {
    setUserContext: setContext,
    get: (path, query, options) => request("GET", path, undefined, query, false, options?.signal),
    post: (path, body, options) => request("POST", path, body, undefined, false, options?.signal, options?.headers),
    put: (path, body, options) => request("PUT", path, body, undefined, false, undefined, options?.headers),
    patch: (path, body, options) => request("PATCH", path, body, undefined, false, undefined, options?.headers),
    delete: (path, body) => request("DELETE", path, body),
    async upload<T>(path: string, file: File, options = {} as { signal?: AbortSignal; onProgress?: (fraction: number) => void }): Promise<T> {
      if (!options.onProgress && !options.signal) { const data = new FormData(); data.set("file", file); return request("POST", path, data); }
      const epoch = contextEpoch, owner = userContext, url = new URL(path, baseUrl.replace(/\/?$/, "/"));
      await ensureCsrfCookie(url, options.signal);
      if (epoch !== contextEpoch) throw new ApiError("Account context changed.", 412);
      options.signal?.throwIfAborted();
      return new Promise<T>((resolve, reject) => {
        const xhr = new XMLHttpRequest(), abort = () => xhr.abort();
        xhr.open("POST", url); xhr.withCredentials = true; xhr.timeout = 180000; xhr.setRequestHeader("Accept", "application/json");
        if (owner) xhr.setRequestHeader("X-Skillora-User", owner);
        const xsrf = xsrfToken();
        if (xsrf) xhr.setRequestHeader("X-XSRF-TOKEN", xsrf);
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
    beacon: (path, body) => {
      // The page is closing: one keepalive request on the existing session, no CSRF prefetch, no retry, never throws.
      const xsrf = xsrfToken();
      if (!xsrf || !userContext) return false;
      try {
        const url = new URL(path.replace(/^\//, ""), baseUrl.endsWith("/") ? baseUrl : baseUrl + "/");
        void fetch(url, { method: "POST", keepalive: true, credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json", "X-Skillora-User": userContext, "X-XSRF-TOKEN": xsrf }, body: JSON.stringify(body) }).catch(() => undefined);
        return true;
      } catch {
        return false;
      }
    },
  };
}
