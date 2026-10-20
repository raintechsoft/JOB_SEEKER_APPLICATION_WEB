import type { Metadata } from "next";
import { RecruiterIdentityScreen } from "@/features/organization/recruiter-identity-screen";

export const metadata: Metadata = { title: "profile" };

export default function Page() {
  return <RecruiterIdentityScreen />;
}
