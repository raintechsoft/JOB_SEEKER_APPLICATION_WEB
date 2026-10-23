import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/layout/admin-shell";
import { isDevelopment } from "@/lib/env/app-env";
import { apiConfig } from "@/services/api/config";

/** Real administration is protected by the API-backed platform role gate. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  if (apiConfig.dataSource === "mock" && !isDevelopment) notFound();
  return <AdminShell>{children}</AdminShell>;
}
