import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectsScreen } from "@/features/work/work-screens";

export const metadata: Metadata = { title: "projects" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProjectsScreen />
    </Suspense>
  );
}
