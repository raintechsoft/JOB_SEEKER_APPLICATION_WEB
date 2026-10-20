import type { Metadata } from "next";
import { OverviewScreen } from "@/features/talent/recruiter-talent-screens";

export const metadata: Metadata = { title: "overview" };

export default function Page() {
  return <OverviewScreen />;
}
