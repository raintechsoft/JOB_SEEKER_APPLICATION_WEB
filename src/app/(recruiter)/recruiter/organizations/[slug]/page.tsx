import { Suspense } from "react";
import { ScreenFallback } from "@/components/ui/feedback";
import { PublicOrganizationScreen } from "@/features/organization/public-screens";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense fallback={<ScreenFallback layout="profile" label="Loading organization" />}>
      <PublicOrganizationScreen slug={slug} inWorkspace />
    </Suspense>
  );
}
