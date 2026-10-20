"use client";

import { useEffect, useRef } from "react";
import type { TalentFilters } from "@/services/talent/talent.service";
import { EMPTY_TALENT_FILTERS } from "@/services/talent/talent.service";
import { track } from "@/lib/analytics";
import { useServiceQuery } from "@/hooks/use-services";
import { useUiStore } from "@/stores/ui-store";
import { Icon } from "@/components/ui/icon";
import { FloatingInput, FloatingSelect } from "@/components/ui/field";
import { Button, EmptyState, PageHeading } from "@/components/ui/primitives";
import { TalentCard } from "@/components/talent/talent-card";

function TalentResults({ publicMode }: { publicMode: boolean }) {
  const filters = useUiStore((s) => s.talent);
  const setTalent = useUiStore((s) => s.setTalent);
  const { data: list } = useServiceQuery(["talent", "search", filters], (s) => s.talent.search(filters));
  const tracked = useRef("");
  useEffect(() => {
    const key = JSON.stringify(filters);
    if (!list || tracked.current === key) return;
    tracked.current = key;
    if (filters.q) track("search_performed", { surface: "talent", hasQuery: true, resultCount: list.length });
  }, [filters, list]);
  return (
    <>
      <div className="row between wrap" style={{ marginBottom: 20 }}>
        <p className="small muted">
          <strong style={{ color: "var(--ink)" }}>{list?.length ?? 0}</strong> professionals to explore <span style={{ marginLeft: 7 }}>· Fictional demo directory</span>
        </p>
        <div className="row gap8">
          <label className="small muted" htmlFor="talent-sort">
            Sort by
          </label>
          <FloatingSelect
            label="Sort by"
            className="control"
            id="talent-sort"
            style={{ width: 145, fontSize: 11, padding: 8 }}
            value={filters.sort}
            onChange={(e) => setTalent({ sort: e.target.value as TalentFilters["sort"] })}
            options={[
              { value: "relevance", label: "Relevance" },
              { value: "recent", label: "Recently active" },
              { value: "experience", label: "Experience" },
            ]}
          />
        </div>
      </div>
      <div className="grid cols3 talent-grid">
        {list && list.length ? (
          list.map((p) => <TalentCard key={p.id} person={p} publicMode={publicMode} />)
        ) : list ? (
          <EmptyState
            title="A little room to broaden your search."
            description="Try a different skill, name, or project keyword."
            action={
              <Button variant="primary" icon="close" onClick={() => setTalent(EMPTY_TALENT_FILTERS)}>
                Clear filters
              </Button>
            }
          />
        ) : null}
      </div>
    </>
  );
}

const CHIP_KEYS = ["category", "skill", "location", "years", "availability"] as const;

/** Talent discovery (public `/talent` and recruiter `/recruiter/discover`). */
export function DiscoverScreen({ publicMode = false }: { publicMode?: boolean }) {
  const filters = useUiStore((s) => s.talent);
  const setTalent = useUiStore((s) => s.setTalent);
  const { data: options } = useServiceQuery(["talent", "filter-options"], (s) => s.talent.getFilterOptions());
  const select = (key: keyof TalentFilters, label: string, opts: { value: string; label: string }[]) => (
    <FloatingSelect label={label} className="control" aria-label={label} value={String(filters[key])} onChange={(e) => setTalent({ [key]: e.target.value } as Partial<TalentFilters>)} options={opts} />
  );
  return (
    <>
      <PageHeading title="Find the people. See the proof." subtitle="Thoughtful people, meaningful projects, and a little more context." />
      <div className="filters">
        <div className="search-box">
          <Icon name="search" />
          <FloatingInput
            label="Search talent by name, title, skills, or projects"
            compact
            className="control"
            id="talent-query"
            type="search"
            value={filters.q}
            onChange={(e) => setTalent({ q: e.target.value })}
            placeholder="Search skills, people, or projects..."
            aria-label="Search talent by name, title, skills, or projects"
          />
        </div>
        {select("category", "Professional category", [{ value: "", label: "All disciplines" }, ...["Design", "Engineering", "Data", "Business"].map((v) => ({ value: v, label: v }))])}
        {select("years", "Years of experience", [
          { value: "", label: "Any experience" },
          { value: "0-4", label: "0–4 years" },
          { value: "5-7", label: "5–7 years" },
          { value: "8+", label: "8+ years" },
        ])}
        {select("location", "Location", [{ value: "", label: "Any location" }, ...(options?.locations ?? []).map((v) => ({ value: v, label: v }))])}
        {select("skill", "Required skill", [{ value: "", label: "Any skill" }, ...(options?.skills ?? []).map((v) => ({ value: v, label: v }))])}
        {select("availability", "Availability or arrangement", [
          { value: "", label: "Any availability" },
          { value: "available", label: "Open to opportunities" },
          { value: "Remote", label: "Remote" },
          { value: "Hybrid", label: "Hybrid" },
        ])}
        <label className="check-row small">
          <input type="checkbox" checked={filters.completeness} onChange={(e) => setTalent({ completeness: e.target.checked })} />
          90%+ complete
        </label>
        <label className="check-row small">
          <input type="checkbox" checked={filters.recent} onChange={(e) => setTalent({ recent: e.target.checked })} />
          Active in last 3 days
        </label>
        <Button variant="text sm" icon="close" onClick={() => setTalent(EMPTY_TALENT_FILTERS)}>
          Clear all
        </Button>
      </div>
      <div id="active-filters" className="row wrap" style={{ marginBottom: 15 }}>
        {CHIP_KEYS.filter((k) => filters[k]).map((k) => (
          <button type="button" key={k} className="tag purple" onClick={() => setTalent({ [k]: "" } as Partial<TalentFilters>)}>
            {String(filters[k])} <Icon name="close" />
          </button>
        ))}
      </div>
      <div id="talent-results">
        <TalentResults publicMode={publicMode} />
      </div>
    </>
  );
}
