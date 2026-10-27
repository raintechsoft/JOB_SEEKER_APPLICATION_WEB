"use client";
import type { Role } from "@/types/domain";
import { useServiceQuery } from "@/hooks/use-services";
import { FeedCard } from "./feed-card";
import { FeedSkeleton } from "@/components/ui/skeleton";

/** A shared entry is resolved independently of the current feed page/filter. */
export function PermalinkEntry({ id, role, highlighted = false, surface }: { id: string; role: Role; highlighted?: boolean; surface?: string }) {
  const query = useServiceQuery(["feed-entry",role,id],(s)=>s.feed.getEntry(role,id),{keepPreviousData:false});
  if (query.isError || query.isSuccess && !query.data) return <p role="status" className="card">This post is no longer available to this workspace.</p>;
  return query.data ? <FeedCard entry={query.data} role={role} highlighted={highlighted} activity={query.data.viewer.own} surface={surface} /> : <FeedSkeleton />;
}
