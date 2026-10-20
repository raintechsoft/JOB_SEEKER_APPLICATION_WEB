import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenFallback } from "@/components/ui/feedback";
import { JobWizardScreen } from "@/features/job-wizard/job-wizard-screen";

export const metadata: Metadata = { title: "new" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <JobWizardScreen />
    </Suspense>
  );
}
