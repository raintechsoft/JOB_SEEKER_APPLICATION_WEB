import { Suspense } from "react";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { PublicOrganizationScreen } from "@/features/organization/public-screens";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense fallback={<ContentSkeleton layout="profile" label="Loading organization" />}>
      <PublicOrganizationScreen slug={slug} inWorkspace />
    </Suspense>
  );
}
