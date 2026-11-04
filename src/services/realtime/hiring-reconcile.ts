import type { Query, QueryClient } from "@tanstack/react-query";
import type { Signal } from "./signal";

const applicant = ["applications", "application", "application-drafts", "application-live", "application-review"];
const recruiter = ["responses", "review", "hiring-summary", "jobs-manager", "job-editor-live"];
const jobs = ["job", "job-opportunities", "job-recommendations", "application-live"];
const families = new Set([...applicant, ...recruiter, ...jobs]);
export function ownsHiringQuery(q: Query, user?: string, identity?: string) {
  return families.has(String(q.queryKey[0])) && q.queryKey[1] === (user ?? "guest") && q.queryKey[2] === (identity ?? "guest");
}

/** No timers fetch business data: the single short timer coalesces an actual change/resume. */
export function createHiringReconciler(cache: QueryClient, user?: string, identity?: string, visible = () => true) {
  const seen = new Set<string>(), dirty = new Set<string>(), running = new Set<string>();
  let disposed = false, timer: ReturnType<typeof setTimeout> | undefined;
  const owns = (q: Query) => ownsHiringQuery(q, user, identity);
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
  const mark = (targets: string[]) => {
    for (const q of cache.getQueryCache().findAll({ predicate: q => owns(q) && targets.includes(String(q.queryKey[0])) })) {
      q.invalidate(); if (q.isActive()) dirty.add(q.queryHash);
    }
    schedule();
  };
  return {
    receive(signal: Signal) {
      if (disposed || seen.has(signal.eventId)) return;
      seen.add(signal.eventId); if (seen.size > 1024) seen.delete(seen.values().next().value!);
      if (signal.type === "application.changed") mark([...applicant, ...jobs]);
      if (signal.type === "application-drafts.changed") mark(["application-drafts", "applications", "application-live", "application-review"]);
      if (signal.type === "job-tracker.changed") mark(["applications", ...jobs]);
      if (signal.type === "hiring.changed") mark(recruiter);
      if (signal.type === "public.changed" && signal.data.surface === "jobs") mark([...jobs, "applications"]);
    },
    resume: () => { if (!disposed) mark([...families]); },
    dispose: () => { disposed = true; clearTimeout(timer); dirty.clear(); seen.clear(); void cache.cancelQueries({ predicate: owns }); },
  };
}
