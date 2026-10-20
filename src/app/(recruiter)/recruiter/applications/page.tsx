import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenFallback } from "@/components/ui/feedback";
import { RecruiterApplicationsScreen } from "@/features/recruiting/recruiter-applications-screen";

export const metadata: Metadata = { title: "applications" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <RecruiterApplicationsScreen />
    </Suspense>
  );
}
