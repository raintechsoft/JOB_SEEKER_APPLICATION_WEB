import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfessionalFeedScreen } from "@/features/feed/professional-feed-screen";

export const metadata: Metadata = { title: "Your feed" };

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <ProfessionalFeedScreen />
    </Suspense>
  );
}
