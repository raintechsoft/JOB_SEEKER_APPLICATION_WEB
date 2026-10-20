import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenFallback } from "@/components/ui/feedback";
import { JobsManagerScreen } from "@/features/recruiting/jobs-manager-screen";

export const metadata: Metadata = { title: "jobs" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <JobsManagerScreen />
    </Suspense>
  );
}
