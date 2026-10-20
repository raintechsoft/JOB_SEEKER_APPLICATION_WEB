import type { Metadata } from "next";

import { PortfolioBuilderScreen } from "@/features/portfolio/portfolio-screens";

export const metadata: Metadata = { title: "Portfolio builder" };

export default function Page() {
  return <PortfolioBuilderScreen />;
}
