"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isDevelopment } from "@/lib/env/app-env";
import { PublicFooter, PublicNav } from "./public-chrome";

/** Public site frame: `.public` wrapper, navigation and footer (the home page adds `public-platform`). */
export function PublicFrame({ children }: { children: ReactNode }) {
  const home = usePathname() === "/";
  return (
    <div className={home ? "public public-platform" : "public"}>
      <PublicNav />
      {children}
      <PublicFooter />
      {home && isDevelopment && <div className="ph-prototype-note">Skillora is an interactive prototype. Sample profiles, projects, and workspaces are for demonstration.</div>}
    </div>
  );
}
