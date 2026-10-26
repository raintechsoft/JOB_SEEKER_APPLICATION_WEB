"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { Role } from "@/types/domain";
import { apiConfig } from "@/services/api/config";
import { useServiceQuery, useServices } from "@/hooks/use-services";
import { useHydrated } from "@/hooks/use-hydrated";
import { useUiStore } from "@/stores/ui-store";
import { track } from "@/lib/analytics";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { readRecentSearches, rememberSearch } from "./recent-searches";
import { scopedSearchSchema, scopesFor, searchLabels, searchPageUrl, searchSettings, searchQuerySchema, normalizeSearch, filterKeysFor, type SearchOptions, type SearchScope } from "@/lib/search/scopes";
import { resultKindLabels, searchResultHref, type SearchResult } from "@/services/search/search.service";
import { SearchScopeBadges } from "./scope-badges";
import { SearchResultMark } from "./result-mark";
import { SearchFailure } from "./search-failure";
import { SearchHighlight } from "./highlight";

export function HeaderSearch({ role }: { role: Role }) {
  const query = useUiStore(s => s.feed.query);
  const category = useUiStore(s => s.feed.searchScope);
  const options = useUiStore(s => s.feed.searchOptions);
  const pathname = usePathname();
  const session = useServiceQuery(["auth", "session"], s => s.auth.me(), { enabled: apiConfig.dataSource === "http" });
  const scope = apiConfig.dataSource === "http" ? session.data?.selected_identity_id ?? undefined : `demo:${role}`;
  return <HeaderSearchInput key={`${scope}:${pathname}:${query}:${category}:${JSON.stringify(options)}`} role={role} scope={scope} initialOptions={pathname.endsWith("/search") ? options : {}} initialQuery={query} initialCategory={scopesFor(role).includes(category) ? category : "all"} />;
}

function HeaderSearchInput({ role, scope, initialQuery, initialCategory, initialOptions }: { role: Role; scope?: string; initialQuery: string; initialCategory: SearchScope; initialOptions: SearchOptions }) {
  const services = useServices(), hydrated = useHydrated();
  const router = useRouter();
  const setFeed = useUiStore(s => s.setFeed);
  const ref = useRef<HTMLFormElement>(null);
  const id = useId();
  const [value, setValue] = useState(initialQuery);
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [category, setCategory] = useState(initialCategory);
  const [activeOptions, setActiveOptions] = useState(initialOptions);
  const parsed = searchQuerySchema.safeParse(value);
  const term = normalizeSearch(value);
  const options = Object.fromEntries(Object.entries(activeOptions).filter(([key]) => key === "sort" || filterKeysFor(category).includes(key as never))) as SearchOptions;
  const ready = !!term && parsed.success && term === debounced && !composing;
  const result = useQuery({ queryKey: ["workspace-search", scope, role, "header", category, debounced, options], queryFn: ({ signal }) => services.search.query({ role, q: debounced, scope: category, limit: 10, mode: "suggestions", ...options }, { signal }), enabled: hydrated && !!scope && open && ready, placeholderData: () => undefined, retry: false, staleTime: 15_000, refetchOnWindowFocus: false });
  const people = ready && !result.isError ? result.data?.items ?? [] : [];
  const choices = term ? people.length : recent.length;
  const activeId = open && active >= 0 && active < choices ? `${id}-option-${active}` : undefined;

  useEffect(() => { if (composing) return; const timer = window.setTimeout(() => setDebounced(normalizeSearch(value)), searchSettings.debounceMs); return () => window.clearTimeout(timer); }, [value, composing]);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) { setOpen(false); setActive(-1); } };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => { if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" }); }, [activeId]);

  const submit = (query: string) => {
    const input = searchQuerySchema.safeParse(query);
    if (!input.success) { setError(input.error.issues[0].message); return; }
    const text = input.data;
    const valid = scopedSearchSchema.safeParse({ role, q: text, scope: category, limit: 10, ...options }).success;
    if (!valid) { setError("Choose a search category available in this workspace."); return; }
    setRecent(rememberSearch(scope, text, scope ? readRecentSearches(scope) : recent));
    setValue(text); setError(undefined); setOpen(false); setActive(-1);
    setFeed({ query: text, searchScope: category, searchOptions: options, filter: "all", visible: 12 });
    track("search_performed", { surface: "feed", hasQuery: !!text });
    router.push(searchPageUrl(role, text, category, options));
  };
  const visit = (person: SearchResult) => {
    setOpen(false); setActive(-1);
    router.push(searchResultHref(role, person));
  };

  return <form ref={ref} className={`professional-search header-search${value.length ? " has-query" : ""}`} id="feed-search-form" role="search" noValidate
    onSubmit={event => { event.preventDefault(); if (!composing) submit(value); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { setOpen(false); setActive(-1); } }}>
    {!value.length && <Icon name="search" />}
    <input id={`${id}-input`} name="query" type="search" role="combobox" aria-label="Search Skillora" placeholder="Search Skillora" autoComplete="off" maxLength={200} value={value}
      aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} aria-activedescendant={activeId}
      aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
      onFocus={() => { setRecent(readRecentSearches(scope)); setOpen(true); }}
      onClick={() => setOpen(true)}
      onChange={event => { setValue(event.target.value); setOpen(true); setActive(-1); setError(undefined); }}
      onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing || composing) return;
        if (event.key === "Escape") { event.preventDefault(); setOpen(false); setActive(-1); }
        else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setOpen(true);
          setActive(index => !choices ? -1 : event.key === "ArrowDown" ? (index + 1) % choices : index < 0 ? choices - 1 : (index - 1 + choices) % choices);
        } else if (event.key === "Enter" && activeId) {
          event.preventDefault(); if (term) visit(people[active]); else submit(recent[active]);
        }
      }} />
    {!value.length && <kbd aria-hidden="true">⌘ K</kbd>}
    {!!value.length && <button type="button" className="header-search-clear" aria-label="Clear search" onClick={() => { setValue(""); setDebounced(""); setActive(-1); setError(undefined); setOpen(true); setRecent(readRecentSearches(scope)); ref.current?.querySelector("input")?.focus(); }}><Icon name="close" /></button>}
    {error && <span id={`${id}-error`} role="alert" className="header-search-error">{error}</span>}
    {open && <div className="header-search-dropdown">
      <SearchScopeBadges role={role} value={category} onChange={next => { setCategory(next); setActive(-1); ref.current?.querySelector("input")?.focus(); }} />
      <div className="header-search-results">
        <h2>{term ? category === "all" ? "Results" : searchLabels[category] : "Recent searches"}</h2>
        <div id={`${id}-list`} role="listbox" aria-label={term ? "Matching search results" : "Recent searches"}>
          {!term && recent.map((query, index) => <button key={query} id={`${id}-option-${index}`} type="button" role="option" aria-selected={active === index} className="header-search-option recent-search-option" onClick={() => submit(query)}><Icon name="clock" /><span>{query}</span></button>)}
          {term && people.map((person, index) => <button key={`${person.kind}:${person.id}`} id={`${id}-option-${index}`} type="button" role="option" aria-selected={active === index} className="header-search-option" onClick={() => visit(person)}><SearchResultMark result={person} /><span><strong><SearchHighlight text={person.title} query={term} /></strong><span>{resultKindLabels[person.kind]}{person.subtitle ? <> · <SearchHighlight text={person.subtitle} query={term} /></> : ""}{person.companyAccess === "workspace" && " · Your company only"}</span></span></button>)}
        </div>
        {Object.keys(options).some(key => key !== "sort") && <p className="header-search-hint">Filters are applied to this search. <button type="button" onClick={() => { setActiveOptions({ sort: options.sort }); setActive(-1); ref.current?.querySelector("input")?.focus(); }}>Clear filters</button></p>}
        {!term && !recent.length && <p className="header-search-hint">Your recent searches will appear here.</p>}
        {term && !parsed.success && <p className="header-search-hint">Enter at least {searchSettings.minimum} characters to search.</p>}
        {ready && result.isFetching && !result.data && <div className="header-search-placeholders" aria-busy="true" aria-label="Matching search results"><Skeleton style={{ height: 42 }} /><Skeleton style={{ height: 42 }} /><Skeleton style={{ height: 42 }} /></div>}
        {term && ready && result.isError && <SearchFailure error={result.error} retry={() => void result.refetch()} />}
        {term && ready && result.isSuccess && !people.length && <p className="header-search-hint">No matching results in {searchLabels[category].toLowerCase()}. Try another term or category.</p>}
        <span className="sr-only" role="status">{ready && result.isSuccess ? `${people.length} suggestions available.` : ""}</span>
      </div>
      {term && <button type="submit" className="header-search-all">See all results</button>}
    </div>}
  </form>;
}
