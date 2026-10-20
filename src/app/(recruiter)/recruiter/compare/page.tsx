import type { Metadata } from "next";
import { CompareScreen } from "@/features/talent/recruiter-talent-screens";

export const metadata: Metadata = { title: "compare" };

export default function Page() {
  return <CompareScreen />;
}
