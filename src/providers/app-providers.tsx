"use client";

import { useState, type ReactNode } from "react";
import { keepPreviousData, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServices } from "@/services";
import { ServicesContext } from "@/hooks/use-services";
import { ModalHost } from "@/components/ui/modal-host";
import { Toaster } from "@/components/ui/toaster";
import { GlobalShortcuts } from "@/components/layout/global-shortcuts";
import { apiConfig } from "@/services/api/config";

export function AppProviders({ children }: { children: ReactNode }) {
  const [services] = useState(createServices);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Mock data changes only through our own writes, which invalidate queries explicitly.
            staleTime: apiConfig.dataSource === "mock" ? Infinity : 30_000,
            refetchOnWindowFocus: apiConfig.dataSource !== "mock",
            retry: apiConfig.dataSource === "mock" ? false : 1,
            placeholderData: keepPreviousData,
          },
        },
      }),
  );
  return (
    <ServicesContext.Provider value={services}>
      <QueryClientProvider client={queryClient}>
        {children}
        <GlobalShortcuts />
        <ModalHost />
        <Toaster />
      </QueryClientProvider>
    </ServicesContext.Provider>
  );
}
