import type { Metadata } from "next";
import { DiscoverScreen } from "@/features/talent/discover-screen";

export const metadata: Metadata = { title: "Discover talent" };

export default function Page() {
  return <DiscoverScreen />;
}
