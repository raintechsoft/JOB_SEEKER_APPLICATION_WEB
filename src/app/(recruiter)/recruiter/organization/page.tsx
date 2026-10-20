import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenFallback } from "@/components/ui/feedback";
import { OrganizationEditorScreen } from "@/features/organization/organization-editor-screen";

export const metadata: Metadata = { title: "organization" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <OrganizationEditorScreen />
    </Suspense>
  );
}
