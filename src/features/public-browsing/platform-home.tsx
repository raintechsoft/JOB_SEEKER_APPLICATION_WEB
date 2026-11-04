"use client";
import {useEffect} from "react";
import {apiConfig} from "@/services/api/config";
import {useBrowseSession} from "./public-account-actions";
import {PublicFeedScreen} from "./public-feed-screen";
import type {PublicRouteInput} from "./public-routing";

export function reenterPlatformHome(){window.location.replace("/");}

/** Back/route caches must not resurrect the guest home after account authentication. */
export function PlatformHomeScreen({input}:{input:PublicRouteInput}){
  const session=useBrowseSession(),knownAccount=apiConfig.dataSource==="http"&&!!session;
  useEffect(()=>{if(knownAccount)reenterPlatformHome();},[knownAccount]);
  return knownAccount?null:<PublicFeedScreen input={input}/>;
}
