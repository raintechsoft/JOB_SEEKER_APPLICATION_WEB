"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { resolvePublicProfileTab, type PublicProfileTabId } from "@/features/talent/public-profile-sections";

export type PublicProfileTab = {
  id: PublicProfileTabId;
  label: string;
  panel: ReactNode;
};

type Props = {
  tabs: PublicProfileTab[];
  profileKey: string;
  className?: string;
};

function measureTabOverflow(el: HTMLElement) {
  const { scrollLeft, scrollWidth, clientWidth } = el;
  return {
    left: scrollLeft > 1,
    right: scrollLeft + clientWidth < scrollWidth - 1,
  };
}

export function PublicProfileTabs({ tabs, profileKey, className }: Props) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const tabIds = tabs.map((tab) => tab.id).join(",");
  const [selected, setSelected] = useState<PublicProfileTabId>(() => resolvePublicProfileTab(tabs, undefined));
  const [fadeKey, setFadeKey] = useState(0);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  function syncOverflow() {
    const el = listRef.current;
    if (!el) return;
    setOverflow(measureTabOverflow(el));
  }

  useEffect(() => {
    setSelected((prev) => resolvePublicProfileTab(tabs, prev));
  }, [profileKey, tabIds, tabs]);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    active?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [selected, tabIds]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    syncOverflow();
    const onScroll = () => syncOverflow();
    el.addEventListener("scroll", onScroll, { passive: true });
    const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => syncOverflow()) : null;
    resize?.observe(el);
    window.addEventListener("resize", syncOverflow);
    return () => {
      el.removeEventListener("scroll", onScroll);
      resize?.disconnect();
      window.removeEventListener("resize", syncOverflow);
    };
  }, [tabIds, profileKey]);

  if (!tabs.length) return null;

  const active = resolvePublicProfileTab(tabs, selected);
  const activeTab = tabs.find((tab) => tab.id === active) ?? tabs[0];
  const showTablist = tabs.length > 1;

  function selectTab(id: PublicProfileTabId) {
    if (id === active) return;
    setSelected(id);
    setFadeKey((n) => n + 1);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const ids = tabs.map((tab) => tab.id);
    const index = ids.indexOf(active);
    if (index < 0) return;
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % ids.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + ids.length) % ids.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = ids.length - 1;
    else return;
    e.preventDefault();
    selectTab(ids[next]);
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[next]?.focus();
  }

  function scrollTabs(direction: -1 | 1) {
    const el = listRef.current;
    if (!el) return;
    const step = Math.max(120, Math.floor(el.clientWidth * 0.7));
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  return (
    <div className={"public-profile-tabs" + (className ? " " + className : "")}>
      {showTablist ? (
        <div
          className={
            "public-profile-tablist-shell" +
            (overflow.left ? " has-overflow-left" : "") +
            (overflow.right ? " has-overflow-right" : "")
          }
        >
          {overflow.left ? (
            <button
              type="button"
              className="public-profile-tab-scroll previous"
              aria-label="Show previous profile sections"
              onClick={() => scrollTabs(-1)}
            >
              <Icon name="chevron" />
            </button>
          ) : null}
          <div
            ref={listRef}
            className="public-profile-tablist"
            role="tablist"
            aria-label="Profile sections"
            onKeyDown={onKeyDown}
          >
            {tabs.map((tab) => {
              const selectedTab = tab.id === active;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${tab.id}`}
                  aria-selected={selectedTab}
                  aria-controls={`${baseId}-panel-${tab.id}`}
                  tabIndex={selectedTab ? 0 : -1}
                  className={"public-profile-tab" + (selectedTab ? " is-active" : "")}
                  onClick={() => selectTab(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          {overflow.right ? (
            <button
              type="button"
              className="public-profile-tab-scroll next"
              aria-label="Show more profile sections"
              onClick={() => scrollTabs(1)}
            >
              <Icon name="chevron" />
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        key={`${active}-${fadeKey}`}
        role={showTablist ? "tabpanel" : undefined}
        id={showTablist ? `${baseId}-panel-${activeTab.id}` : undefined}
        aria-labelledby={showTablist ? `${baseId}-tab-${activeTab.id}` : undefined}
        className="public-profile-tabpanel"
      >
        {activeTab.panel}
      </div>
    </div>
  );
}
