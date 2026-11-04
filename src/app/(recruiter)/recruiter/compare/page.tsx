import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CompareScreen } from "@/features/talent/recruiter-talent-screens";
import { COMPARE_CANDIDATES_ENABLED } from "@/lib/feature-flags";

export const metadata: Metadata = { title: "compare" };

export default function Page() {
  if (!COMPARE_CANDIDATES_ENABLED) redirect("/recruiter/shortlists");
  return <CompareScreen />;
}
