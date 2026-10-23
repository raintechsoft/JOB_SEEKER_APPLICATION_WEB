import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfessionalActivityScreen } from "@/features/activity/activity-screens";

export const metadata: Metadata = { title: "My Activity" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProfessionalActivityScreen />
    </Suspense>
  );
}
