import { PublicRecruiterScreen } from "@/features/organization/public-screens";

/** Shared recruiter links open inside public browsing (guest header and navigation). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicRecruiterScreen id={id} />;
}
