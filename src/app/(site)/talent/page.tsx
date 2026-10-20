import type { Metadata } from "next";
import { DiscoverScreen } from "@/features/talent/discover-screen";

export const metadata: Metadata = { title: "talent" };

export default function TalentPage() {
  return (
    <main id="main" className="container" style={{ paddingTop: 45, paddingBottom: 70 }}>
      <DiscoverScreen publicMode />
    </main>
  );
}
