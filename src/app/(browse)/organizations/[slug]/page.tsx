import { PublicOrganizationScreen } from "@/features/organization/public-screens";

/** Shared organization links open inside public browsing (guest header and navigation). */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicOrganizationScreen slug={slug} />;
}
