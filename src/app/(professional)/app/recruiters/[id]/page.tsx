import { Suspense } from "react";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { PublicRecruiterScreen } from "@/features/organization/public-screens";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<ContentSkeleton layout="profile" label="Loading recruiter profile" />}>
      <PublicRecruiterScreen id={id} inWorkspace />
    </Suspense>
  );
}
