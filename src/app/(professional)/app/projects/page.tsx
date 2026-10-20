import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenFallback } from "@/components/ui/feedback";
import { ProjectsScreen } from "@/features/work/work-screens";

export const metadata: Metadata = { title: "projects" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <ProjectsScreen />
    </Suspense>
  );
}
