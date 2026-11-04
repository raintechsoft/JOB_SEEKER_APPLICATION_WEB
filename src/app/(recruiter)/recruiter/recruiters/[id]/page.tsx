import { Suspense } from "react";
import { ScreenFallback } from "@/components/ui/feedback";
import { PublicRecruiterScreen } from "@/features/organization/public-screens";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<ScreenFallback layout="profile" label="Loading recruiter profile" />}>
      <PublicRecruiterScreen id={id} inWorkspace />
    </Suspense>
  );
}
