"use client";
import { useQuery, type QueryKey } from "@tanstack/react-query";
import { useObservedSession } from "@/features/auth/use-observed-session";
import { useHydrated } from "./use-hydrated";
import { useServices } from "./use-services";
import { apiConfig } from "@/services/api/config";
import type { Services } from "@/services";
import type { ReadScope } from "@/services/realtime/realtime.http";

export function useHiringQuery<T>(key: QueryKey, read: (services: Services, scope: ReadScope) => Promise<T>, options: { enabled?: boolean; public?: boolean } = {}) {
  const session = useObservedSession(), services = useServices(), hydrated = useHydrated();
  const real = apiConfig.dataSource === "http", userId = session?.user.id, identityId = session?.selected_identity_id ?? undefined;
  const query = useQuery({
    queryKey: [key[0], real ? userId ?? "guest" : "mock", real ? identityId ?? "guest" : "mock", ...key.slice(1)],
    queryFn: async ({ signal }) => { const result = await read(services, { signal, userId, identityId }); signal.throwIfAborted(); return result; },
    enabled: hydrated && options.enabled !== false && (!real || options.public || !!userId && !!identityId && !!session?.user.email_verified),
    placeholderData: () => undefined, retry: false, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  return { ...query, data: query.isError ? undefined : query.data };
}
