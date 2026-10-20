import type { ReactNode } from "react";
import { isDevelopment } from "@/lib/env/app-env";

/** Renders its children only when `NEXT_PUBLIC_APP_ENV=development`. */
export function DevOnly({ children }: { children: ReactNode }) {
  return isDevelopment ? children : null;
}
