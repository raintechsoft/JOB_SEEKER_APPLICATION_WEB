import type { Metadata } from "next";
import { Suspense } from "react";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { ProfessionalActivityScreen } from "@/features/activity/activity-screens";

export const metadata: Metadata = { title: "My Activity" };

export default function Page() {
  return (
    <Suspense fallback={<ContentSkeleton layout="list" label="Loading your activity" />}>
      <ProfessionalActivityScreen />
    </Suspense>
  );
}
