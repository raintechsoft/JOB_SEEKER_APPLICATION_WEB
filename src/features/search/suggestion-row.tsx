"use client";

import { z } from "zod";
import type { Role } from "@/types/domain";
import { apiConfig } from "@/services/api/config";
import { useServiceAction } from "@/hooks/use-services";
import { track } from "@/lib/analytics";
import { canFollowSearchResult, companyMetaLine, jobMetaLine, personCompactLine, personDetailBio, searchMetaLine } from "@/lib/search/result-copy";
import { formatFollowers } from "@/lib/utils/text";
import { searchResultLabel, type SearchResult } from "@/services/search/search.service";
import { toast } from "@/stores/toast-store";
import { Button } from "@/components/ui/primitives";
import { SearchResultMark } from "./result-mark";
import { SearchHighlight } from "./highlight";

export function followableId(id: string) {
  if (apiConfig.dataSource === "http") return z.uuid().safeParse(id).success ? id : null;
  return id.trim() || null;
}

export function SearchResultCopy({ result, query, detailed, surface = "dropdown" }: { result: SearchResult; query: string; detailed: boolean; surface?: "dropdown" | "page" }) {
  const followers = result.followerCount != null ? formatFollowers(result.followerCount) : "";
  if (result.kind === "person" || result.kind === "talent") {
    const bio = detailed ? personDetailBio(result) : personCompactLine(result);
    const location = result.location?.trim() ?? "";
    if (surface === "page") {
      return <>
        <strong><SearchHighlight text={result.title} query={query} /></strong>
        {bio ? <span className="header-search-bio"><SearchHighlight text={bio} query={query} /></span> : null}
        {followers ? <span className="header-search-meta">{followers}</span> : null}
        {location ? <span className="header-search-location">{location}</span> : null}
      </>;
    }
    if (detailed) {
      const line = searchMetaLine([bio, followers, location]);
      return <>
        <strong><SearchHighlight text={result.title} query={query} /></strong>
        {line ? <span className="header-search-meta"><SearchHighlight text={line} query={query} /></span> : null}
      </>;
    }
    const line = searchMetaLine([bio, followers]);
    return <>
      <strong><SearchHighlight text={result.title} query={query} /></strong>
      {line ? <span className="header-search-meta"><SearchHighlight text={line} query={query} /></span> : null}
    </>;
  }
  if (result.kind === "company") {
    const line = searchMetaLine([companyMetaLine(result), followers]);
    return <>
      <strong><SearchHighlight text={result.title} query={query} /></strong>
      {line ? <span className="header-search-meta"><SearchHighlight text={line} query={query} /></span> : null}
    </>;
  }
  if (result.kind === "job") {
    const line = searchMetaLine([jobMetaLine(result), followers]);
    return <>
      <strong><SearchHighlight text={result.title} query={query} /></strong>
      {line ? <span className="header-search-meta"><SearchHighlight text={line} query={query} /></span> : null}
    </>;
  }
  return <>
    <strong><SearchHighlight text={result.title} query={query} /></strong>
    {result.subtitle?.trim() ? <span className="header-search-meta"><SearchHighlight text={result.subtitle} query={query} /></span> : null}
  </>;
}

export function SearchFollowButton({
  result,
  role,
  followingPeople,
  followingCompanies,
  ownPersonId,
  ownCompanyId,
}: {
  result: SearchResult;
  role: Role;
  followingPeople: string[];
  followingCompanies: string[];
  ownPersonId?: string;
  ownCompanyId?: string;
}) {
  const run = useServiceAction();
  const company = result.kind === "company";
  const following = company ? followingCompanies.includes(result.id) : followingPeople.includes(result.id);
  if (!canFollowSearchResult(result, ownPersonId, ownCompanyId)) return null;
  const toggleFollow = async () => {
    const id = followableId(result.id);
    if (!id) {
      toast("This profile cannot be followed.", "error");
      return;
    }
    const next = await run((s) => (company ? s.feed.toggleFollowCompany(role, id) : s.feed.toggleFollow(role, id)), { invalidate: ["network", "feed"] });
    if (next === undefined) return;
    if (company) {
      track("company_followed", { companyId: id, following: next });
      toast(next ? "Following company." : "Unfollowed company.");
      return;
    }
    track("person_followed", { personId: id, following: next });
    toast(next ? "Following updated." : "Unfollowed.");
  };
  return <span className="header-search-follow-slot"><Button unstyled type="button" icon={following ? "check" : "plus"} className={"header-search-follow" + (following ? " is-following" : "")} aria-pressed={following} aria-label={(following ? "Unfollow " : "Follow ") + result.title} onPointerDown={event => { event.preventDefault(); event.stopPropagation(); }} onClick={event => { event.preventDefault(); event.stopPropagation(); return toggleFollow(); }}>{following ? "Following" : "Follow"}</Button></span>;
}

export function SearchSuggestionRow({
  result,
  query,
  detailed,
  selected,
  optionId,
  role,
  followingPeople,
  followingCompanies,
  ownPersonId,
  ownCompanyId,
  onVisit,
}: {
  result: SearchResult;
  query: string;
  detailed: boolean;
  selected: boolean;
  optionId: string;
  role: Role;
  followingPeople: string[];
  followingCompanies: string[];
  ownPersonId?: string;
  ownCompanyId?: string;
  onVisit: (result: SearchResult) => void;
}) {
  return <div className={`header-search-row${detailed && (result.kind === "person" || result.kind === "talent") ? " is-detailed" : ""}`}>
    <div id={optionId} role="option" aria-selected={selected} aria-label={searchResultLabel(result)} className="header-search-option" onClick={() => onVisit(result)}>
      <SearchResultMark result={result} />
      <span className="header-search-copy"><SearchResultCopy result={result} query={query} detailed={detailed} /></span>
    </div>
    <SearchFollowButton result={result} role={role} followingPeople={followingPeople} followingCompanies={followingCompanies} ownPersonId={ownPersonId} ownCompanyId={ownCompanyId} />
  </div>;
}
