"use client";

import { useRouter } from "next/navigation";
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

/**
 * Person result in the shared suggestion-card style: name and designation only; Follow below and a
 * corner menu (recruiters: Save to shortlist and Message; job seekers: Message and View profile).
 */
export function TalentCard({ person: p, publicMode = false, role = "recruiter" }: { person: TalentSuggestion; publicMode?: boolean; role?: "recruiter" | "professional" }) {
  const shortlists = useShortlistDialogs();
  const router = useRouter();
  const run = useServiceAction();
  const target = publicMode ? "/professionals/" + p.slug : role === "professional" ? "/app/professionals/" + encodeURIComponent(p.slug) : "/recruiter/talent/" + p.id;
  const ref=useImpression<HTMLDivElement>(()=>{if(p.analyticsContext)track("recommendation_exposed",p.analyticsContext);},p.analyticsContext?.requestId);
  // Follow only where the list reports the current state, so the button never shows a guess.
  const follow = !publicMode && p.following !== undefined ? async () => {
    const next = await run((s) => s.feed.toggleFollow(role, p.id), { invalidate: ["talent", "network", "feed"] });
    if (next === undefined) return;
    track("person_followed", { personId: p.id, following: next });
    toast(next ? "You’re now following " + p.name + "." : "Unfollowed " + p.name + ".");
  } : undefined;
  const message: SuggestionCardAction = { label: "Send a message", icon: "message", onSelect: () => modal.show("Start a conversation", <QuickMessage candidateId={p.id} name={p.name} role={role} />) };
  const menu: SuggestionCardAction[] | undefined = publicMode ? undefined : role === "professional"
    ? [message, { label: "View profile", icon: "user", onSelect: () => router.push(target) }]
    : [{ label: p.saved ? "Manage saved lists" : "Save to shortlist", icon: "bookmark", onSelect: () => shortlists.choose(p.id) }, message];
  return (
    <div ref={ref} className="talent-suggestion" onClickCapture={(e)=>{if(p.analyticsContext&&(e.target as HTMLElement).closest("a"))track("recommendation_clicked",p.analyticsContext);}}>
      <SuggestionCard
        href={target}
        name={p.name}
        headline={p.headline}
        person={p}
        coverUrl={p.cover || undefined}
        label={"View " + p.name + " profile"}
        following={!!p.following}
        onFollow={follow}
        menu={menu}
      />
    </div>
  );
}
