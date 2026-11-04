"use client";
import { useSocialQuery } from "@/hooks/use-social-query";
import type { Role } from "@/types/domain";
import { FeedCard } from "./feed-card";
import { FeedSkeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { ErrorState } from "@/components/ui/state-views";
import { errorKind } from "@/lib/errors/error-state";

/** A shared entry is resolved independently of the current feed page/filter. */
export function PermalinkEntry({ id, role, highlighted = false, surface }: { id: string; role: Role; highlighted?: boolean; surface?: string }) {
  const query = useSocialQuery(["feed-entry",role,id],(s,scope)=>s.feed.getEntry(role,id,scope));
  const missing = query.isSuccess && !query.data || query.isError && ["notFound", "forbidden"].includes(errorKind(query.error));
  if (missing) return <StatePanel compact role="status" icon="compass" title="This post isn’t available" description="It may have been removed, or it’s no longer shared with you." />;
  if (query.isError) return <ErrorState compact error={query.error} title="This post couldn’t load" description="Something interrupted the request. Please try again." onRetry={() => void query.refetch()} />;
  return query.data ? <FeedCard entry={query.data} role={role} highlighted={highlighted} activity={query.data.viewer.own} surface={surface} /> : <FeedSkeleton />;
}
