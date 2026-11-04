"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useServiceAction, useServices } from "@/hooks/use-services";
import { apiConfig } from "@/services/api/config";
import { toast } from "@/stores/toast-store";
import { devCopy } from "@/lib/env/app-env";
import { clearIdentityState } from "@/features/auth/clear-identity-state";

export function useLogout() {
  const run = useServiceAction();
  const router = useRouter();
  const cache = useQueryClient();
  const services = useServices();
  return async () => {
    if (apiConfig.dataSource === "http") {
      await services.auth.logout();
      clearIdentityState();
      cache.clear();
      router.push("/login");
      return;
    }
    await run((s) => s.workspace.signOut());
    router.push("/");
    toast(devCopy("You’ve left the demo workspace. Local changes are kept.", "You’ve signed out."));
  };
}
