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
import { forgetRecentSearch, readRecentSearches, rememberSearch } from "./recent-searches";
import { scopedSearchSchema, scopesFor, searchLabels, searchPageUrl, searchSettings, searchQuerySchema, normalizeSearch, filterKeysFor, withoutSearchSelection, searchKindScope, type SearchOptions, type SearchScope } from "@/lib/search/scopes";
import { searchResultHref, type SearchResult } from "@/services/search/search.service";
import { enrichOwnSearchResult } from "@/lib/search/result-copy";
import { SearchScopeBadges } from "./scope-badges";
import { SearchFailure } from "./search-failure";
import { SearchSuggestionRow } from "./suggestion-row";
import { compatibleSearchOptions } from "@/lib/search/capabilities";

type StartOption = { group: string; label: string; note?: string; icon: "clock" | "search" | "building" | "user"; query?: string; href?: string; recentId?: string };

/** Keeps the flat keyboard index of each option while grouping them for display. */
function groupStartOptions(options: StartOption[]) {
  const groups: { group: string; items: { option: StartOption; index: number }[] }[] = [];
  options.forEach((option, index) => {
    const last = groups.at(-1);
    if (last?.group === option.group) last.items.push({ option, index });
    else groups.push({ group: option.group, items: [{ option, index }] });
  });
  return groups;
}

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
  const pointerInside = useRef(false);
  const parsed = searchQuerySchema.safeParse(value);
  const term = normalizeSearch(value);
  const options = Object.fromEntries(Object.entries(activeOptions).filter(([key]) => key === "sort" || filterKeysFor(category).includes(key as never))) as SearchOptions;
  const ready = !!term && parsed.success && term === debounced && !composing;
  const result = useQuery({ queryKey: ["workspace-search", scope, role, "header", category, debounced, options], queryFn: ({ signal }) => services.search.query({ role, q: debounced, scope: category, limit: 10, mode: "suggestions", ...options }, { signal }), enabled: hydrated && !!scope && open && ready, placeholderData: () => undefined, retry: false, staleTime: 15_000, refetchOnWindowFocus: false });
  const people = ready && !result.isError ? result.data?.items ?? [] : [];
  // Before anything is typed: recent searches, skills, companies and people to explore, each with its reason.
  const starters = useQuery({ queryKey: ["search-suggestions", scope, role], queryFn: ({ signal }) => services.search.suggestions(role, { signal }), enabled: hydrated && !!scope && open && !term, retry: false, staleTime: 60_000, refetchOnWindowFocus: false });
  const serverRecent = starters.data?.recent ?? [];
  const startOptions: StartOption[] = [
    ...(serverRecent.length ? serverRecent.map(entry => ({ group: "Recent searches", label: entry.query, icon: "clock" as const, query: entry.query, recentId: entry.id })) : recent.map(query => ({ group: "Recent searches", label: query, icon: "clock" as const, query }))),
    ...(starters.data?.skills ?? []).map(skill => ({ group: "Skills", label: skill.name, note: skill.reason, icon: "search" as const, query: skill.name })),
    ...(starters.data?.companies ?? []).map(company => company.slug
      ? { group: "Companies", label: company.name, note: company.reason, icon: "building" as const, href: searchResultHref(role, { kind: "company", id: company.id, slug: company.slug, title: company.name, subtitle: "", picture: "", recruiter: false, companyAccess: "public" }) }
      : { group: "Companies", label: company.name, note: company.reason, icon: "building" as const, query: company.name }),
    ...(starters.data?.people ?? []).map(person => ({ group: "People you may know", label: person.name, note: person.reason, icon: "user" as const, href: searchResultHref(role, { kind: "person", id: person.id, slug: person.slug ?? null, title: person.name, subtitle: "", picture: "", recruiter: !!person.recruiter }) })),
  ];
  const choices = term ? people.length : startOptions.length;
  const activeId = open && active >= 0 && active < choices ? `${id}-option-${active}` : undefined;
  const identity = useServiceQuery(["feed", "identity", role], async s => role === "recruiter" ? (await s.workspace.getRecruiterShell()).identity : (await s.workspace.getProfessionalShell()).person, { enabled: open });
  const profile = useServiceQuery(["profile"], s => s.profile.getProfile(), { enabled: open && role === "professional" });
  const homeCompany = useServiceQuery(["company", "home"], s => s.workspace.getHomeCompany(), { enabled: open && role === "recruiter" });
  const network = useServiceQuery(["network", role], s => s.feed.getNetwork(role), { enabled: open });
  const ownPerson = role === "professional" ? profile.data?.person ?? identity.data : identity.data;
  const ownSearch = ownPerson ? { id: ownPerson.id, headline: ownPerson.headline, location: "location" in ownPerson ? String(ownPerson.location ?? "") : "", summary: "summary" in ownPerson ? String(ownPerson.summary ?? "") : "", category: "category" in ownPerson ? String(ownPerson.category ?? "") : "", currentTitle: profile.data?.details.currentTitle } : undefined;
  const detailedPeople = category === "people" || category === "talent";

  useEffect(() => { if (composing) return; const timer = window.setTimeout(() => setDebounced(normalizeSearch(value)), searchSettings.debounceMs); return () => window.clearTimeout(timer); }, [value, composing]);
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const inside = !!ref.current?.contains(event.target as Node);
      pointerInside.current = inside;
      if (!inside) { setOpen(false); setActive(-1); }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);
  useEffect(() => { if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" }); }, [activeId]);

  const submit = (query: string, selected?: SearchResult) => {
    const input = searchQuerySchema.safeParse(query);
    if (!input.success) { setError(input.error.issues[0].message); return; }
    const text = input.data;
    const resultsScope: SearchScope = selected ? searchKindScope(selected.kind) ?? "all" : category;
    const nextOptions: SearchOptions = selected
      ? { ...compatibleSearchOptions(category, resultsScope, withoutSearchSelection(options)), selected: `${selected.kind}:${selected.id}` }
      : withoutSearchSelection(options);
    let valid = false;
    try { valid = scopedSearchSchema.safeParse({ role, q: text, scope: resultsScope, limit: 10, ...nextOptions }).success; } catch { valid = false; }
    if (!valid) { setError("Choose a search category available in this workspace."); return; }
    if (!selected) setRecent(rememberSearch(scope, text, scope ? readRecentSearches(scope) : recent));
    setValue(text); setError(undefined); setOpen(false); setActive(-1);
    setFeed({ query: text, searchScope: resultsScope, searchOptions: nextOptions, filter: "all", visible: 12 });
    track("search_performed", { surface: "feed", hasQuery: !!text });
    router.push(searchPageUrl(role, text, resultsScope, nextOptions));
  };
  const visit = (result: SearchResult) => {
    submit(value, result);
  };
  // F4b: recent searches can be removed one by one or all at once (server history, else this tab's list).
  const forget = async (option?: StartOption) => {
    try {
      if (serverRecent.length) {
        if (option?.recentId) await services.search.forgetSearch(role, option.recentId);
        else await services.search.clearSearches(role);
        await starters.refetch();
      }
      setRecent(forgetRecentSearch(scope, option?.query));
      setActive(-1);
      ref.current?.querySelector("input")?.focus();
    } catch {
      setError("Recent searches could not be updated. Try again.");
    }
  };
  const choose = (option: StartOption) => {
    if (option.query !== undefined) { submit(option.query); return; }
    setOpen(false); setActive(-1);
    if (option.href) router.push(option.href);
  };

  return <form ref={ref} className={`professional-search header-search${value.length ? " has-query" : ""}`} id="feed-search-form" role="search" noValidate
    onSubmit={event => { event.preventDefault(); if (!composing) submit(value); }}
    onPointerDownCapture={() => { pointerInside.current = true; }}
    onBlur={event => {
      const next = event.relatedTarget as Node | null;
      if (event.currentTarget.contains(next)) return;
      if (!next && pointerInside.current) return;
      setOpen(false); setActive(-1);
    }}>
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
          event.preventDefault(); if (term) visit(people[active]); else choose(startOptions[active]);
        }
      }} />
    {!value.length && <kbd aria-hidden="true">⌘ K</kbd>}
    {!!value.length && <button type="button" className="header-search-clear" aria-label="Clear search" onClick={() => { setValue(""); setDebounced(""); setActive(-1); setError(undefined); setOpen(true); setRecent(readRecentSearches(scope)); ref.current?.querySelector("input")?.focus(); }}><Icon name="close" /></button>}
    {error && <span id={`${id}-error`} role="alert" className="header-search-error">{error}</span>}
    {open && <div className="header-search-dropdown">
      <SearchScopeBadges role={role} value={category} onChange={next => { setActiveOptions(compatibleSearchOptions(category,next,options)); setCategory(next); setActive(-1); ref.current?.querySelector("input")?.focus(); }} />
      <div className="header-search-results">
        <h2>{term ? category === "all" ? "Results" : searchLabels[category] : "Explore"}</h2>
        <div id={`${id}-list`} role="listbox" aria-label={term ? "Matching search results" : "Search suggestions"}>
          {!term && groupStartOptions(startOptions).map(({ group, items }) => <div key={group} role="group" aria-label={group} className="header-search-group">
            <p className="header-search-group-label" aria-hidden="true">{group}{group === "Recent searches" && <button type="button" className="header-search-clear-all" onClick={() => void forget()}>Clear all</button>}</p>
            {items.map(({ option, index }) => <div key={`${group}:${option.label}`} className="header-search-start-row">
              <button id={`${id}-option-${index}`} type="button" role="option" aria-selected={active === index} className="header-search-option recent-search-option" onClick={() => choose(option)}>
                <Icon name={option.icon} /><span>{option.label}</span>{option.note ? <small className="search-result-reason">{option.note}</small> : null}
              </button>
              {group === "Recent searches" && <button type="button" className="header-search-forget" aria-label={`Remove “${option.label}” from recent searches`} onClick={() => void forget(option)}><Icon name="close" /></button>}
            </div>)}
          </div>)}
          {term && people.map((person, index) => {
            const result = enrichOwnSearchResult(person, ownSearch);
            return <SearchSuggestionRow key={`${person.kind}:${person.id}`} result={result} query={term} detailed={detailedPeople} selected={active === index} optionId={`${id}-option-${index}`} role={role} followingPeople={network.data?.following.map(entry => entry.id) ?? []} followingCompanies={network.data?.companies.map(entry => entry.id) ?? []} ownPersonId={ownPerson?.id ?? identity.data?.id} ownCompanyId={homeCompany.data?.id} onVisit={visit} />;
          })}
        </div>
        {Object.keys(options).some(key => key !== "sort") && <p className="header-search-hint">Filters are applied to this search. <button type="button" onClick={() => { setActiveOptions({ sort: options.sort }); setActive(-1); ref.current?.querySelector("input")?.focus(); }}>Clear filters</button></p>}
        {!term && !startOptions.length && !starters.isFetching && <p className="header-search-hint">Your recent searches will appear here.</p>}
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
