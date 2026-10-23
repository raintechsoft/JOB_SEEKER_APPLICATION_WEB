import type { Metadata } from "next";
import { Suspense } from "react";
import { ApplicationsScreen } from "@/features/applications/applications-screen";

export const metadata: Metadata = { title: "applications" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ApplicationsScreen />
    </Suspense>
  );
}
