import type { Metadata } from "next";
import { Suspense } from "react";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { ApplicationsScreen } from "@/features/applications/applications-screen";

export const metadata: Metadata = { title: "applications" };

export default function Page() {
  return (
    <Suspense fallback={<ContentSkeleton layout="list" label="Loading your applications" />}>
      <ApplicationsScreen />
    </Suspense>
  );
}
