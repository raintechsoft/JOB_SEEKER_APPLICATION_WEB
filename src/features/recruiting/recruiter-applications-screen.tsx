"use client";

import { useSearchParams } from "next/navigation";
import { JobsManagerScreen } from "./jobs-manager-screen";
import { ResponseCenterScreen } from "./response-center-screen";

/** `/recruiter/applications` shows the response centre when a job, stage or responses view is requested. */
export function RecruiterApplicationsScreen() {
  const q = useSearchParams();
  return q.has("job") || q.has("stage") || q.get("view") === "responses" ? <ResponseCenterScreen /> : <JobsManagerScreen />;
}
