import type { Metadata } from "next";
import { Suspense } from "react";
import { RecruiterFeedScreen } from "@/features/recruiting/recruiter-feed-screen";

export const metadata: Metadata = { title: "dashboard" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RecruiterFeedScreen />
    </Suspense>
  );
}
