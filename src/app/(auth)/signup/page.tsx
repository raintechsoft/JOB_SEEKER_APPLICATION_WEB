import type { Metadata } from "next";
import { AuthScreen } from "@/features/auth/auth-screen";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "signup" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  if (role === "recruiter") redirect("/employer/register");
  return <AuthScreen signup roleParam={role} />;
}
