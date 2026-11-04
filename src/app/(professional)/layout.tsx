import type { ReactNode } from "react";
import { ProfessionalShell } from "@/components/layout/workspace-shell";

/** Professional workspace shell for /app/* routes. */
export default function ProfessionalLayout({ children }: { children: ReactNode }) {
  return <ProfessionalShell>{children}</ProfessionalShell>;
}
