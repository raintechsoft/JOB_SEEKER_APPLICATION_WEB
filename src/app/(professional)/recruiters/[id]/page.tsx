import { PublicRecruiterScreen } from "@/features/organization/public-screens";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicRecruiterScreen id={decodeURIComponent(id)} />;
}
