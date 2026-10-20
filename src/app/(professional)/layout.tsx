import type { ReactNode } from "react";
import { ProfessionalShell } from "@/components/layout/workspace-shell";

/** Professional workspace (/app/*) and the public organization/recruiter pages share this shell. */
export default function ProfessionalLayout({ children }: { children: ReactNode }) {
  return <ProfessionalShell>{children}</ProfessionalShell>;
}
