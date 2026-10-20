import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@/styles/fonts.css";
import "@/styles/prototype/index.css";
import "./globals.css";
import { AppProviders } from "@/providers/app-providers";
import { BodyClassSync } from "@/components/layout/body-class-sync";
import { bodyClassScript } from "@/lib/routing/body-classes";

export const metadata: Metadata = {
  title: { default: "Skillora — Your work, your story", template: "Skillora — %s" },
  description: "Skillora brings your skills, projects, and everyday work together into a living professional identity. Explore the interactive prototype.",
};

export const viewport: Viewport = {
  themeColor: "#202A36",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      {/* Route classes are applied by the inline script before paint; React does not own them. */}
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: bodyClassScript }} />
        <a className="skip" href="#main">
          Skip to content
        </a>
        <AppProviders>
          <BodyClassSync />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
