"use client";

import { useEffect, useRef, useState } from "react";
import type { Role } from "@/types/domain";
import { scopesFor, searchLabels, type SearchScope } from "@/lib/search/scopes";
import { Icon } from "@/components/ui/icon";

export function SearchScopeBadges({ role, value, onChange }: { role: Role; value: SearchScope; onChange: (scope: SearchScope) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false), [atEnd, setAtEnd] = useState(false);
  useEffect(() => {
    const row = ref.current;
    if (!row) return;
    const measure = () => { setOverflow(row.scrollWidth > row.clientWidth + 1); setAtEnd(row.scrollLeft + row.clientWidth >= row.scrollWidth - 2); };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(row); row.addEventListener("scroll", measure); window.addEventListener("resize", measure); measure();
    return () => { observer?.disconnect(); row.removeEventListener("scroll", measure); window.removeEventListener("resize", measure); };
  }, [role]);
  return <div className="search-scopes-wrap">
    <div className="search-scopes" ref={ref} role="group" aria-label="Search categories">
      {scopesFor(role).map(scope => <button key={scope} type="button" aria-pressed={scope === value} className="search-scope-badge" onClick={() => onChange(scope)}>{searchLabels[scope]}</button>)}
    </div>
    {overflow && <button type="button" className={`search-scopes-arrow${atEnd ? " is-back" : ""}`} aria-label={atEnd ? "Back to first search categories" : "More search categories"} onClick={() => {
      const row = ref.current;
      row?.scrollTo({ left: atEnd ? 0 : row.scrollLeft + Math.max(160, row.clientWidth * .7), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }}><Icon name="chevron" /></button>}
  </div>;
}
