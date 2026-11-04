import { redirect } from "next/navigation";

// The marketing site is retired; old links land on the community feed instead.
export default function HowItWorksPage() {
  redirect("/");
}
