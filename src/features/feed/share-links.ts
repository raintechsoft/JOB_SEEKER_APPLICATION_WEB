import type { Id, Role } from "@/types/domain";
import type { PublicFeedEntry } from "@/services/public-browsing/public-browsing.service";

/** Share only the entry permalink, never current search parameters or private post content. */
export function postShareUrl(role: Role, postId: Id, origin: string) {
  const base = new URL(origin);
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) throw new Error("A valid site address is required.");
  const path = role === "recruiter" ? "/recruiter/dashboard" : "/app/dashboard";
  const url = new URL(path, base.origin);
  url.searchParams.set("post", postId);
  return url.toString();
}


export const EXTERNAL_SHARE_TEXT_MAX = 200;

/**
 * Payload for the system share sheet (navigator.share). Apps that cannot fetch Open Graph data, or
 * that render the shared text instead, still get the author, title and an excerpt. Private entries
 * (no public record) share only the workspace link under a generic title: nothing private leaks.
 */
export function externalSharePayload(entry: PublicFeedEntry | null | undefined, url: string): ShareData {
  if (!entry) return { title: "Post on Skillora", url };
  const who = entry.author?.name ?? entry.company?.name ?? "";
  const kind = entry.kind === "job" ? "Job" : entry.kind === "update" ? "Work update" : "Post";
  const title = entry.title.trim() || (who ? `${kind} by ${who}` : `${kind} on Skillora`);
  const body = entry.body.replace(/\s+/g, " ").trim();
  const text = body ? (body.length > EXTERNAL_SHARE_TEXT_MAX ? body.slice(0, EXTERNAL_SHARE_TEXT_MAX - 1).trimEnd() + "…" : body) : who ? `${who} on Skillora` : "Shared on Skillora";
  return { title: who ? `${who}: ${title}` : title, text, url };
}
