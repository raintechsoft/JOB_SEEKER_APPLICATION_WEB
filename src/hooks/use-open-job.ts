"use client";

import { useEffect, useReducer } from "react";
import type { Job } from "@/types/domain";
import { isOpenJob } from "@/lib/domain/jobs";

/** Refreshes at the server-supplied cutoff; Laravel still rechecks every application. */
export function useOpenJob(job?: Job): boolean {
  const [clock, refresh] = useReducer(value => value + 1, 0);
  const cutoff = job?.closesAt ? Date.parse(job.closesAt) : job?.expiresAt ? Date.parse(job.expiresAt + "T00:00:00Z") + 86400000 : null;
  useEffect(() => {
    if (cutoff === null || !Number.isFinite(cutoff) || cutoff <= Date.now()) return;
    const timer = setTimeout(refresh, Math.min(cutoff - Date.now(), 2147483647));
    return () => clearTimeout(timer);
  },[cutoff,clock]);
  return !!job && isOpenJob(job);
}
