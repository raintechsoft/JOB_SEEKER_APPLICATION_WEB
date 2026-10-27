"use client";

import { createContext, useCallback, useContext } from "react";
import { useQuery, useQueryClient, type QueryKey, type UseQueryResult } from "@tanstack/react-query";
import { useHydrated } from "./use-hydrated";
import type { Services } from "@/services";
import { toast } from "@/stores/toast-store";
import { errorMessage } from "@/services/api/client";

export const ServicesContext = createContext<Services | null>(null);

export function useServices() {
  const services = useContext(ServicesContext);
  if (!services) throw new Error("useServices must be used inside <AppProviders>.");
  return services;
}

/**
 * Reads data through the service layer with TanStack Query. Until hydration completes the query
 * reports "pending", so server HTML and the first client render always agree.
 */
export function useServiceQuery<T>(key: QueryKey, fn: (services: Services) => Promise<T>, options: { enabled?: boolean; keepPreviousData?: boolean; refetchInterval?:number; refetchOnWindowFocus?:boolean | "always"; staleTime?:number } = {}): UseQueryResult<T> {
  const services = useServices();
  const hydrated = useHydrated();
  const result = useQuery({ queryKey: key, queryFn: () => fn(services), enabled: hydrated && options.enabled !== false, refetchInterval:options.refetchInterval, ...(options.staleTime !== undefined ? {staleTime:options.staleTime} : {}), ...(options.refetchOnWindowFocus !== undefined ? {refetchOnWindowFocus:options.refetchOnWindowFocus} : {}), ...(options.keepPreviousData === false ? { placeholderData: () => undefined } : {}) });
  if (hydrated) return result;
  return { ...result, data: undefined, isPending: true, isSuccess: false, isError: false, status: "pending" } as UseQueryResult<T>;
}

/**
 * Runs a write through the service layer, then refreshes queries so every view reflects it.
 * Failures show the prototype's generic error toast and resolve to `undefined`.
 */
export function useServiceAction() {
  const services = useServices();
  const queryClient = useQueryClient();
  return useCallback(
    async <T>(fn: (services: Services) => Promise<T>, options: { refresh?: boolean;invalidate?:string[] } = {}): Promise<T | undefined> => {
      try {
        const result = await fn(services);
        if (options.refresh !== false) await queryClient.invalidateQueries({predicate:(q)=>!options.invalidate||options.invalidate.includes(String(q.queryKey[0]))});
        return result;
      } catch (error) {
        console.error(error);
        toast(errorMessage(error), "error");
        return undefined;
      }
    },
    [services, queryClient],
  );
}
