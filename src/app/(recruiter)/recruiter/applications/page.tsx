import type { Metadata } from "next";
import { Suspense } from "react";
import { RecruiterApplicationsScreen } from "@/features/recruiting/recruiter-applications-screen";

export const metadata: Metadata = { title: "applications" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RecruiterApplicationsScreen />
    </Suspense>
  );
}
