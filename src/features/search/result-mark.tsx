import { Avatar } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import type { SearchResult } from "@/services/search/search.service";

export function SearchResultMark({ result }: { result: SearchResult }) {
  const companyOwned = result.kind === "company" || result.kind === "job" || result.recruiter;
  if (companyOwned || result.kind === "person" || result.kind === "talent" || result.kind === "post" || result.kind === "update") {
    const name = result.kind === "job" ? (result.companyName?.trim() || result.title) : result.title;
    return <span className={`search-result-mark${companyOwned ? " is-company" : ` is-${result.kind}`}`}><Avatar person={{ id: result.id, name, picture: result.picture }} /></span>;
  }
  return <span className="search-result-mark"><Icon name={result.kind === "project" ? "folder" : "message"} /></span>;
}
