"use client";

import Link from "next/link";
import { useEffect, useMemo, useTransition, type ComponentProps, type MouseEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { Role } from "@/types/domain";
import { useServiceAction, useServiceQuery, useServices } from "@/hooks/use-services";
import { useHydrated } from "@/hooks/use-hydrated";
import { useUiStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { scopedSearchSchema, searchPageUrl, searchLabels, searchOptionsFromUrl, scopesFor, withoutSearchSelection, searchKindScope, filterKeysFor, searchSettings, type SearchOptions, type SearchScope } from "@/lib/search/scopes";
import { searchResultHref, searchResultLabel, type SearchResult } from "@/services/search/search.service";
import { SearchResultMark } from "./result-mark";
import { SearchFollowButton, SearchResultCopy, followableId } from "./suggestion-row";
import { SuggestionCard, SuggestionCardGrid } from "@/components/suggestions/suggestion-card";
import { track } from "@/lib/analytics";
import { toast } from "@/stores/toast-store";
import { SearchFilterBar, SearchSubFilterBar } from "./search-filter-bar";
import { compatibleSearchOptions } from "@/lib/search/capabilities";
import { SearchFailure } from "./search-failure";
import { canFollowSearchResult, companyMetaLine, enrichOwnSearchResult, searchMetaLine, type OwnSearchPerson } from "@/lib/search/result-copy";
import { formatFollowers } from "@/lib/utils/text";
import { PermalinkEntry } from "@/features/feed/permalink-entry";
import { useJobActions } from "@/features/feed/job-dialogs";
import { similarCompanyCategory, similarCompanyQuery, similarPersonCategory } from "@/lib/search/similar-companies";

const ALL_CATEGORY_PREVIEW = 3;

type SearchResultGroup = { key: string; kind: "post"; item: SearchResult } | { key: string; kind: "rows"; items: SearchResult[] };
type SearchCategorySection = { scope: SearchScope; items: SearchResult[] };

function searchResultGroups(items: SearchResult[]): SearchResultGroup[] {
  const groups: SearchResultGroup[] = [];
  for (const item of items) {
    if (item.kind === "post") {
      groups.push({ key: `post:${item.id}`, kind: "post", item });
      continue;
    }
    const last = groups.at(-1);
    if (last?.kind === "rows") last.items.push(item);
    else groups.push({ key: `rows:${item.id}`, kind: "rows", items: [item] });
  }
  return groups;
}

function searchResultKey(item: SearchResult) {
  return `${item.kind}:${item.id}`;
}

function takeSelectedResult(items: SearchResult[], selected?: string) {
  if (!selected) return { selectedItem: undefined as SearchResult | undefined, rest: items };
  const selectedItem = items.find(item => searchResultKey(item) === selected);
  return { selectedItem, rest: selectedItem ? items.filter(item => searchResultKey(item) !== selected) : items };
}

function selectedCategory(selected?: string): SearchScope | undefined {
  return searchKindScope(selected?.split(":")[0] ?? "");
}

function searchCategorySections(role: Role, items: SearchResult[]): SearchCategorySection[] {
  const buckets = new Map<SearchScope, SearchResult[]>();
  for (const item of items) {
    const kindScope = searchKindScope(item.kind);
    if (!kindScope) continue;
    const grouped = buckets.get(kindScope);
    if (grouped) grouped.push(item);
    else buckets.set(kindScope, [item]);
  }
  return scopesFor(role).flatMap(scope => {
    const grouped = buckets.get(scope);
    return grouped ? [{ scope, items: grouped }] : [];
  });
}

export function SearchScreen({ role }: { role: Role }) {
  const params = useSearchParams();
  const query = params.get("q") ?? "", category = params.get("scope") ?? "all";
  const encodedOptions = JSON.stringify(searchOptionsFromUrl(params));
  const parsed = useMemo(() => scopedSearchSchema.safeParse({ role, q: query, scope: category, ...JSON.parse(encodedOptions) }), [role, query, category, encodedOptions]);
  const routeError = !parsed.success && parsed.error.issues[0].code === "unrecognized_keys" ? "This search contains an unsupported or repeated filter." : !parsed.success ? parsed.error.issues[0].message : "";
  const setFeed = useUiStore(s => s.setFeed);
  useEffect(() => { if (parsed.success) setFeed({ query: parsed.data.q, searchScope: parsed.data.scope, searchOptions: JSON.parse(encodedOptions) }); }, [parsed, encodedOptions, setFeed]);
  return <section className="workspace-search-page" aria-label="Search results">
    {!parsed.success ? (
      <div className="workspace-search-main">
        <h1 className="sr-only">Search results</h1>
        {params.has("q") ? <p role="alert">{routeError} Use the header search to start another search.</p> : <p className="muted">Find companies, people, jobs and work shared on Skillora using the header search.</p>}
      </div>
    ) : <SearchResults key={`${category}:${query}:${encodedOptions}`} role={role} query={parsed.data.q} scope={parsed.data.scope} options={JSON.parse(encodedOptions)} />}
  </section>;
}

function SearchResults({ role, query, scope, options }: { role: Role; query: string; scope: SearchScope; options: SearchOptions }) {
  const services = useServices(), hydrated = useHydrated(), router = useRouter();
  const [navigating,startNavigation] = useTransition();
  const navigate = (url: string) => startNavigation(() => router.push(url));
  const selectionScope = selectedCategory(options.selected);
  const viewScope = scope === "all" && selectionScope && scopesFor(role).includes(selectionScope) ? selectionScope : scope;
  const changeCategory = (next: SearchScope) => {
    if (navigating) return;
    if (!scopesFor(role).includes(next)) return;
    const selectedKind = options.selected?.split(":")[0];
    const keepSelected = !!selectedKind && next !== "all" && searchKindScope(selectedKind) === next;
    const nextOptions = keepSelected
      ? compatibleSearchOptions(scope, next, options)
      : withoutSearchSelection(compatibleSearchOptions(scope, next, options));
    if (next === scope && next === viewScope) return;
    const parsed = scopedSearchSchema.safeParse({ role, q: query, scope: next, ...nextOptions });
    if (!parsed.success) return;
    navigate(searchPageUrl(role, parsed.data.q, next, nextOptions));
  };
  const result = useInfiniteQuery({ queryKey: ["workspace-search", "results", role, viewScope, query, options], initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => services.search.query({ role, q: query, scope: viewScope, cursor: pageParam, limit: 20, ...(viewScope === scope ? options : { ...compatibleSearchOptions(scope, viewScope, withoutSearchSelection(options)), selected: options.selected }) }, { signal }), getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: hydrated, placeholderData: () => undefined, retry: false, refetchOnWindowFocus: false });
  const items = result.data?.pages.flatMap(page => page.items) ?? [];
  const identity = useServiceQuery(["feed", "identity", role], async s => role === "recruiter" ? (await s.workspace.getRecruiterShell()).identity : (await s.workspace.getProfessionalShell()).person);
  const profile = useServiceQuery(["profile"], s => s.profile.getProfile(), { enabled: role === "professional" });
  const ownPerson = role === "professional" ? profile.data?.person ?? identity.data : identity.data;
  const ownSearch = ownPerson ? { id: ownPerson.id, headline: ownPerson.headline, location: "location" in ownPerson ? String(ownPerson.location ?? "") : "", summary: "summary" in ownPerson ? String(ownPerson.summary ?? "") : "", category: "category" in ownPerson ? String(ownPerson.category ?? "") : "", currentTitle: profile.data?.details.currentTitle } : undefined;
  const homeCompany = useServiceQuery(["company", "home"], s => s.workspace.getHomeCompany(), { enabled: role === "recruiter" });
  const network = useServiceQuery(["network", role], s => s.feed.getNetwork(role));
  const followingPeople = network.data?.following.map(entry => entry.id) ?? [];
  const followingCompanies = network.data?.companies.map(entry => entry.id) ?? [];
  const viewItems = viewScope === "all" ? items : items.filter(item => searchKindScope(item.kind) === viewScope);
  const { selectedItem, rest } = takeSelectedResult(viewItems, options.selected);
  const stacked = selectedItem ? [selectedItem, ...rest] : viewItems;
  const listProps = { query, role, options, ownSearch, followingPeople, followingCompanies, ownPersonId: ownPerson?.id ?? identity.data?.id, ownCompanyId: homeCompany.data?.id };
  return <>
    <SearchFilterBar role={role} scope={scope} pending={navigating} onCategory={changeCategory} selectionScope={selectionScope} />
    <SearchSubFilterBar role={role} scope={viewScope} options={viewScope === scope ? options : { ...compatibleSearchOptions(scope, viewScope, withoutSearchSelection(options)), selected: options.selected }} pending={navigating} onApply={next => {
      if (navigating) return false;
      const parsed = scopedSearchSchema.safeParse({role,q:query,scope:viewScope,...next});
      if (!parsed.success) return false;
      const url=searchPageUrl(role,parsed.data.q,viewScope,next); if(url!==searchPageUrl(role,query,viewScope,options)) navigate(url); return true;
    }} />
    <div className="workspace-search-main">
      <h1 className="sr-only">Search results</h1>
      <p className="workspace-search-summary" role="status">{searchLabels[viewScope]} results for “{query}”{result.data?.pages[0].total != null ? ` · ${result.data.pages[0].total} ${result.data.pages[0].total === 1 ? "match" : "matches"}` : ""}</p>
      {result.isFetching && !result.data && <div className="stack" aria-busy="true"><Skeleton style={{ height: 70 }} /><Skeleton style={{ height: 70 }} /></div>}
      {result.isError && !result.isFetchNextPageError && <SearchFailure error={result.error} retry={() => void result.refetch()} />}
      {result.isSuccess && !viewItems.length && <EmptySearchResults scope={viewScope} context={listProps} />}
      <div className="workspace-search-stack">{viewScope === "all" ? searchCategorySections(role, items).map(section => {
        const preview = section.items.slice(0, ALL_CATEGORY_PREVIEW);
        return <section key={section.scope} className="workspace-search-category" aria-labelledby={`search-category-${section.scope}`}>
          <h2 id={`search-category-${section.scope}`}>{searchLabels[section.scope]}</h2>
          {section.scope === "posts" ? preview.map(item => <PermalinkEntry key={`post:${item.id}`} id={item.id} role={role} surface="search" />) : (
            <SearchResultList items={preview} {...listProps} />
          )}
          <Link href={searchPageUrl(role, query, section.scope, compatibleSearchOptions("all", section.scope, options))} className="workspace-search-show-all">
            Show all <Icon name="arrow" />
          </Link>
        </section>;
      }) : searchResultGroups(stacked).map(group => group.kind === "post" ? (
        <PermalinkEntry key={group.key} id={group.item.id} role={role} surface="search" />
      ) : (
        <SearchResultList key={group.key} items={group.items} {...listProps} />
      ))}</div>
      {result.isFetchNextPageError && <SearchFailure error={result.error} retry={() => void result.fetchNextPage()} />}
      {result.hasNextPage && viewScope === scope && <Button disabled={result.isFetchingNextPage} onClick={() => void result.fetchNextPage()}>Show more results</Button>}
      {viewScope === "companies" && result.isSuccess && !!viewItems.length && (
        <SimilarCompanies role={role} query={query} items={viewItems} options={options} followingCompanies={followingCompanies} ownCompanyId={homeCompany.data?.id} />
      )}
      {viewScope === "people" && result.isSuccess && !!viewItems.length && (
        <SimilarPeople role={role} query={query} items={viewItems} options={options} followingPeople={followingPeople} ownPersonId={ownPerson?.id ?? identity.data?.id} />
      )}
    </div>
  </>;
}

function EmptySearchResults({ scope, context }: { scope: SearchScope; context: Omit<ComponentProps<typeof SearchResultList>, "items"> }) {
  const services = useServices();
  const filters = Object.fromEntries(Object.entries(context.options).filter(([key]) => filterKeysFor(scope).includes(key as never))) as SearchOptions;
  const input = { role: context.role, q: context.query, scope, ...filters, mode: "related" as const, limit: searchSettings.relatedLimit };
  const result = useQuery({
    queryKey: ["workspace-search", "empty-suggestions", context.role, scope, context.query, filters],
    queryFn: ({ signal }) => services.search.query(input, { signal }),
    placeholderData: () => undefined,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const suggestions = result.data?.items ?? [];
  const heading = scope === "all" ? "Suggestions for you" : scope === "skills" ? "Suggested talent" : `Suggested ${searchLabels[scope].toLowerCase()}`;
  const suggestionContext = { ...context, options: {} };
  return <>
    <div className="workspace-search-empty" role="status">
      <span className="workspace-search-empty-icon" aria-hidden="true"><Icon name="search" /></span>
      <h2>No result!</h2>
    </div>
    {(result.isPending || result.isError || !!suggestions.length) && <section className="workspace-search-similar" aria-label={heading}>
      <h2>{heading}</h2>
      {result.isPending && result.isFetching && <div className="stack" aria-busy="true"><Skeleton style={{ height: 88 }} /><Skeleton style={{ height: 88 }} /></div>}
      {result.isError && <SearchFailure error={result.error} retry={() => void result.refetch()} />}
      {!!suggestions.length && (scope === "companies" ? <SuggestionCardGrid>{suggestions.map(item => <SimilarCompanyCard key={item.id} item={item} role={context.role} following={context.followingCompanies.includes(item.id)} ownCompanyId={context.ownCompanyId} />)}</SuggestionCardGrid>
        : ["people", "talent", "skills"].includes(scope) ? <SuggestionCardGrid>{suggestions.map(item => <SimilarPersonCard key={item.id} item={item} role={context.role} following={context.followingPeople.includes(item.id)} ownPersonId={context.ownPersonId} />)}</SuggestionCardGrid>
        : <SearchResultList items={suggestions} {...suggestionContext} />)}
    </section>}
  </>;
}

function SimilarCompanies({ role, query, items, options, followingCompanies, ownCompanyId }: {
  role: Role;
  query: string;
  items: SearchResult[];
  options: SearchOptions;
  followingCompanies: string[];
  ownCompanyId?: string;
}) {
  const services = useServices(), hydrated = useHydrated();
  const category = similarCompanyCategory(items, options);
  const similarQuery = similarCompanyQuery(category, query);
  const parsed = similarQuery ? scopedSearchSchema.safeParse({ role, q: similarQuery, scope: "companies", industry: similarQuery, limit: 8 }) : undefined;
  const result = useQuery({
    queryKey: ["workspace-search", "similar-companies", role, similarQuery],
    queryFn: ({ signal }) => services.search.query({ role, q: similarQuery!, scope: "companies", industry: similarQuery, limit: 8 }, { signal }),
    enabled: hydrated && !!parsed?.success,
    placeholderData: () => undefined,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const seen = new Set(items.map(item => item.id));
  const suggestions = (result.data?.items ?? []).filter(item => item.kind === "company" && !seen.has(item.id));
  if (!suggestions.length) return null;
  return <section className="workspace-search-similar" aria-labelledby="search-similar-companies">
    <h2 id="search-similar-companies">Similar Companies</h2>
    <SuggestionCardGrid>
      {suggestions.map(item => (
        <SimilarCompanyCard key={item.id} item={item} role={role} following={followingCompanies.includes(item.id)} ownCompanyId={ownCompanyId} />
      ))}
    </SuggestionCardGrid>
  </section>;
}

function SimilarPeople({ role, query, items, options, followingPeople, ownPersonId }: {
  role: Role;
  query: string;
  items: SearchResult[];
  options: SearchOptions;
  followingPeople: string[];
  ownPersonId?: string;
}) {
  const services = useServices(), hydrated = useHydrated();
  const category = similarPersonCategory(items, options);
  const similarQuery = similarCompanyQuery(category, query);
  const parsed = similarQuery ? scopedSearchSchema.safeParse({ role, q: similarQuery, scope: "people", ...(options.location ? { location: options.location } : {}), limit: 8 }) : undefined;
  const result = useQuery({
    queryKey: ["workspace-search", "similar-people", role, similarQuery, options.location],
    queryFn: ({ signal }) => services.search.query({ role, q: similarQuery!, scope: "people", ...(options.location ? { location: options.location } : {}), limit: 8 }, { signal }),
    enabled: hydrated && !!parsed?.success,
    placeholderData: () => undefined,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const seen = new Set(items.map(item => item.id));
  if (ownPersonId) seen.add(ownPersonId);
  const suggestions = (result.data?.items ?? []).filter(item => (item.kind === "person" || item.kind === "talent") && !seen.has(item.id));
  if (!suggestions.length) return null;
  return <section className="workspace-search-similar" aria-labelledby="search-similar-people">
    <h2 id="search-similar-people">Similar People</h2>
    <SuggestionCardGrid>
      {suggestions.map(item => (
        <SimilarPersonCard key={item.id} item={item} role={role} following={followingPeople.includes(item.id)} ownPersonId={ownPersonId} />
      ))}
    </SuggestionCardGrid>
  </section>;
}

function SimilarPersonCard({ item, role, following, ownPersonId }: { item: SearchResult; role: Role; following: boolean; ownPersonId?: string }) {
  const run = useServiceAction();
  const href = searchResultHref(role, item);
  const follow = canFollowSearchResult(item, ownPersonId) ? async () => {
    const id = followableId(item.id);
    if (!id) {
      toast("This profile cannot be followed.", "error");
      return;
    }
    const next = await run((s) => s.feed.toggleFollow(role, id), { invalidate: ["network", "feed"] });
    if (next === undefined) return;
    track("person_followed", { personId: id, following: next });
    toast(next ? "Following updated." : "Unfollowed.");
  } : undefined;
  return <SuggestionCard href={href} label={searchResultLabel(item)} name={item.title} headline={item.designation || item.subtitle} person={{ id: item.id, name: item.title, picture: item.picture }} meta={searchMetaLine([item.location, item.followerCount != null ? formatFollowers(item.followerCount) : ""]) || undefined} following={following} onFollow={follow} />;
}

function SimilarCompanyCard({ item, role, following, ownCompanyId }: { item: SearchResult; role: Role; following: boolean; ownCompanyId?: string }) {
  const run = useServiceAction();
  const href = searchResultHref(role, item);
  const follow = canFollowSearchResult(item, undefined, ownCompanyId) ? async () => {
    const id = followableId(item.id);
    if (!id) {
      toast("This profile cannot be followed.", "error");
      return;
    }
    const next = await run((s) => s.feed.toggleFollowCompany(role, id), { invalidate: ["network", "feed"] });
    if (next === undefined) return;
    track("company_followed", { companyId: id, following: next });
    toast(next ? "Following company." : "Unfollowed company.");
  } : undefined;
  return <SuggestionCard href={href} label={searchResultLabel(item)} name={item.title} headline={companyMetaLine(item)} person={{ id: item.id, name: item.title, picture: item.picture }} kind="company" meta={item.followerCount != null ? formatFollowers(item.followerCount) : undefined} following={following} onFollow={follow} />;
}

function SearchResultList({ items, query, role, options, ownSearch, followingPeople, followingCompanies, ownPersonId, ownCompanyId }: {
  items: SearchResult[];
  query: string;
  role: Role;
  options: SearchOptions;
  ownSearch?: OwnSearchPerson;
  followingPeople: string[];
  followingCompanies: string[];
  ownPersonId?: string;
  ownCompanyId?: string;
}) {
  const jobs = useJobActions();
  const openJob = (id: string, event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    jobs.view(id, "search");
  };
  return <ul className="workspace-search-results">{items.map(item => {
    const resultItem = enrichOwnSearchResult(item, ownSearch);
    return <li key={`${item.kind}:${item.id}`} className={options.selected === `${item.kind}:${item.id}` ? "is-selected" : undefined}>
      <Link href={searchResultHref(role, item)} aria-label={searchResultLabel(item)} onClick={item.kind === "job" ? (event) => openJob(item.id, event) : undefined}>
        <SearchResultMark result={resultItem} />
        <span className="header-search-copy">
          <SearchResultCopy result={resultItem} query={query} detailed={false} surface="page" />
          {item.companyAccess === "workspace" ? <small>Visible only to your company</small> : null}
        </span>
      </Link>
      <SearchFollowButton result={resultItem} role={role} followingPeople={followingPeople} followingCompanies={followingCompanies} ownPersonId={ownPersonId} ownCompanyId={ownCompanyId} />
    </li>;
  })}</ul>;
}
