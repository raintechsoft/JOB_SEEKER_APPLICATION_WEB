import type { Metadata } from "next";
import { DiscoverScreen } from "@/features/talent/discover-screen";

export const metadata: Metadata = { title: "Discover people" };

export default function Page() {
  return <DiscoverScreen role="professional" />;
}
