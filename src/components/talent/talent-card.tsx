"use client";

import Link from "next/link";
import type { TalentCardData } from "@/services/talent/talent.service";
import { Icon } from "@/components/ui/icon";
import { Avatar, Badge, IconButton, LinkButton, Tags } from "@/components/ui/primitives";
import { ProjectArt } from "@/components/work/project-art";
import { MiniPulse } from "@/components/work/pulse";
import { useProjectDialogs } from "@/features/work/dialogs";
import { useShortlistDialogs } from "@/features/talent/dialogs";
import {useImpression} from "@/hooks/use-impression";
import {track} from "@/lib/analytics";
import { MatchBadge } from "@/components/jobs/match-badge";
import { useInteractionTracking } from "@/hooks/use-interaction-tracking";

export function TalentCard({ person: p, publicMode = false }: { person: TalentCardData; publicMode?: boolean }) {
  const projects = useProjectDialogs();
  const shortlists = useShortlistDialogs();
  const target = publicMode ? "/professionals/" + p.slug : "/recruiter/talent/" + p.id;
  const proj = p.featuredProject;
  const ref=useImpression<HTMLElement>(()=>{if(p.analyticsContext)track("recommendation_exposed",p.analyticsContext);},p.analyticsContext?.requestId);
  // Watch history: opening a suggested person is the talent surface's "open" outcome (M2).
  const { ref: watchRef, click: watchClick } = useInteractionTracking<HTMLElement>(publicMode ? null : { kind: "professional", id: p.id }, { surface: "talent", position: p.analyticsContext?.position, requestId: p.analyticsContext?.requestId });
  const setRef = (el: HTMLElement | null) => { ref.current = el; watchRef.current = el; };
  return (
    <article ref={setRef} className="card talent-card" onClickCapture={(e)=>{if((e.target as HTMLElement).closest("a")){if(p.analyticsContext)track("recommendation_clicked",p.analyticsContext);watchClick();}}}>
      <div className="row between">
        <Link href={target} className="talent-avatar-link" aria-label={"View " + p.name + " profile"}>
          <Avatar person={p} size="lg" />
        </Link>
        <IconButton icon="bookmark" label={p.saved ? "Manage saved candidate" : "Save to shortlist"} extra={p.saved ? "saved" : ""} onClick={() => shortlists.choose(p.id)} />
      </div>
      <h3 className="talent-name">
        <Link href={target}>{p.name}</Link>
      </h3>
      <p className="headline">{p.headline}</p>
      {p.recommendationReason&&<p className="small muted">{p.recommendationReason}</p>}
      {!publicMode&&p.hiringMatch&&<p className="small muted talent-hiring-match">{p.hiringMatch.reason}</p>}
      {!publicMode&&p.pool&&<p className="small muted talent-pool">In your {p.pool.name} pool</p>}
      <MatchBadge match={p.match} showJob />
      <div className="meta">
        <span>
          <Icon name="location" /> {p.location}
        </span>
        <span>{p.years} years experience</span>
      </div>
      <Tags items={p.skills.slice(0, 3)} />
      <p className="summary">{p.summary}</p>
      {proj && (
        <button type="button" className="work-proof" style={{ width: "100%", textAlign: "left" }} onClick={() => projects.view(proj.id)}>
          <ProjectArt project={proj} />
          <span>{proj.title}</span>
          <Icon name="arrowUp" />
        </button>
      )}
      <MiniPulse recentDays={p.recentDays} />
      <div className="row between" style={{ borderTop: "1px solid var(--line)", paddingTop: 15 }}>
        <Badge tone={p.available ? "green" : "purple"}>{p.available ? "Open to opportunities" : "Open to connections"}</Badge>
        <LinkButton href={target} variant="text sm" icon="arrow">
          View profile
        </LinkButton>
      </div>
    </article>
  );
}
