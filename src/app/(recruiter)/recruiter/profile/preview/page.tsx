import type { Metadata } from "next";
import { Suspense } from "react";
import { RecruiterPreviewScreen } from "@/features/organization/public-screens";

export const metadata: Metadata = { title: "preview" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RecruiterPreviewScreen />
    </Suspense>
  );
}
