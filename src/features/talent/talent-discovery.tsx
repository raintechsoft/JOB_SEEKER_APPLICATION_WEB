"use client";

import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServiceQuery, useServices } from "@/hooks/use-services";
import { interestSkillsSchema, TALENT_DISCOVERY } from "@/lib/validation/talent-discovery";
import type { DiscoverySection, DiscoverySectionKey, PeopleSectionKey, TalentInterests } from "@/services/talent/talent.service";
import { ApiError, errorMessage } from "@/services/api/client";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { QueryFeedback } from "@/components/ui/query-view";
import { Button, LinkButton } from "@/components/ui/primitives";
import { TextField } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { SuggestionCardGrid, SuggestionCardsSkeleton } from "@/components/suggestions/suggestion-card";
import { TalentCard } from "@/components/talent/talent-card";

type Audience = "recruiter" | "professional";
const discoverPath = (role: Audience) => (role === "recruiter" ? "/recruiter/discover" : "/app/discover");
const seeAllHref = (s: DiscoverySection, role: Audience) => discoverPath(role) + "?section=" + s.key + (s.job ? "&job=" + s.job.id : "");

const EMPTY: Record<DiscoverySectionKey, string> = {
  jobMatches: "No strong matches yet. Profiles appear here when their skills overlap with this job.",
  peopleYouMayKnow: "Shortlist, message or receive applications from candidates to see similar people here.",
  interests: "Choose the skills you hire for and we’ll show people who have them.",
  suggestions: "No suggestions right now. Check back as more professionals update their profiles.",
  skills: "No one shares your profile skills yet. Add skills to your profile to find people like you.",
};

function Row({ section, interests, role }: { section: DiscoverySection; interests: TalentInterests; role: Audience }) {
  const editInterests = () => modal.show("Skills you’re interested in", <InterestsEditor initial={interests} />);
  const full = section.items.length >= TALENT_DISCOVERY.rowLimit;
  return (
    <section className="talent-discovery-row" aria-labelledby={"row-" + section.key + (section.job?.id ?? "")}>
      <header>
        <div>
          <h2 id={"row-" + section.key + (section.job?.id ?? "")}>{section.title}</h2>
          <p>{section.subtitle}</p>
        </div>
        <div className="row gap8">
          {section.key === "interests" && (
            <Button variant="text sm" icon="edit" onClick={editInterests}>
              Edit interests
            </Button>
          )}
          {full && (
            <LinkButton href={seeAllHref(section, role)} variant="text sm" icon="arrow">
              See all
            </LinkButton>
          )}
        </div>
      </header>
      <SuggestionCardGrid>
        {section.items.slice(0, TALENT_DISCOVERY.rowLimit).map((p) => <TalentCard key={p.id} person={p} role={role} />)}
      </SuggestionCardGrid>
    </section>
  );
}

/** Discovery rows (recruiter talent or job seeker people) shown when no search or filter is active. */
export function TalentDiscoveryRows({ role = "recruiter" }: { role?: Audience }) {
  const { data, isError, refetch } = useServiceQuery(["talent", "discovery", role], (s) => (role === "recruiter" ? s.talent.getDiscovery() : s.talent.getPeopleDiscovery()));
  if (!data) return isError ? <QueryFeedback data={data} error={isError} retry={refetch} layout="cards" label="Loading talent for you" /> : <SuggestionCardsSkeleton rows={2} headings label="Loading people for you" />;
  return (
    <>
      {/* Rows appear only when they have people; empty rows return once ranking fills them. */}
      {data.sections.filter((s) => s.items.length).map((s) => (
        <Row key={s.key + (s.job?.id ?? "")} section={s} interests={data.interests} role={role} />
      ))}
    </>
  );
}

/** "See all" for one discovery row. */
export function TalentDiscoverySection({ section, job, role = "recruiter" }: { section: DiscoverySectionKey; job?: string; role?: Audience }) {
  const { data, isError, refetch } = useServiceQuery(["talent", "discovery", role, section, job ?? ""], (s) => (role === "recruiter" ? s.talent.getDiscovery(section, job) : s.talent.getPeopleDiscovery(section as PeopleSectionKey)), { keepPreviousData: false });
  const current = data?.sections[0];
  return (
    <>
      <LinkButton href={discoverPath(role)} variant="text sm" icon="chevron">
        Back to discover
      </LinkButton>
      {!data ? (
        isError ? <QueryFeedback data={data} error={isError} retry={refetch} layout="cards" label="Loading profiles" /> : <SuggestionCardsSkeleton headings cards={12} label="Loading profiles" />
      ) : current ? (
        <section className="talent-discovery-row">
          <header>
            <div>
              <h2>{current.title}</h2>
              <p>{current.subtitle}</p>
            </div>
          </header>
          {current.items.length ? (
            <SuggestionCardGrid>
              {current.items.map((p) => <TalentCard key={p.id} person={p} role={role} />)}
            </SuggestionCardGrid>
          ) : (
            <div className="talent-discovery-empty">{EMPTY[current.key]}</div>
          )}
        </section>
      ) : (
        <div className="talent-discovery-empty">This list is no longer available. The job may have closed.</div>
      )}
    </>
  );
}

function InterestsEditor({ initial }: { initial: TalentInterests }) {
  const services = useServices();
  const cache = useQueryClient();
  const options = useServiceQuery(["talent", "filter-options"], (s) => s.talent.getFilterOptions());
  const [skills, setSkills] = useState(initial.skills);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const add = () => {
    const next = interestSkillsSchema.safeParse([...skills, draft.trim()]);
    if (!draft.trim()) return;
    if (!next.success) return setError(next.error.issues[0]?.message ?? "Check the skill.");
    setSkills(next.data);
    setDraft("");
    setError("");
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const parsed = interestSkillsSchema.safeParse(skills);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the skills.");
    setPending(true);
    try {
      await services.talent.saveInterests(parsed.data, initial.version);
      await cache.invalidateQueries({ queryKey: ["talent", "discovery"] });
      modal.close();
      toast("Interests saved.");
    } catch (e) {
      setError(e instanceof ApiError || !(e instanceof Error) ? errorMessage(e) : e.message);
    } finally {
      setPending(false);
    }
  };
  return (
    <form className="stack" onSubmit={save} noValidate>
      <p className="small muted">Choose up to {TALENT_DISCOVERY.interestSkillsMax} skills you hire for. Only you see these.</p>
      <div className="row gap8">
        <TextField
          label="Add a skill"
          name="interest-skill"
          value={draft}
          maxLength={TALENT_DISCOVERY.skillLength}
          list="talent-interest-skills"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          disabled={skills.length >= TALENT_DISCOVERY.interestSkillsMax}
        />
        <Button icon="plus" onClick={add} disabled={!draft.trim() || skills.length >= TALENT_DISCOVERY.interestSkillsMax}>
          Add
        </Button>
      </div>
      <datalist id="talent-interest-skills">
        {(options.data?.skills ?? []).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {skills.length ? (
        <div className="row wrap gap8" aria-label="Chosen skills">
          {skills.map((s) => (
            <button type="button" key={s} className="tag purple" aria-label={"Remove " + s} onClick={() => setSkills(skills.filter((x) => x !== s))}>
              {s} <Icon name="close" />
            </button>
          ))}
        </div>
      ) : (
        <p className="small muted">No skills chosen yet.</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row between">
        <Button variant="text" onClick={() => modal.close()} disabled={pending}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" disabled={pending} aria-busy={pending || undefined}>
          {pending ? "Saving…" : "Save interests"}
        </Button>
      </div>
    </form>
  );
}
