import { PublicPortfolioScreen } from "@/features/portfolio/portfolio-screens";

export default async function PublicPortfolioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicPortfolioScreen slug={slug} />;
}
