"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

export type ScrollableTab = {
  id: string;
  label: ReactNode;
};

type Props = {
  tabs: ScrollableTab[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  className?: string;
};

function measureOverflow(el: HTMLElement) {
  const { scrollLeft, scrollWidth, clientWidth } = el;
  return {
    left: scrollLeft > 1,
    right: scrollLeft + clientWidth < scrollWidth - 1,
  };
}

/** Horizontal tabs that fade and scroll with side arrows when they overflow. */
export function ScrollableTabs({ tabs, value, onChange, label = "Tabs", className }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const tabKey = tabs.map((tab) => tab.id).join(",");
  const [overflow, setOverflow] = useState({ left: false, right: false });

  function syncOverflow() {
    const el = listRef.current;
    if (!el) return;
    setOverflow(measureOverflow(el));
  }

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(".scrollable-tab.is-active");
    active?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [value, tabKey]);

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
  }, [tabKey]);

  if (!tabs.length) return null;

  function scrollTabs(direction: -1 | 1) {
    const el = listRef.current;
    if (!el) return;
    const step = Math.max(140, Math.floor(el.clientWidth * 0.7));
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  return (
    <div
      className={
        "scrollable-tabs" +
        (overflow.left ? " has-overflow-left" : "") +
        (overflow.right ? " has-overflow-right" : "") +
        (className ? " " + className : "")
      }
    >
      {overflow.left ? (
        <button type="button" className="scrollable-tabs-arrow is-prev" aria-label="Show previous tabs" onClick={() => scrollTabs(-1)}>
          <Icon name="chevron" />
        </button>
      ) : null}
      <div ref={listRef} className="scrollable-tabs-list" role="tablist" aria-label={label}>
        {tabs.map((tab) => {
          const active = tab.id === value;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              className={"scrollable-tab" + (active ? " is-active" : "")}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {overflow.right ? (
        <button type="button" className="scrollable-tabs-arrow is-next" aria-label="Show more tabs" onClick={() => scrollTabs(1)}>
          <Icon name="chevron" />
        </button>
      ) : null}
    </div>
  );
}
