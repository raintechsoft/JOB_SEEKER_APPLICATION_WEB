import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenFallback } from "@/components/ui/feedback";
import { OrganizationPreviewScreen } from "@/features/organization/public-screens";

export const metadata: Metadata = { title: "preview" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <OrganizationPreviewScreen />
    </Suspense>
  );
}
