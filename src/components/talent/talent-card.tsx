"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { TalentSuggestion } from "@/services/talent/talent.service";
import { SuggestionCard } from "@/components/suggestions/suggestion-card";
import type { SuggestionCardAction } from "@/components/suggestions/suggestion-card-menu";
import { QuickMessage } from "@/components/talent/quick-message";
import { useShortlistDialogs } from "@/features/talent/dialogs";
import { useServiceAction } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import {useImpression} from "@/hooks/use-impression";
import {track} from "@/lib/analytics";
import { MatchBadge } from "@/components/jobs/match-badge";
import { useInteractionTracking } from "@/hooks/use-interaction-tracking";

/**
 * Person result in the shared suggestion-card style: name and designation only; Follow below and a
 * corner menu (recruiters: Save to shortlist and Message; job seekers: Message and View profile).
 */
export function TalentCard({ person: p, publicMode = false, role = "recruiter", action }: { person: TalentSuggestion; publicMode?: boolean; role?: "recruiter" | "professional"; action?: ReactNode }) {
  const shortlists = useShortlistDialogs();
  const router = useRouter();
  const run = useServiceAction();
  const target = publicMode ? "/professionals/" + p.slug : role === "professional" ? "/app/professionals/" + encodeURIComponent(p.slug) : "/recruiter/talent/" + p.id;
  const ref=useImpression<HTMLDivElement>(()=>{if(p.analyticsContext)track("recommendation_exposed",p.analyticsContext);},p.analyticsContext?.requestId);
  // Watch history: opening a suggested person is the talent surface's "open" outcome (M2).
  const { ref: watchRef, click: watchClick } = useInteractionTracking<HTMLDivElement>(publicMode ? null : { kind: "professional", id: p.id }, { surface: "talent", position: p.analyticsContext?.position, requestId: p.analyticsContext?.requestId });
  const setRef = (el: HTMLDivElement | null) => { ref.current = el; watchRef.current = el; };
  // Follow only where the list reports the current state, so the button never shows a guess.
  // The card owns the state after a toggle: suggestion lists exclude followed people, so the
  // list is not refetched here (only the network view); the card stays, reading "Following".
  const [known, setKnown] = useState({ source: p.following, value: p.following });
  if (known.source !== p.following) setKnown({ source: p.following, value: p.following });
  const following = known.value;
  const follow = !publicMode && !action && following !== undefined ? async () => {
    const next = await run((s) => s.feed.toggleFollow(role, p.id), { invalidate: ["network"] });
    if (next === undefined) return;
    setKnown({ source: p.following, value: next });
    track("person_followed", { personId: p.id, following: next });
    toast(next ? "You’re now following " + p.name + "." : "Unfollowed " + p.name + ".");
  } : undefined;
  const message: SuggestionCardAction = { label: "Send a message", icon: "message", onSelect: () => modal.show("Start a conversation", <QuickMessage candidateId={p.id} name={p.name} role={role} />) };
  const menu: SuggestionCardAction[] | undefined = publicMode ? undefined : role === "professional"
    ? [message, { label: "View profile", icon: "user", onSelect: () => router.push(target) }]
    : [{ label: p.saved ? "Manage saved lists" : "Save to shortlist", icon: "bookmark", onSelect: () => shortlists.choose(p.id) }, message];
  return (
    <div ref={setRef} className="talent-suggestion" onClickCapture={(e)=>{if((e.target as HTMLElement).closest("a")){if(p.analyticsContext)track("recommendation_clicked",p.analyticsContext);watchClick();}}}>
      <SuggestionCard
        href={target}
        name={p.name}
        headline={p.headline}
        person={p}
        coverUrl={p.cover || undefined}
        label={"View " + p.name + " profile"}
        following={!!following}
        onFollow={follow}
        action={action}
        menu={menu}
      />
      <MatchBadge match={p.match} showJob />
    </div>
  );
}
