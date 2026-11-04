"use client";
import { replaceEqualDeep, useQuery, type QueryKey } from "@tanstack/react-query";
import { useObservedSession } from "@/features/auth/use-observed-session";
import { useHydrated } from "./use-hydrated";
import { useServices } from "./use-services";
import { apiConfig } from "@/services/api/config";
import { keepConversationReceipts, keepInboxReceipts } from "@/services/messaging/message-status";
import type { ConversationView, Inbox } from "@/services/messaging/messaging.service";
import type { Services } from "@/services";
import type { ReadScope } from "@/services/realtime/realtime.http";

/** Private snapshots are never carried between account/workspace keys. The shared provider owns recovery. */
export function useCommunicationQuery<T>(key: QueryKey, fn: (services: Services, scope: ReadScope) => Promise<T>, options: { enabled?: boolean } = {}) {
  const session = useObservedSession(), services = useServices(), hydrated = useHydrated();
  const real = apiConfig.dataSource === "http";
  const userId = session?.user.id, identityId = session?.selected_identity_id ?? undefined;
  return useQuery({
    queryKey: [key[0], real ? userId : "mock", real ? identityId : "mock", ...key.slice(1)],
    queryFn: ({ signal }) => fn(services, { signal, userId, identityId }),
    enabled: hydrated && options.enabled !== false && (!real || !!userId && !!identityId && !!session?.user.email_verified),
    placeholderData: () => undefined, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
    structuralSharing: (previous, next) => {
      if (key[0] === "message-history" && previous && next) return keepConversationReceipts(previous as ConversationView, next as ConversationView) as T;
      if (key[0] === "messaging" && previous && next) return keepInboxReceipts(previous as Inbox, next as Inbox) as T;
      return replaceEqualDeep(previous, next);
    },
  });
}
