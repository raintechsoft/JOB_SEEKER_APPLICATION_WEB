import { ApiError } from "@/services/api/client";

/** The situations a screen can explain to people; each has one title, message and next step. */
export type ErrorKind = "offline" | "signedOut" | "forbidden" | "notFound" | "expired" | "rateLimited" | "unavailable" | "unknown";

export interface ErrorState {
  kind: ErrorKind;
  title: string;
  message: string;
  /** Seconds to wait before retrying, for rate limits. */
  retryAfter?: number;
  /** Whether retrying the same request can help. */
  retryable: boolean;
}

const COPY: Record<ErrorKind, Omit<ErrorState, "kind" | "retryAfter">> = {
  offline: { title: "You’re offline", message: "Check your internet connection, then try again.", retryable: true },
  signedOut: { title: "Sign in to continue", message: "Your session has ended. Sign in again to pick up where you left off.", retryable: false },
  forbidden: { title: "You don’t have access", message: "This page isn’t available to your account or current workspace.", retryable: false },
  notFound: { title: "We can’t find this", message: "It may have been removed, made private, or the link may be wrong.", retryable: false },
  expired: { title: "This page needs a refresh", message: "Your account changed or this page is out of date. Reload to continue.", retryable: false },
  rateLimited: { title: "Too many requests", message: "Please wait a moment before trying again.", retryable: true },
  unavailable: { title: "Something went wrong on our side", message: "This is temporary. Please try again in a moment.", retryable: true },
  unknown: { title: "We couldn’t load this", message: "Something interrupted the request. Please try again.", retryable: true },
};

function isOffline(error: unknown) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return error instanceof TypeError && /fetch|network|load failed/i.test(error.message);
}

export function errorKind(error: unknown): ErrorKind {
  if (isOffline(error)) return "offline";
  if (error instanceof DOMException && error.name === "TimeoutError") return "unavailable";
  if (!(error instanceof ApiError)) return "unknown";
  const { status } = error;
  if (status === 401) return "signedOut";
  if (status === 403) return "forbidden";
  if (status === 404 || status === 410) return "notFound";
  if (status === 409 || status === 412 || status === 419) return "expired";
  if (status === 429) return "rateLimited";
  if (status >= 500) return "unavailable";
  return "unknown";
}

/** Classifies any thrown value into user-facing copy; raw server text is never shown here. */
export function describeError(error: unknown): ErrorState {
  const kind = errorKind(error);
  const retryAfter = error instanceof ApiError ? error.retryAfterSeconds : undefined;
  return { kind, ...COPY[kind], ...(retryAfter ? { retryAfter } : {}) };
}

/** Laravel framework defaults that read as technical jargon to people. */
const FRAMEWORK_MESSAGES = /^(unauthenticated|this action is unauthorized|too many attempts|server error|csrf token mismatch|not found|the given data was invalid|forbidden|no query results for model.*|request failed with status \d+)\.?$/i;

/**
 * One-line message for toasts and inline form errors. Business messages written for people
 * (validation, conflicts) pass through; status and framework errors use the shared copy.
 */
export function friendlyErrorMessage(error: unknown, fallback = "The request could not be completed. Please try again."): string {
  const kind = errorKind(error);
  if (error instanceof ApiError && [400, 403, 404, 409, 410, 422].includes(error.status) && error.body && typeof error.body === "object" && "message" in error.body && typeof error.body.message === "string") {
    const text = error.body.message.trim();
    if (text && !FRAMEWORK_MESSAGES.test(text)) return text;
  }
  if (kind === "unknown") return fallback;
  const state = describeError(error);
  if (kind === "rateLimited" && state.retryAfter) return `Too many requests. Try again in ${state.retryAfter} seconds.`;
  return state.message;
}
