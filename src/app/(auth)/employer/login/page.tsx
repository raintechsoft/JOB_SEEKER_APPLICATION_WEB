import type { Metadata } from "next";
import { AuthScreen } from "@/features/auth/auth-screen";

export const metadata: Metadata = { title: "login" };

export default function EmployerLoginPage() {
  return <AuthScreen employer />;
}
