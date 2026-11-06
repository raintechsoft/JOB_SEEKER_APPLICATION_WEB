"use client";

import { useRetainedList } from "@/components/suggestions/use-retained-list";
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
import { modal } from "@/stores/modal-store";
import { Icon } from "@/components/ui/icon";
import { FloatingInput, FloatingSelect } from "@/components/ui/field";
import { Button, EmptyState, LinkButton, PageHeading } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/state-views";
import { TalentCard } from "@/components/talent/talent-card";
import { SuggestionCardGrid, SuggestionCardsSkeleton } from "@/components/suggestions/suggestion-card";

function TalentResults({ publicMode, role = "recruiter" }: { publicMode: boolean; role?: "recruiter" | "professional" }) {
  const filters = useUiStore((s) => s.talent);
  const setTalent = useUiStore((s) => s.setTalent);
  const { data: fetched,isError,error,refetch } = useServiceQuery(["talent", "search", filters], (s) => s.talent.search(filters),{keepPreviousData:false});
  // Discovery excludes people already followed; a card followed just now stays until the filters change.
  const retained = useRetainedList(fetched ?? [], JSON.stringify(filters));
  const list = fetched ? retained : undefined;
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
      {list === undefined && (isError ? <QueryFeedback data={list} error={isError} cause={error} retry={refetch} layout="cards" label="Loading professionals" /> : <SuggestionCardsSkeleton label="Loading professionals" />)}
      {list && list.length ? (
        <SuggestionCardGrid>
          {list.map((p) => <TalentCard key={p.id} person={p} publicMode={publicMode} role={role} />)}
        </SuggestionCardGrid>
      ) : list ? (
          hasTalentFilters(filters) ? (
            <EmptyState
              icon="search"
              title="No professionals match these filters"
              description="Try a different skill, name, or project keyword, or clear the filters."
              action={
                <Button variant="primary" icon="close" onClick={() => setTalent(EMPTY_TALENT_FILTERS)}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon="users"
              title="No professionals to show yet"
              description={publicMode ? "Profiles appear here as professionals make them public. Be one of the first." : "Profiles appear here as professionals make them public. Check back soon."}
              action={publicMode ? <LinkButton href="/signup" variant="primary">Create your profile</LinkButton> : <LinkButton href={role === "recruiter" ? "/recruiter/dashboard" : "/app/dashboard"}>{role === "recruiter" ? "Go to dashboard" : "Back to feed"}</LinkButton>}
            />
          )
      ) : null}
    </>
  );
}

const CHIP_KEYS = ["category", "skill", "location", "years", "availability"] as const;
const hasTalentFilters = (filters: TalentFilters) => !!(filters.q || CHIP_KEYS.some((k) => filters[k]) || filters.completeness || filters.recent);
const facetFilterCount = (filters: TalentFilters) =>
  CHIP_KEYS.reduce((n, k) => n + (filters[k] ? 1 : 0), 0) + (filters.completeness ? 1 : 0) + (filters.recent ? 1 : 0);

function TalentSearchField({ id = "talent-query" }: { id?: string }) {
  const filters = useUiStore((s) => s.talent);
  const setTalent = useUiStore((s) => s.setTalent);
  return (
    <div className="search-box talent-page-search">
      <Icon name="search" />
      <FloatingInput
        label="Search"
        compact
        className="control"
        id={id}
        type="search"
        value={filters.q}
        onChange={(e) => setTalent({ q: e.target.value })}
        placeholder="Search"
        aria-label="Search"
      />
    </div>
  );
}

function TalentFilterFields({ sheet = false, includeSearch = false }: { sheet?: boolean; includeSearch?: boolean }) {
  const filters = useUiStore((s) => s.talent);
  const setTalent = useUiStore((s) => s.setTalent);
  const { data: options, isPending: optionsPending, isError: optionsError, error: optionsCause, refetch: retryOptions } = useServiceQuery(["talent", "filter-options"], (s) => s.talent.getFilterOptions());
  const select = (key: keyof TalentFilters, label: string, opts: { value: string; label: string }[]) => (
    <FloatingSelect label={label} className="control" aria-label={label} loading={(key === "location" || key === "skill") && optionsPending} disabled={(key === "location" || key === "skill") && optionsError && !options} value={String(filters[key])} onChange={(e) => setTalent({ [key]: e.target.value } as Partial<TalentFilters>)} options={opts} />
  );
  return (
    <div className={"talent-filter-fields" + (sheet ? " is-sheet" : "")}>
      {includeSearch ? <TalentSearchField id={sheet ? "talent-query-sheet" : "talent-query"} /> : null}
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
      <div className="talent-filter-actions">
        <Button variant="text sm" icon="close" onClick={() => setTalent(EMPTY_TALENT_FILTERS)}>
          Clear all
        </Button>
        {sheet ? (
          <Button variant="primary sm" onClick={() => modal.close()}>
            Done
          </Button>
        ) : null}
      </div>
      {optionsError && <ErrorState compact error={optionsCause} onRetry={() => void retryOptions()} title="Filter options couldn’t load" description="Location and skill filters are unavailable for now. Please try again." />}
    </div>
  );
}

/** Talent discovery (public `/talent`, recruiter `/recruiter/discover` and job seeker `/app/discover`). */
export function DiscoverScreen({ publicMode = false, role = "recruiter" }: { publicMode?: boolean; role?: "recruiter" | "professional" }) {
  const filters = useUiStore((s) => s.talent);
  const setTalent = useUiStore((s) => s.setTalent);
  const { data: options } = useServiceQuery(["talent", "filter-options"], (s) => s.talent.getFilterOptions());
  const sidebar = !publicMode && role === "recruiter";
  const openFilterSheet = () => modal.show("Filters", <TalentFilterFields sheet />, "following");
  // Job seekers have no filter sidebar, so never leave them on results filtered elsewhere.
  useEffect(() => {
    if (role === "professional") setTalent(EMPTY_TALENT_FILTERS);
  }, [role, setTalent]);
  const count = facetFilterCount(filters);
  return (
    <div className={sidebar ? "talent-discover-layout" : role === "professional" && !publicMode ? "talent-discover-centered" : undefined}>
      {/* The recruiter layout starts directly with the sidebar and rows. */}
      {publicMode && <PageHeading title="Explore talent" subtitle="Discover professionals through their skills, projects and recent work." />}
      {(publicMode || sidebar) && (
        <aside className={"filters" + (sidebar ? " card talent-filter-sidebar" : "")} aria-label="Filter talent">
          {sidebar && <h2 className="talent-filter-title">Filters</h2>}
          <TalentFilterFields includeSearch={publicMode} />
        </aside>
      )}
      <div className="talent-discover-main">
      {sidebar && (
        <div className="talent-filter-toolbar">
          <TalentSearchField />
          <Button className="talent-filter-toggle" variant="sm" icon="sliders" onClick={openFilterSheet} aria-haspopup="dialog">
            Filters{count ? ` (${count})` : ""}
          </Button>
        </div>
      )}
      {!publicMode && !!options?.hiringSkills?.length && (
        <div className="row wrap talent-hiring-skills" aria-label="Candidates with the skills you hire for">
          {options.hiringSkills.map((skill) => (
            <button type="button" key={skill} className={"tag" + (filters.skill === skill ? " purple" : "")} aria-pressed={filters.skill === skill} onClick={() => setTalent({ skill: filters.skill === skill ? "" : skill })}>
              Candidates with {skill}
            </button>
          ))}
        </div>
      )}
      <div id="active-filters" className="row wrap talent-active-filters">
        {CHIP_KEYS.filter((k) => filters[k]).map((k) => (
          <button type="button" key={k} className="talent-active-filter" onClick={() => setTalent({ [k]: "" } as Partial<TalentFilters>)}>
            <span>{String(filters[k])}</span>
            <Icon name="close" />
          </button>
        ))}
      </div>
      <div id="talent-results">
        {publicMode ? (
          <TalentResults publicMode />
        ) : (
          <Suspense fallback={<SuggestionCardsSkeleton label="Loading professionals" />}>
            <WorkspaceResults role={role} filtering={sidebar && hasTalentFilters(filters)} />
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
