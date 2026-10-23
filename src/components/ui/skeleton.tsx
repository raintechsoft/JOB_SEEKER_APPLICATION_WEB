import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils/text";

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={cn("skeleton", className)} style={style} />;
}

export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return <div className="skeleton-lines">{Array.from({ length: lines }, (_, i) => <Skeleton key={i} style={{ width: i === lines - 1 ? "65%" : "100%" }} />)}</div>;
}

export function AvatarSkeleton() { return <Skeleton className="skeleton-avatar" />; }

export function LoadingRegion({ label = "Loading content", children, className }: { label?: string; children: ReactNode; className?: string }) {
  return <div className={cn("loading-region", className)} role="status" aria-label={label} aria-busy="true"><span className="sr-only">{label}</span><div aria-hidden="true">{children}</div></div>;
}

export function CardSkeleton({ media = false }: { media?: boolean }) {
  return <div className="card loading-card">{media && <Skeleton className="skeleton-image" />}<div className="skeleton-identity"><AvatarSkeleton /><TextSkeleton lines={2} /></div><TextSkeleton /><Skeleton style={{ width: "35%", height: 24 }} /></div>;
}

export function FeedSkeleton() {
  return <LoadingRegion label="Loading posts"><div className="skeleton-stack">{[0, 1].map(i => <div className="card loading-card skeleton-feed-card" key={i}><div className="skeleton-identity"><AvatarSkeleton /><TextSkeleton lines={2} /></div><TextSkeleton /><Skeleton className="skeleton-feed-media" /><div className="skeleton-actions">{[0, 1, 2].map(n => <Skeleton key={n} style={{ width: 48, height: 18 }} />)}</div></div>)}</div></LoadingRegion>;
}

export function TableRowsSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return <>{Array.from({ length: rows }, (_, row) => <tr aria-hidden="true" className="skeleton-table-row" key={row}>{Array.from({ length: columns }, (_, col) => <td key={col}><Skeleton style={{ width: col === 0 ? "75%" : "60%" }} /></td>)}</tr>)}</>;
}

export type SkeletonLayout = "cards" | "list" | "profile" | "form" | "stats" | "chart" | "table";

export function ContentSkeleton({ layout = "list", label = "Loading content" }: { layout?: SkeletonLayout; label?: string }) {
  const content = layout === "cards" ? <div className="grid cols3 skeleton-card-grid">{[0, 1, 2].map(i => <CardSkeleton key={i} media />)}</div>
    : layout === "profile" ? <div className="skeleton-profile"><CardSkeleton /><div className="skeleton-stack"><CardSkeleton /><CardSkeleton /></div></div>
    : layout === "stats" ? <div className="stats">{[0, 1, 2, 3].map(i => <div className="card loading-card" key={i}><Skeleton style={{ width: "65%" }} /><Skeleton style={{ width: "40%", height: 36 }} /><Skeleton /></div>)}</div>
    : layout === "chart" ? <div className="card loading-card"><TextSkeleton lines={1} /><div className="skeleton-chart">{[45, 70, 55, 85, 65, 95, 75].map((h, i) => <Skeleton key={i} style={{ height: `${h}%` }} />)}</div></div>
    : layout === "form" ? <div className="card loading-card">{[0, 1, 2].map(i => <div className="skeleton-lines" key={i}><Skeleton style={{ width: "30%" }} /><Skeleton style={{ height: 46 }} /></div>)}<Skeleton style={{ width: 120, height: 38 }} /></div>
    : layout === "table" ? <div className="card loading-card">{[0, 1, 2, 3, 4].map(i => <div className="skeleton-table-line" key={i}><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div>)}</div>
    : <div className="skeleton-stack">{[0, 1, 2].map(i => <div className="card loading-card skeleton-list-item" key={i}><AvatarSkeleton /><TextSkeleton lines={2} /></div>)}</div>;
  return <LoadingRegion label={label}>{content}</LoadingRegion>;
}
