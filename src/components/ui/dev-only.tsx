import type { ReactNode } from "react";
import { isPrototype } from "@/lib/env/app-env";

/** Renders its children only when `NEXT_PUBLIC_APP_ENV=development`. */
export function DevOnly({ children }: { children: ReactNode }) {
  return isPrototype ? children : null;
}
