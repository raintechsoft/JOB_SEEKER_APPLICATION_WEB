import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Onboarding" };

/** Temporarily hidden. Do not wire this into live signup until the product path is ready. */
export default function OnboardingPage() {
  redirect("/app/dashboard");
}
