import { PublicOrganizationScreen } from "@/features/organization/public-screens";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicOrganizationScreen slug={slug} />;
}
