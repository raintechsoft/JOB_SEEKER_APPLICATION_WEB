import type { Metadata } from "next";
import { Suspense } from "react";
import { JobsManagerScreen } from "@/features/recruiting/jobs-manager-screen";

export const metadata: Metadata = { title: "jobs" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <JobsManagerScreen />
    </Suspense>
  );
}
