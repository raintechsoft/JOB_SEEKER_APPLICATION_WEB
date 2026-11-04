"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ScreenFallback } from "@/components/ui/feedback";
import { JobsManagerScreen } from "./jobs-manager-screen";
import { ResponseCenterScreen } from "./response-center-screen";

/** `/recruiter/applications` shows the response centre when a job, stage or responses view is requested. */
export function RecruiterApplicationsScreen() {
  const q = useSearchParams();
  const router = useRouter();
  const wantsTable = q.get("rows") === "table";

  useEffect(() => {
    if (!wantsTable) return;
    const next = new URLSearchParams(q);
    next.delete("rows");
    next.delete("view");
    const s = next.toString();
    router.replace("/recruiter/applications/table" + (s ? "?" + s : ""));
  }, [wantsTable, q, router]);

  if (wantsTable) return <ScreenFallback layout="list" label="Opening responses table" />;
  return q.has("job") || q.has("stage") || q.get("view") === "responses" ? <ResponseCenterScreen mode="cards" /> : <JobsManagerScreen />;
}
