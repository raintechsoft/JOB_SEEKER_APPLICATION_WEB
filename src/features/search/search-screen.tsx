"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { Role } from "@/types/domain";
import { useServices, useServiceQuery } from "@/hooks/use-services";
import { apiConfig } from "@/services/api/config";
import { useHydrated } from "@/hooks/use-hydrated";
import { useUiStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { scopedSearchSchema, searchPageUrl, searchLabels, searchOptionsFromUrl, filterKeysFor, filterLabels, searchSettings, type SearchOptions, type SearchScope } from "@/lib/search/scopes";
import { searchResultHref, searchResultLabel, resultKindLabels } from "@/services/search/search.service";
import { SearchResultMark } from "./result-mark";
import { SearchScopeBadges } from "./scope-badges";
import { SearchHighlight } from "./highlight";
import { SearchFailure } from "./search-failure";

export function SearchScreen({ role }: { role: Role }) {
  const params = useSearchParams();
  const query = params.get("q") ?? "", category = params.get("scope") ?? "all";
  const encodedOptions = JSON.stringify(searchOptionsFromUrl(params));
  const parsed = useMemo(() => scopedSearchSchema.safeParse({ role, q: query, scope: category, ...JSON.parse(encodedOptions) }), [role, query, category, encodedOptions]);
  const setFeed = useUiStore(s => s.setFeed);
  useEffect(() => { if (parsed.success) setFeed({ query: parsed.data.q, searchScope: parsed.data.scope, searchOptions: JSON.parse(encodedOptions) }); }, [parsed, encodedOptions, setFeed]);
  return <section className="workspace-search-page" aria-label="Search results">
    <h1>Search results</h1>
    {!parsed.success ? <>{params.has("q") ? <p role="alert">{parsed.error.issues[0].message} Adjust the query, category or filters.</p> : <p className="muted">Find companies, people, jobs and work shared on Skillora.</p>}<SearchQueryForm role={role} query={query} scope="all" options={{}} /></> : <SearchResults key={`${category}:${query}:${encodedOptions}`} role={role} query={parsed.data.q} scope={parsed.data.scope} options={JSON.parse(encodedOptions)} />}
  </section>;
}

function SearchResults({ role, query, scope, options }: { role: Role; query: string; scope: SearchScope; options: SearchOptions }) {
  const services = useServices(), hydrated = useHydrated(), router = useRouter();
  const [draft, setDraft] = useState(query), [queryError, setQueryError] = useState("");
  const changeCategory = (next: SearchScope) => {
    const nextOptions = Object.fromEntries(Object.entries(options).filter(([key]) => key === "sort" || filterKeysFor(next).includes(key as never)));
    const parsed = scopedSearchSchema.safeParse({ role, q: draft, scope: next, ...nextOptions });
    if (!parsed.success) { setQueryError(parsed.error.issues[0].message); document.getElementById("workspace-search-query")?.focus(); return; }
    router.push(searchPageUrl(role, parsed.data.q, next, nextOptions));
  };
  const result = useInfiniteQuery({ queryKey: ["workspace-search", "results", role, scope, query, options], initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => services.search.query({ role, q: query, scope, cursor: pageParam, limit: 20, ...options }, { signal }), getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: hydrated, placeholderData: () => undefined, retry: false, refetchOnWindowFocus: false });
  const items = result.data?.pages.flatMap(page => page.items) ?? [];
  return <>
    <SearchQueryForm role={role} query={query} scope={scope} options={options} externalError={queryError} onDraftChange={value => { setDraft(value); setQueryError(""); }} />
    <SearchScopeBadges role={role} value={scope} onChange={changeCategory} />
    <SearchFiltersForm role={role} query={draft} submittedQuery={query} scope={scope} options={options} onQueryError={setQueryError} />
    <p className="workspace-search-summary" role="status">{searchLabels[scope]} results for “{query}”{result.data?.pages[0].total != null ? ` · ${result.data.pages[0].total} ${result.data.pages[0].total === 1 ? "match" : "matches"}` : ""}</p>
    {result.isFetching && !result.data && <div className="stack" aria-busy="true"><Skeleton style={{ height: 70 }} /><Skeleton style={{ height: 70 }} /></div>}
    {result.isError && !result.isFetchNextPageError && <SearchFailure error={result.error} retry={() => void result.refetch()} />}
    {result.isSuccess && !items.length && <p className="card">No matching results in {searchLabels[scope].toLowerCase()}. Try another term, category or filter.{scope === "companies" && " Companies must have a public profile to appear outside their own workspace."}</p>}
    <ul className="workspace-search-results">{items.map(item => <li key={`${item.kind}:${item.id}`}><Link href={searchResultHref(role, item)} aria-label={searchResultLabel(item)}><SearchResultMark result={item} /><span><strong><SearchHighlight text={item.title} query={query} /></strong><span><SearchHighlight text={item.subtitle} query={query} /></span><small>{resultKindLabels[item.kind]}{item.companyAccess === "workspace" && " · Visible only to your company"}</small></span></Link></li>)}</ul>
    {result.isFetchNextPageError && <SearchFailure error={result.error} retry={() => void result.fetchNextPage()} />}
    {result.hasNextPage && <Button disabled={result.isFetchingNextPage} onClick={() => void result.fetchNextPage()}>Show more results</Button>}
  </>;
}

function SearchQueryForm({ role, query, scope, options, externalError, onDraftChange }: { role: Role; query: string; scope: SearchScope; options: SearchOptions; externalError?: string; onDraftChange?: (value: string) => void }) {
  const [error, setError] = useState(""); const router = useRouter();
  return <><form className="workspace-search-form" noValidate data-no-floating-label onSubmit={event => {
      event.preventDefault();
      const parsed = scopedSearchSchema.safeParse({ role, q: String(new FormData(event.currentTarget).get("q") ?? ""), scope, ...options });
      if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
      setError(""); if (parsed.data.q !== query) router.push(searchPageUrl(role, parsed.data.q, scope, options));
    }}>
      <label className="sr-only" htmlFor="workspace-search-query">Edit search query</label>
      <input id="workspace-search-query" type="search" name="q" defaultValue={query} maxLength={200} onChange={event => { setError(""); onDraftChange?.(event.target.value); }} aria-invalid={!!(error || externalError)} aria-describedby={error || externalError ? "workspace-search-query-error" : undefined} />
      <Button type="submit" variant="primary" icon="search">Search</Button>
    </form>
    {(error || externalError) && <p id="workspace-search-query-error" role="alert">{error || externalError}</p>}
  </>;
}

function SearchFiltersForm({ role, query, submittedQuery, scope, options, onQueryError }: { role: Role; query: string; submittedQuery: string; scope: SearchScope; options: SearchOptions; onQueryError: (error: string) => void }) {
  const router = useRouter(); const [errors, setErrors] = useState<Record<string,string>>({});
  const session = useServiceQuery(["auth", "session"], services => services.auth.me(), { enabled: apiConfig.dataSource === "http" });
  const identity = session.data?.selected_identity_id;
  const fields = filterKeysFor(scope);
  const removeFilter = (key: string) => {
    const next = Object.fromEntries(Object.entries(options).filter(([name]) => name !== key));
    const parsed = scopedSearchSchema.safeParse({ role, q: query, scope, ...next });
    if (!parsed.success) { onQueryError(parsed.error.issues[0].message); document.getElementById("workspace-search-query")?.focus(); return; }
    onQueryError(""); router.push(searchPageUrl(role,parsed.data.q,scope,next));
  };
  return <div className="workspace-search-filters" data-no-floating-label>
    <form noValidate aria-label="Search filters" onSubmit={event => {
      event.preventDefault(); const data = new FormData(event.currentTarget); const next: Record<string,unknown> = {};
      for (const [key,value] of data) if (String(value).trim()) next[key] = ["days","experienceMin","experienceMax"].includes(key) ? Number(value) : String(value);
      const parsed = scopedSearchSchema.safeParse({ role, q: query, scope, ...next });
      if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]),issue.message]))); const queryIssue = parsed.error.issues.find(issue => issue.path[0] === "q"); if (queryIssue) { onQueryError(queryIssue.message); document.getElementById("workspace-search-query")?.focus(); } return; }
      setErrors({}); onQueryError(""); const url = searchPageUrl(role,parsed.data.q,scope,next as SearchOptions); if (url !== searchPageUrl(role,submittedQuery,scope,options)) router.push(url);
    }}>
      <label>Sort<select name="sort" defaultValue={options.sort ?? "relevance"}><option value="relevance">Relevance</option><option value="recent">Most recent</option></select></label>
      {fields.map(key => { const choices = key === "arrangement" ? searchSettings.arrangements : key === "employment" ? searchSettings.employment : key === "discipline" ? searchSettings.disciplines : null; return <label key={key}>{filterLabels[key]}{key === "author" ? <select name="author" defaultValue={options.author ?? ""}><option value="">Anyone</option>{identity && (scope === "posts" || role === "professional") && <option value={identity}>Me</option>}{options.author && options.author !== identity && <option value={options.author}>Selected author</option>}</select> : choices ? <select name={key} defaultValue={options[key] ?? ""}><option value="">Any</option>{choices.map(value => <option key={value}>{value}</option>)}</select> : <input name={key} aria-label={filterLabels[key]} type={["days","experienceMin","experienceMax"].includes(key) ? "number" : "text"} min={key === "days" ? 1 : 0} max={key === "days" ? 365 : 60} step={key === "days" ? 1 : "any"} maxLength={100} defaultValue={options[key] ?? ""} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `filter-error-${key}` : undefined} />}{errors[key] && <span id={`filter-error-${key}`} role="alert">{errors[key]}</span>}</label>; })}
      <Button type="submit">Apply filters</Button>
    </form>
    <div className="row wrap">{Object.entries(options).filter(([key]) => key !== "sort").map(([key,value]) => <button type="button" className="search-scope-badge" key={key} aria-label={`Remove ${filterLabels[key as keyof typeof filterLabels]} filter`} onClick={() => removeFilter(key)}>{filterLabels[key as keyof typeof filterLabels]}: {key === "author" ? value === identity ? "Me" : "Selected author" : value} ×</button>)}</div>
  </div>;
}
