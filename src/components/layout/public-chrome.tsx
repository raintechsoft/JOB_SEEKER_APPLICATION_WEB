"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useDismissableDetails } from "@/hooks/use-dismissable";
import { Icon } from "@/components/ui/icon";
import { Brand, IconButton, LinkButton } from "@/components/ui/primitives";
import { workspaceDialogs } from "@/features/workspace/dialogs";

export function EmployerMenu({ variant = "public" }: { variant?: "public" | "auth" }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useDismissableDetails(ref);
  if (variant === "auth") {
    const onEmployer = pathname.startsWith("/employer/");
    return (
      <Link className="auth-role-switch" href={onEmployer ? "/login?role=professional" : "/employer/login"}>
        {onEmployer ? "Job seeker login" : "Employer Login"}
        <Icon name="arrow" />
      </Link>
    );
  }
  return (
    <details className="auth-employer-menu" ref={ref}>
      <summary>
        For Employer <Icon name="down" />
      </summary>
      <nav aria-label="Employer access">
        <Link href="/employer/login">
          Employer Login <Icon name="arrow" />
        </Link>
        <Link href="/employer/register">
          Create employer account <Icon name="arrow" />
        </Link>
      </nav>
    </details>
  );
}

export function PublicNav() {
  // The menu belongs to the page it was opened on, so navigating closes it.
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  return (
    <>
      <header className="public-nav">
        <Brand />
        <nav className="links" aria-label="Main navigation">
          <Link href="/how-it-works">How it works</Link>
          <Link href="/talent">Explore talent</Link>
          <Link href="/signup?role=professional">For job seekers</Link>
        </nav>
        <div className="nav-actions">
          <Link className="public-login" href="/login?role=professional">
            Login
          </Link>
          <LinkButton href="/signup?role=professional" variant="primary" icon="arrow">
            Create a profile
          </LinkButton>
          <EmployerMenu />
          <IconButton icon="menu" label="Open navigation" extra="mobile-nav-toggle" aria-expanded={open} onClick={() => setOpenOn(open ? null : pathname)} />
        </div>
      </header>
      <nav id="public-mobile" className="mobile-menu" aria-label="Mobile navigation" hidden={!open} style={{ display: open ? "flex" : "none" }}>
        <Link href="/how-it-works">How it works</Link>
        <Link href="/talent">Explore talent</Link>
        <Link href="/login?role=professional">Job seeker login</Link>
        <Link href="/signup?role=professional">Create a profile</Link>
        <Link href="/employer/login">Employer Login</Link>
        <Link href="/employer/register">Create employer account</Link>
      </nav>
    </>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="container row between">
        <Brand />
        <span className="small muted" style={{ fontSize: 10 }}>
          Show what you do. Get discovered for your work.
        </span>
        <nav>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/talent">Explore talent</Link>
          <button type="button" onClick={workspaceDialogs.privacy}>
            Privacy & demo data
          </button>
          <Link href="/login">Try the demo</Link>
        </nav>
      </div>
    </footer>
  );
}
