import type { Metadata } from "next";

import { PortfolioPreviewScreen } from "@/features/portfolio/portfolio-screens";

export const metadata: Metadata = { title: "preview" };

export default function Page() {
  return <PortfolioPreviewScreen />;
}
