import type { AuthSession } from "@/services/auth/auth.service";

export function authDestination(session: AuthSession, requested?: "professional" | "recruiter") {
  if (!session.user.email_verified) return "/verify-email";
  const identity = session.workspaces.find((w) => w.id === session.selected_identity_id && (!requested || w.kind === requested))
    ?? session.workspaces.find((w) => !requested || w.kind === requested) ?? session.workspaces[0];
  return identity?.kind === "recruiter" ? "/recruiter/dashboard" : "/app/dashboard";
}
