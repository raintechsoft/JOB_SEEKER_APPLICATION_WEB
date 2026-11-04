import type { Query, QueryClient } from "@tanstack/react-query";
import type { Signal } from "./signal";
import { ownsWorkspaceKey } from "./workspace-scope";

const publicTargets: Record<string, string[]> = {
  people: ["journey", "journey-memories", "candidate", "recruiter", "talent", "similar-people"],
  companies: ["organization", "company", "recruiter"],
  projects: ["project", "projects", "candidate", "portfolio"],
  updates: ["update", "updates", "portfolio"],
  portfolios: ["portfolio"],
};
const privateTargets: Record<string, string[]> = {
  "profile.changed": ["journey-following", "profile", "shell", "feed", "journey", "journey-memories", "portfolio", "candidate"],
  "organization.changed": ["organization", "company", "shell", "feed", "recruiter", "outreach-preview"],
  "work.changed": ["pulse", "projects", "project", "updates", "update", "portfolio", "profile", "journey", "journey-memories"],
  "portfolio.changed": ["portfolio"], "recruiting.changed": ["shortlists", "talent", "recommendations"],
  "settings.changed": ["settings", "personalization", "analytics-preference", "notification-preferences", "search-suggestions"],
  "network.changed": ["blocked-accounts", "talent", "shortlists", "candidate", "recruiter", "organization"],
  "export.changed": ["export-status"],
};
export function ownsWorkspaceQuery(q: Query, user?: string, identity?: string) {
  return ownsWorkspaceKey(q.queryKey, user, identity) || q.queryKey[0] === "public-browsing" && ["header","search"].includes(String(q.queryKey[1]));
}
function publicView(q: Query) {
  const key = q.queryKey;
  if (key[0] === "public-browsing") return true;
  return ["candidate", "recruiter", "talent", "similar-people", "project", "update", "workspace-search", "search-suggestions"].includes(String(key[0]))
    || ["pulse","journey","journey-memories"].includes(String(key[0])) && !["owner","me"].includes(String(key[1]))
    || key[0] === "organization" && key[1] === "public" || key[0] === "portfolio" && key[1] === "slug";
}
function searchList(q: Query) {
  return ["workspace-search", "search-suggestions"].includes(String(q.queryKey[0])) || q.queryKey[0] === "public-browsing" && ["header", "search"].includes(String(q.queryKey[1]));
}
function searchMatches(q: Query, surface: string) {
  const category = q.meta?.searchCategory;
  const categories: Record<string,string[]> = { feed:["posts"], people:["people","talent","skills"], companies:["companies"], jobs:["jobs"], projects:["projects"], updates:["updates"], portfolios:["portfolios"] };
  return category === "all" || categories[surface]?.includes(String(category));
}

/** Coalesced current-surface reads; no periodic network requests or blanket cache refresh. */
export function createWorkspaceReconciler(cache: QueryClient, user?: string, identity?: string, visible = () => true) {
  const seen = new Set<string>(), dirty = new Set<string>(), running = new Set<string>();
  let disposed = false, timer: ReturnType<typeof setTimeout> | undefined;
  const owns = (q: Query) => ownsWorkspaceQuery(q, user, identity);
  const schedule = () => { if (!timer && !disposed) timer = setTimeout(flush, 150); };
  function flush() {
    timer = undefined;
    if (disposed || !visible()) return;
    for (const hash of [...dirty]) {
      const q = cache.getQueryCache().get(hash);
      if (!q || !owns(q) || !q.isActive()) { dirty.delete(hash); continue; }
      if (running.has(hash)) continue;
      dirty.delete(hash); running.add(hash);
      const fetching = q.state.fetchStatus === "fetching";
      void cache.refetchQueries({ predicate: row => row.queryHash === hash, type: "active" }, { cancelRefetch: false }).finally(() => {
        running.delete(hash); if (disposed) return;
        if (fetching) dirty.add(hash);
        if (dirty.has(hash)) schedule();
      });
    }
  }
  const mark = (match: (q: Query) => boolean, conceal = false) => {
    for (const q of cache.getQueryCache().findAll({ predicate: q => owns(q) && match(q) })) {
      q.invalidate();
      // Search lists refetch in place so typed input, order and a selected result stay put; detail views are concealed.
      if (conceal && publicView(q) && !searchList(q)) {
        void cache.cancelQueries({ predicate: row => row.queryHash === q.queryHash }, { silent: true });
        q.setState({ data: undefined, status: "pending", error: null });
      }
      if (q.isActive()) dirty.add(q.queryHash);
    }
    schedule();
  };
  return {
    receive(signal: Signal) {
      if (disposed || seen.has(signal.eventId)) return;
      seen.add(signal.eventId); if (seen.size > 1024) seen.delete(seen.values().next().value!);
      const family = (q: Query) => String(q.queryKey[0]);
      const targets = privateTargets[signal.type];
      if (targets) mark(q => targets.includes(family(q)) && (signal.type !== "export.changed" || q.queryKey[1] === signal.data.exportId), signal.type === "network.changed");
      if (signal.type === "public.changed") {
        const surface = String(signal.data.surface);
        mark(q => publicTargets[surface]?.includes(family(q)) && publicView(q) || ["workspace-search","public-browsing"].includes(family(q)) && searchMatches(q, surface) || family(q) === "search-suggestions", signal.data.change === "availability");
      }
      if (signal.type === "administration.changed") {
        const sections: Record<string,string[]> = {accounts:["users","professionals"],verifications:["companies","verifications"],reports:["reports"],deliveries:["deliveries"],overview:[]};
        mark(q => family(q) === "admin" && (q.queryKey[1] === "overview" || sections[String(signal.data.section)]?.includes(String(q.queryKey[1]))));
      }
      if (signal.type === "portfolio-access.changed") mark(q => ["portfolio","project","projects","update","updates","pulse"].includes(family(q)), true);
    },
    // Focus/reconnect rechecks keep visible results (and a selected search result) in place while they refetch.
    resume: () => { if (!disposed) mark(() => true); },
    // Lost shared-portfolio access hides token-derived public views immediately instead of showing stale content.
    conceal: () => { if (!disposed) mark(q => ["portfolio","project","projects","update","updates","pulse"].includes(String(q.queryKey[0])), true); },
    dispose: () => { disposed = true; clearTimeout(timer); dirty.clear(); seen.clear(); void cache.cancelQueries({ predicate: owns }); },
  };
}
