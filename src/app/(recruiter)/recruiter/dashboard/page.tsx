import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenFallback } from "@/components/ui/feedback";
import { RecruiterFeedScreen } from "@/features/recruiting/recruiter-feed-screen";

export const metadata: Metadata = { title: "dashboard" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <RecruiterFeedScreen />
    </Suspense>
  );
}
