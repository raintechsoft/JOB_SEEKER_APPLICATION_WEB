"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useNavigationDock } from "@/hooks/use-navigation-dock";
import { useDismissableDetails } from "@/hooks/use-dismissable";
import { Icon, type IconName } from "@/components/ui/icon";
import { Avatar, Brand, IconButton, type AvatarPerson } from "@/components/ui/primitives";

export interface HeaderNavItem {
  href: string;
  label: string;
  icon: IconName;
  active: boolean;
  unread?: number;
}

function NavLinks({ items, onNavigate }: { items: HeaderNavItem[]; onNavigate?: () => void }) {
  return items.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      className={item.active ? "active" : ""}
      aria-current={item.active ? "page" : undefined}
      onClick={onNavigate}
    >
      <span className="nav-dock-icon" aria-hidden="true">
        <Icon name={item.icon} />
      </span>
      <span>{item.label}</span>
      {!!item.unread && (
        <i className="nav-unread" aria-label={`${item.unread} unread conversation${item.unread === 1 ? "" : "s"}`}>
          {item.unread > 99 ? "99+" : item.unread}
        </i>
      )}
    </Link>
  ));
}

export function HeaderNav({ items, label }: { items: HeaderNavItem[]; label: string }) {
  const ref = useRef<HTMLElement>(null);
  useNavigationDock(ref);
  return (
    <nav className="professional-nav" aria-label={label} ref={ref}>
      <NavLinks items={items} />
    </nav>
  );
}

/** Free width between the search badge and the nav, so the expanding search never covers links. */
function useSearchRoom() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const inner = ref.current;
    if (!inner || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const form = inner.querySelector<HTMLElement>("#feed-search-form");
      const nav = inner.querySelector<HTMLElement>(".professional-nav");
      const link = nav?.querySelector<HTMLElement>(":scope > a");
      const tools = inner.querySelector<HTMLElement>(".professional-header-tools");
      if (!form) return;
      const navVisible = !!nav && getComputedStyle(nav).display !== "none";
      const edge = navVisible && link ? link.getBoundingClientRect().left : (tools?.getBoundingClientRect().left ?? inner.getBoundingClientRect().right);
      const room = Math.floor(edge - form.getBoundingClientRect().left - 16);
      inner.style.setProperty("--header-search-room", Math.max(46, room) + "px");
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    // The search may mount after the frame (Suspense), so measure again whenever it is used.
    inner.addEventListener("focusin", measure);
    return () => { observer.disconnect(); inner.removeEventListener("focusin", measure); };
  }, []);
  return ref;
}

const DESKTOP_NAV = "(min-width: 851px)";

function useHeaderSidebar(pathname: string) {
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const close = () => setOpenOn(null);
  const toggle = () => setOpenOn(open ? null : pathname);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector("#header-sidebar details[open]")) return;
      close();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  useEffect(() => {
    const media = window.matchMedia(DESKTOP_NAV);
    const onChange = () => {
      if (media.matches) close();
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return { open, close, toggle };
}

/**
 * The one header and page frame for guest browsing and both workspaces. Each phase supplies
 * only its content: brand target, search, navigation items and the right-hand tools.
 */
/** Bottom identity row whose account links open upward over the nav. */
export function SidebarAccount({ person, email, children }: { person?: AvatarPerson; email?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useDismissableDetails(ref, { closeOnAction: true });
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  return (
    <details className="header-sidebar-account" ref={ref}>
      <summary aria-label="Open account menu">
        {person?.name ? <Avatar person={person} /> : <span className="avatar" />}
        <span className="header-sidebar-identity">
          {person?.name ? <strong>{person.name}</strong> : null}
          {email ? <span className="professional-account-email">{email}</span> : null}
        </span>
        <Icon name="up" />
      </summary>
      <div className="header-sidebar-account-menu">{children}</div>
    </details>
  );
}

export function HeaderFrame({ className, brandHref, search, nav, navLabel, searchHref, tools, sidebarGuest, sidebarAccount, mainClass, mainLabel, children }: {
  className?: string;
  brandHref: string;
  search: ReactNode;
  nav: HeaderNavItem[];
  navLabel: string;
  /** Full search page, reached from the compact mobile search icon. */
  searchHref: string;
  tools: ReactNode;
  /** Guest Login / Create account, rendered above the sidebar links. */
  sidebarGuest?: ReactNode;
  /** Signed-in profile row pinned to the bottom; its menu opens above it. */
  sidebarAccount?: ReactNode;
  mainClass?: string;
  mainLabel?: string;
  children: ReactNode;
}) {
  const inner = useSearchRoom();
  const pathname = usePathname();
  const { open, close, toggle } = useHeaderSidebar(pathname);
  const closeRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      closeRef.current?.focus();
      return;
    }
    document.getElementById("header-sidebar")?.querySelectorAll("details").forEach((item) => {
      item.open = false;
    });
    if (wasOpen.current) {
      wasOpen.current = false;
      toggleRef.current?.focus();
    }
  }, [open]);
  return (
    <div className={["professional-app", className, open && "is-nav-open"].filter(Boolean).join(" ")}>
      <header className="professional-header" inert={open ? true : undefined}>
        <div className="professional-header-inner" ref={inner}>
          <Brand href={brandHref} />
          {search}
          <HeaderNav items={nav} label={navLabel} />
          <div className="professional-header-tools">
            <Link href={searchHref} className="mobile-workspace-search iconbtn" aria-label="Search Skillora"><Icon name="search" /></Link>
            <IconButton
              icon="search"
              label="Search Skillora"
              extra="header-search-toggle"
              onClick={() => inner.current?.querySelector<HTMLInputElement>("#feed-search-form input")?.focus()}
            />
            {tools}
            <IconButton
              ref={toggleRef}
              icon="menu"
              label="Open navigation"
              extra="header-menu-toggle"
              aria-expanded={open}
              aria-controls="header-sidebar"
              onClick={toggle}
            />
          </div>
        </div>
      </header>
      <button type="button" className={"header-sidebar-backdrop" + (open ? " is-open" : "")} tabIndex={-1} aria-hidden="true" onClick={close} />
      <aside id="header-sidebar" className={"header-sidebar" + (open ? " is-open" : "")} aria-hidden={!open} inert={!open ? true : undefined} aria-label={`${navLabel} menu`}>
        <div className="header-sidebar-head">
          <Brand href={brandHref} />
          <IconButton ref={closeRef} icon="close" label="Close navigation" extra="header-sidebar-close" onClick={close} />
        </div>
        <div className="header-sidebar-body">
          {sidebarGuest ? <div className="header-sidebar-guest">{sidebarGuest}</div> : null}
          <nav className="header-sidebar-nav" aria-label={navLabel}>
            <NavLinks items={nav} onNavigate={close} />
          </nav>
        </div>
        {sidebarAccount ? (
          <div
            className="header-sidebar-foot"
            onClick={(event) => {
              if ((event.target as Element).closest(".header-sidebar-account-menu a, .header-sidebar-account-menu button")) close();
            }}
          >
            {sidebarAccount}
          </div>
        ) : null}
      </aside>
      <main id="main" className={["professional-main", mainClass].filter(Boolean).join(" ")} aria-label={mainLabel} inert={open ? true : undefined}>
        {children}
      </main>
    </div>
  );
}
