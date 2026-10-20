import type { Metadata } from "next";
import { ShortlistsScreen } from "@/features/talent/recruiter-talent-screens";

export const metadata: Metadata = { title: "shortlists" };

export default function Page() {
  return <ShortlistsScreen />;
}
