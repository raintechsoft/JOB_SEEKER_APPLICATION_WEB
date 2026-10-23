import type { Metadata } from "next";
import { Suspense } from "react";
import { RecruiterActivityScreen } from "@/features/activity/activity-screens";

export const metadata: Metadata = { title: "My Activity" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RecruiterActivityScreen />
    </Suspense>
  );
}
