"use client";
import {useEffect,type ReactNode} from "react";
import {usePathname} from "next/navigation";
import {apiConfig} from "@/services/api/config";
import {useObservedSession} from "./use-observed-session";
import {ScreenFallback} from "@/components/ui/feedback";

export function refreshAccountEntry(){window.location.replace(window.location.pathname+window.location.search);}

/** A cached Back/prefetch response must not revive a guest form for a known account. */
export function AccountEntryBoundary({children}:{children:ReactNode}){
  const session=useObservedSession(),pathname=usePathname();
  const entry=["/login","/signup","/employer/login","/employer/register"].includes(pathname);
  const query=typeof window==="undefined"?null:new URLSearchParams(window.location.search);
  const oauth=pathname==="/login"&&(query?.get("google")==="success"||query?.has("google_error"));
  const refresh=apiConfig.dataSource==="http"&&!!session&&entry&&!oauth;
  useEffect(()=>{if(refresh)refreshAccountEntry();},[refresh,pathname]);
  return refresh?<ScreenFallback layout="form" label="Opening your account"/>:children;
}
