import type { Metadata } from "next";
import { OnboardingScreen } from "@/features/site/onboarding-screen";

export const metadata: Metadata = { title: "onboarding" };

export default function OnboardingPage() {
  return <OnboardingScreen />;
}
