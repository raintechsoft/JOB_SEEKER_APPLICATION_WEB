import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenFallback } from "@/components/ui/feedback";
import { RecruiterActivityScreen } from "@/features/activity/activity-screens";

export const metadata: Metadata = { title: "My Activity" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <RecruiterActivityScreen />
    </Suspense>
  );
}
