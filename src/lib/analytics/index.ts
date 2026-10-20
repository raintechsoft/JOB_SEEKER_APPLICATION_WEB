/**
 * Centralised product analytics.
 *
 * Components call `track()` with a typed event; an adapter decides where it goes. In development the
 * console adapter logs events; in production the no-op adapter is used until Mixpanel is configured
 * with `setAnalyticsAdapter()` (see docs/frontend-architecture.md#analytics).
 *
 * Privacy rule: properties carry identifiers and coarse context only. Never send names, emails,
 * message contents, notes, tokens or free-text profile data.
 */
export interface AnalyticsEvents {
  feed_item_impression: { itemId: string; itemType: string; surface: string; position: number };
  feed_item_clicked: { itemId: string; itemType: string; target: string };
  job_viewed: { jobId: string; surface: string };
  job_saved: { jobId: string; saved: boolean };
  job_application_started: { jobId: string };
  job_application_completed: { jobId: string; screeningQuestions: number };
  company_followed: { companyId: string; following: boolean };
  person_followed: { personId: string; following: boolean };
  post_liked: { postId: string; liked: boolean };
  post_saved: { postId: string; saved: boolean };
  post_commented: { postId: string };
  post_published: { mediaCount: number; hasProject: boolean };
  search_performed: { surface: "feed" | "talent" | "applications" | "responses" | "jobs" | "projects" | "messages"; hasQuery: boolean; resultCount?: number };
  job_alert_saved: { arrangement: string; days: number };
}

export type AnalyticsEventName = keyof AnalyticsEvents;

export interface AnalyticsAdapter {
  track<E extends AnalyticsEventName>(name: E, properties: AnalyticsEvents[E]): void;
}

const consoleAdapter: AnalyticsAdapter = {
  track(name, properties) {
    console.debug("[analytics]", name, properties);
  },
};

const noopAdapter: AnalyticsAdapter = { track() {} };

let adapter: AnalyticsAdapter = process.env.NODE_ENV === "development" ? consoleAdapter : noopAdapter;

export function setAnalyticsAdapter(next: AnalyticsAdapter) {
  adapter = next;
}

export function track<E extends AnalyticsEventName>(name: E, properties: AnalyticsEvents[E]) {
  try {
    adapter.track(name, properties);
  } catch {
    // Analytics must never break the product experience.
  }
}
