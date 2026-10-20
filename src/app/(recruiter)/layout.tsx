import type { ReactNode } from "react";
import { RecruiterShell } from "@/components/layout/workspace-shell";

export default function RecruiterLayout({ children }: { children: ReactNode }) {
  return <RecruiterShell>{children}</RecruiterShell>;
}
