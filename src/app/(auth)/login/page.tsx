import type { Metadata } from "next";
import { AuthScreen } from "@/features/auth/auth-screen";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ role?: string; next?: string }> }) {
  const { role, next } = await searchParams;
  if (role === "recruiter") redirect("/employer/login" + (next ? "?next=" + encodeURIComponent(next) : ""));
  return <AuthScreen roleParam={role} />;
}
