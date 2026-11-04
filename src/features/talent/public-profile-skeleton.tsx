"use client";

import { CardSkeleton, LoadingRegion, Skeleton, TextSkeleton } from "@/components/ui/skeleton";

/** Stage 1 public profile header + tabs skeleton (job seeker and recruiter). */
export function PublicProfileLoadingSkeleton({ label = "Loading profile" }: { label?: string }) {
  return (
    <LoadingRegion label={label}>
      <header className="public-profile-hero">
        <div className="public-profile-cover">
          <Skeleton className="public-profile-skeleton-cover" />
        </div>
        <div className="public-profile-identity">
          <span className="public-profile-avatar">
            <Skeleton className="public-profile-skeleton-avatar" />
          </span>
          <div className="public-profile-meta">
            <Skeleton style={{ display: "block", width: "42%", height: 28 }} />
            <Skeleton style={{ display: "block", width: "28%", height: 16 }} />
            <Skeleton style={{ display: "block", width: "55%", height: 14 }} />
            <div className="public-profile-bio">
              <TextSkeleton lines={2} />
            </div>
            <div className="public-profile-actions" style={{ gap: 8 }}>
              <Skeleton style={{ width: 96, height: 34, borderRadius: 8 }} />
              <Skeleton style={{ width: 88, height: 34, borderRadius: 8 }} />
            </div>
          </div>
        </div>
      </header>
      <div className="public-profile-tabs">
        <div className="public-profile-skeleton-tabs" aria-hidden="true">
          {[72, 96, 88, 70, 78].map((width, i) => (
            <Skeleton key={i} style={{ width, height: 16, borderRadius: 4 }} />
          ))}
        </div>
        <div className="stack">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </LoadingRegion>
  );
}
