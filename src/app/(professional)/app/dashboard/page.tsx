import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedSkeleton } from "@/components/ui/skeleton";
import { ProfessionalFeedScreen } from "@/features/feed/professional-feed-screen";

export const metadata: Metadata = { title: "Your feed" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <ProfessionalFeedScreen />
    </Suspense>
  );
}
