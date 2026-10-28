"use client";

import { QueryFeedback } from "@/components/ui/query-view";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { discoverySectionSchema, peopleSectionSchema } from "@/lib/validation/talent-discovery";
import { TalentDiscoveryRows, TalentDiscoverySection } from "./talent-discovery";
import type { TalentFilters } from "@/services/talent/talent.service";
import { EMPTY_TALENT_FILTERS } from "@/services/talent/talent.service";
import { track } from "@/lib/analytics";
import { DevOnly } from "@/components/ui/dev-only";
import { useServiceQuery } from "@/hooks/use-services";
import { useUiStore } from "@/stores/ui-store";
import { Icon } from "@/components/ui/icon";
import { FloatingInput, FloatingSelect } from "@/components/ui/field";
import { Button, EmptyState, PageHeading } from "@/components/ui/primitives";
import { TalentCard } from "@/components/talent/talent-card";
import { SuggestionCardGrid, SuggestionCardsSkeleton } from "@/components/suggestions/suggestion-card";

function TalentResults({ publicMode, role = "recruiter" }: { publicMode: boolean; role?: "recruiter" | "professional" }) {
  const filters = useUiStore((s) => s.talent);
  const setTalent = useUiStore((s) => s.setTalent);
  const { data: list,isError,refetch } = useServiceQuery(["talent", "search", filters], (s) => s.talent.search(filters),{keepPreviousData:false});
  const tracked = useRef("");
  useEffect(() => {
    const key = JSON.stringify(filters);
    if (!list || tracked.current === key) return;
    tracked.current = key;
    if (filters.q) track("search_performed", { surface: "talent", hasQuery: true, resultCount: list.length });
  }, [filters, list]);
  return (
    <>
      {/* The recruiter layout drops the count and sort row; the public directory keeps it. */}
      {publicMode && <div className="row between wrap" style={{ marginBottom: 20 }}>
        <p className="small muted">
          <strong style={{ color: "var(--ink)" }}>{list?.length ?? "—"}</strong> professionals to explore{" "}
          <DevOnly>
            <span style={{ marginLeft: 7 }}>· Fictional demo directory</span>
          </DevOnly>
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
      </div>}
      {list === undefined && (isError ? <QueryFeedback data={list} error={isError} retry={refetch} layout="cards" label="Loading professionals" /> : <SuggestionCardsSkeleton label="Loading professionals" />)}
      {list && list.length ? (
        <SuggestionCardGrid>
          {list.map((p) => <TalentCard key={p.id} person={p} publicMode={publicMode} role={role} />)}
        </SuggestionCardGrid>
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
    </>
  );
}

const CHIP_KEYS = ["category", "skill", "location", "years", "availability"] as const;

/** Talent discovery (public `/talent`, recruiter `/recruiter/discover` and job seeker `/app/discover`). */
export function DiscoverScreen({ publicMode = false, role = "recruiter" }: { publicMode?: boolean; role?: "recruiter" | "professional" }) {
  const filters = useUiStore((s) => s.talent);
  const setTalent = useUiStore((s) => s.setTalent);
  const { data: options, isPending: optionsPending, isError: optionsError, refetch: retryOptions } = useServiceQuery(["talent", "filter-options"], (s) => s.talent.getFilterOptions());
  const select = (key: keyof TalentFilters, label: string, opts: { value: string; label: string }[]) => (
    <FloatingSelect label={label} className="control" aria-label={label} loading={(key === "location" || key === "skill") && optionsPending} disabled={(key === "location" || key === "skill") && optionsError && !options} value={String(filters[key])} onChange={(e) => setTalent({ [key]: e.target.value } as Partial<TalentFilters>)} options={opts} />
  );
  const sidebar = !publicMode && role === "recruiter";
  // Job seekers have no filter sidebar, so never leave them on results filtered elsewhere.
  useEffect(() => {
    if (role === "professional") setTalent(EMPTY_TALENT_FILTERS);
  }, [role, setTalent]);
  return (
    <div className={sidebar ? "talent-discover-layout" : role === "professional" && !publicMode ? "talent-discover-centered" : undefined}>
      {/* The recruiter layout starts directly with the sidebar and rows; the empty heading only added space. */}
      {publicMode && <PageHeading title="" subtitle="" />}
      {(publicMode || sidebar) && <aside className={"filters" + (sidebar ? " card talent-filter-sidebar" : "")} aria-label="Filter talent">
        {sidebar && <h2 className="talent-filter-title">Filters</h2>}
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
        {optionsError && <p role="alert" className="small muted">Location and skill options could not be loaded. <Button variant="text sm" onClick={() => retryOptions()}>Try again</Button></p>}
      </aside>}
      <div className="talent-discover-main">
      {!publicMode && !!options?.hiringSkills?.length && (
        <div className="row wrap talent-hiring-skills" aria-label="Candidates with the skills you hire for">
          {options.hiringSkills.map((skill) => (
            <button type="button" key={skill} className={"tag" + (filters.skill === skill ? " purple" : "")} aria-pressed={filters.skill === skill} onClick={() => setTalent({ skill: filters.skill === skill ? "" : skill })}>
              Candidates with {skill}
            </button>
          ))}
        </div>
      )}
      <div id="active-filters" className="row wrap" style={{ marginBottom: 15 }}>
        {CHIP_KEYS.filter((k) => filters[k]).map((k) => (
          <button type="button" key={k} className="tag purple" onClick={() => setTalent({ [k]: "" } as Partial<TalentFilters>)}>
            {String(filters[k])} <Icon name="close" />
          </button>
        ))}
      </div>
      <div id="talent-results">
        {publicMode ? (
          <TalentResults publicMode />
        ) : (
          <Suspense fallback={null}>
            <WorkspaceResults role={role} filtering={sidebar && !!(filters.q || CHIP_KEYS.some((k) => filters[k]) || filters.completeness || filters.recent)} />
          </Suspense>
        )}
      </div>
      </div>
    </div>
  );
}

/** Workspace users see discovery rows until they search or filter; `?section=` opens one row in full. */
function WorkspaceResults({ filtering, role }: { filtering: boolean; role: "recruiter" | "professional" }) {
  const params = useSearchParams();
  const section = (role === "recruiter" ? discoverySectionSchema : peopleSectionSchema).safeParse(params.get("section")).data;
  if (filtering) return <TalentResults publicMode={false} role={role} />;
  if (section) return <TalentDiscoverySection role={role} section={section} job={params.get("job") ?? undefined} />;
  return (
    <>
      <TalentDiscoveryRows role={role} />
      <section className="talent-discovery-row" aria-labelledby="row-all">
        <header>
          <div>
            <h2 id="row-all">All professionals</h2>
            <p>Browse the full directory, or search and filter above.</p>
          </div>
        </header>
        <TalentResults publicMode={false} role={role} />
      </section>
    </>
  );
}
