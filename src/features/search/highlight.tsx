import { normalizeSearch } from "@/lib/search/scopes";

/** Render plain React text/marks only; never trust database HTML or generate HTML snippets. */
export function SearchHighlight({ text, query }: { text: string; query: string }) {
  const words = normalizeSearch(query).split(" ").filter(Boolean).sort((a,b) => b.length-a.length);
  if (!words.length) return text;
  const pattern = words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return text.split(new RegExp(`(${pattern})`, "giu")).map((part, index) => index % 2 ? <mark key={index}>{part}</mark> : part);
}
