import type { Id, Role } from "@/types/domain";

/** Share only the entry permalink, never current search parameters or private post content. */
export function postShareUrl(role: Role, postId: Id, origin: string) {
  const base = new URL(origin);
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) throw new Error("A valid site address is required.");
  const path = role === "recruiter" ? "/recruiter/dashboard" : "/app/dashboard";
  const url = new URL(path, base.origin);
  url.searchParams.set("post", postId);
  return url.toString();
}

