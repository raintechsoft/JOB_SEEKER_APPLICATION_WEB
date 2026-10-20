import type { Metadata } from "next";
import { EmployerRegistrationScreen } from "@/features/auth/employer-registration";

export const metadata: Metadata = { title: "register" };

export default function EmployerRegisterPage() {
  return <EmployerRegistrationScreen />;
}
