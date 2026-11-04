import type { QueryKey } from "@tanstack/react-query";

const families = new Set(["pulse", "journey-following", "profile", "candidate", "recruiter", "organization", "company", "shell", "journey", "journey-memories", "projects", "project", "updates", "update", "portfolio", "talent", "shortlists", "similar-people", "settings", "notification-preferences", "personalization", "analytics-preference", "blocked-accounts", "admin", "export-status", "outreach-preview"]);
export function workspaceFamily(key: QueryKey) {
  return families.has(String(key[0])) || key[0] === "feed" && key[1] === "identity" || key[0] === "recommendations" && key[1] === "talent";
}
export function workspaceKey(key: QueryKey, user?: string, identity?: string | null) {
  return [...key, "workspace-v1", user ?? "guest", identity ?? "guest"];
}
export function ownsWorkspaceKey(key: QueryKey, user?: string, identity?: string | null) {
  return key.at(-3) === "workspace-v1" && key.at(-2) === (user ?? "guest") && key.at(-1) === (identity ?? "guest");
}
