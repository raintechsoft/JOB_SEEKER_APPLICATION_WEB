import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenFallback } from "@/components/ui/feedback";
import { ProfessionalFeedScreen } from "@/features/feed/professional-feed-screen";

export const metadata: Metadata = { title: "Your feed" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <ProfessionalFeedScreen />
    </Suspense>
  );
}
