import { Avatar } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import type { SearchResult } from "@/services/search/search.service";

export function SearchResultMark({ result }: { result: SearchResult }) {
  if (["person", "talent", "company"].includes(result.kind)) return <span className={`search-result-mark is-${result.kind}`}><Avatar person={{ id: result.id, name: result.title, picture: result.picture }} /></span>;
  return <span className="search-result-mark"><Icon name={result.kind === "job" ? "briefcase" : result.kind === "update" ? "pulse" : result.kind === "project" ? "folder" : "message"} /></span>;
}
