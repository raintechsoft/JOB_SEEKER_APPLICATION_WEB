import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/layout/admin-shell";
import { isDevelopment } from "@/lib/env/app-env";

/** The admin area is a development-only demo; production builds answer 404. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  if (!isDevelopment) notFound();
  return <AdminShell>{children}</AdminShell>;
}
