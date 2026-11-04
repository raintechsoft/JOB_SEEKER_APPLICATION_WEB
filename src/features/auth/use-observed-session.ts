"use client";
import {useQuery} from "@tanstack/react-query";
import {useServices} from "@/hooks/use-services";
import type {AuthSession} from "@/services/auth/auth.service";

/** Observe current account state without starting a session request or tracking. */
export function useObservedSession(){
  const services=useServices();
  return useQuery<AuthSession|null>({queryKey:["auth","session"],queryFn:()=>services.auth.inspect?services.auth.inspect():services.auth.me(),enabled:false,retry:false}).data;
}
