"use client";
import type { QueryKey } from "@tanstack/react-query";
import { useObservedSession } from "@/features/auth/use-observed-session";
import { workspaceKey } from "@/services/realtime/workspace-scope";

export function useWorkspaceCacheKey() {
  const session = useObservedSession();
  return (key: QueryKey) => workspaceKey(key, session?.user.id, session?.selected_identity_id);
}
