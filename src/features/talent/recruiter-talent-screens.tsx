"use client";

import { InfoBadge } from "@/components/ui/info-badge";

import { QueryFeedback } from "@/components/ui/query-view";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

import Link from "next/link";
import { type ReactNode } from "react";
import type { ComparisonPerson } from "@/services/talent/talent.service";
import { formatShortDate } from "@/lib/utils/date";
import { devCopy } from "@/lib/env/app-env";
import { useServiceAction, useServiceQuery } from "@/hooks/use-services";
import { toast } from "@/stores/toast-store";
import { useUiStore } from "@/stores/ui-store";
import { Icon, type IconName } from "@/components/ui/icon";
import { Avatar, Button, EmptyState, LinkButton, PageHeading, Tags } from "@/components/ui/primitives";
import { ScrollableTabs } from "@/components/ui/scrollable-tabs";
import { SuggestionCardGrid } from "@/components/suggestions/suggestion-card";
import { TalentCard } from "@/components/talent/talent-card";
import { useProjectDialogs } from "@/features/work/dialogs";
import { COMPARE_CANDIDATES_ENABLED, RECRUITER_INVITES_ENABLED } from "@/lib/feature-flags";
import { useCompareToggle, useContactCandidate, useShortlistDialogs } from "./dialogs";

/** Matches Shortlists: tab row, list actions, then suggestion cards. */
function ShortlistsSkeleton() {
  return (
    <LoadingRegion label="Loading shortlists">
      <div className="scrollable-tabs" style={{ marginBottom: 18 }}>
        <div className="scrollable-tabs-list" style={{ gap: 8, paddingBottom: 12 }}>
          {[132, 156, 148, 140].map((width, i) => (
            <Skeleton key={i} style={{ width, height: 18, borderRadius: 6, flex: "0 0 auto" }} />
          ))}
        </div>
      </div>
      <div className="row between wrap" style={{ marginBottom: 20 }}>
        <Skeleton style={{ width: 180, height: 14, borderRadius: 6 }} />
        <div className="row" style={{ gap: 10 }}>
          <Skeleton style={{ width: 64, height: 14, borderRadius: 6 }} />
          <Skeleton style={{ width: 56, height: 14, borderRadius: 6 }} />
        </div>
      </div>
      <SuggestionCardGrid>
        {Array.from({ length: 8 }, (_, i) => (
          <div className="suggestion-card is-skeleton" key={i}>
            <span className="suggestion-card-main">
              <Skeleton className="suggestion-card-cover" />
              <span className="suggestion-card-photo">
                <Skeleton className="suggestion-skeleton-photo" />
              </span>
              <Skeleton className="suggestion-skeleton-line is-name" />
              <Skeleton className="suggestion-skeleton-line" />
            </span>
            <Skeleton className="suggestion-skeleton-action" />
          </div>
        ))}
      </SuggestionCardGrid>
    </LoadingRegion>
  );
}

export function StatCard({ label, value, description, icon, loading = false }: { label: string; value: ReactNode; description: string; icon: IconName; loading?: boolean }) {
  return (
    <section className="card stat" aria-busy={loading || undefined}>
      <div className="stat-label">
        {label}
        <Icon name={icon} />
      </div>
      <div className="stat-value">{loading ? <Skeleton style={{ width: 64, height: 36 }} /> : value}</div>
      <div className="stat-foot">
        <span>{description}</span>
      </div>
    </section>
  );
}

export function ShortlistsScreen() {
  const run = useServiceAction();
  const dialogs = useShortlistDialogs();
  const tab = useUiStore((s) => s.shortlistTab);
  const setUi = useUiStore((s) => s.setUi);
  const { data: lists, isError: listError, error: listCause, refetch: retryLists } = useServiceQuery(["shortlists"], (s) => s.talent.listShortlists());
  const s = lists?.find((x) => x.id === tab) ?? lists?.[0];
  return (
    <>
      <PageHeading
        title="Shortlist"
        subtitle=""
        actions={
          <>
            <Button variant="primary" icon="plus" onClick={() => dialogs.edit()}>
              New shortlist
            </Button>
            {COMPARE_CANDIDATES_ENABLED ? (
              <LinkButton href="/recruiter/compare" icon="compare">
                Compare candidates
              </LinkButton>
            ) : null}
          </>
        }
      />
      {lists === undefined && (listError ? <QueryFeedback data={lists} error={listError} cause={listCause} retry={retryLists} layout="cards" label="Loading shortlists" /> : <ShortlistsSkeleton />)}
      {lists && (
        <>
          <ScrollableTabs
            label="Shortlists"
            value={s?.id ?? lists[0]?.id ?? ""}
            onChange={(id) => setUi({ shortlistTab: id })}
            tabs={lists.map((x) => ({
              id: x.id,
              label: (
                <>
                  {x.name}
                  <span className="scrollable-tab-count">{x.candidates.length}</span>
                </>
              ),
            }))}
          />
          {s ? (
            <>
              <div className="row between wrap" style={{ marginBottom: 20 }}>
                <p className="small muted">
                  {s.candidates.length} saved candidates in {s.name}
                </p>
                <div className="row">
                  <Button variant="text sm" icon="edit" disabled={s.canEdit===false} onClick={() => dialogs.edit(s.id, s.name,s.version)}>
                    Rename
                  </Button>
                  {RECRUITER_INVITES_ENABLED && s.version ? (
                    <Button variant="text sm" icon="users" disabled={s.canEdit === false} onClick={() => dialogs.share(s)}>
                      Sharing
                    </Button>
                  ) : null}
                  <Button variant="text sm" icon="trash" disabled={s.canEdit===false} onClick={() => dialogs.remove(s.id)}>
                    Delete list
                  </Button>
                </div>
              </div>
              {s.people.length ? (
                <SuggestionCardGrid>
                  {s.people.map((p) => (
                    <TalentCard
                      key={p.id}
                      person={p}
                      action={
                        <Button
                          unstyled
                          type="button"
                          icon="close"
                          className="suggestion-card-follow"
                          disabled={s.canEdit === false}
                          onClick={async () => {
                            const ok = await run((sv) => sv.talent.removeFromShortlist(s.id, p.id));
                            if (ok !== undefined) toast(ok ? "Candidate removed from shortlist." : devCopy("Saved for this page only. Browser storage is full or unavailable.", "Candidate removed from shortlist."));
                          }}
                        >
                          Remove
                        </Button>
                      }
                    />
                  ))}
                </SuggestionCardGrid>
              ) : (
                <EmptyState
                  icon="bookmark"
                  title="A place for promising connections"
                  description="Explore the directory and save someone to this shortlist."
                  action={
                    <LinkButton href="/recruiter/discover" variant="primary" icon="search">
                      Discover talent
                    </LinkButton>
                  }
                />
              )}
            </>
          ) : (
            <EmptyState
              icon="folder"
              title="Start your first shortlist"
              description="A little organization for your next hire."
              action={
                <Button variant="primary" icon="plus" onClick={() => dialogs.edit()}>
                  Create shortlist
                </Button>
              }
            />
          )}
        </>
      )}
    </>
  );
}

export function CompareScreen() {
  const compared = useUiStore((s) => s.compared);
  const dialogs = useShortlistDialogs();
  const toggleCompare = useCompareToggle();
  const contact = useContactCandidate();
  const projects = useProjectDialogs();
  const { data: people, isError: peopleError, error: peopleCause, refetch: retryPeople } = useServiceQuery(["talent", "compare", compared], (s) => s.talent.compare(compared), { enabled: COMPARE_CANDIDATES_ENABLED });
  if (!COMPARE_CANDIDATES_ENABLED) {
    return (
      <EmptyState
        icon="compare"
        title="Comparison is unavailable"
        description="Candidate comparison is temporarily turned off."
        action={
          <LinkButton href="/recruiter/shortlists" variant="primary" icon="bookmark">
            Back to shortlists
          </LinkButton>
        }
      />
    );
  }
  const rows: [string, (p: ComparisonPerson) => ReactNode][] = [
    ["Location", (p) => p.location],
    [
      "Experience",
      (p) => (
        <>
          {p.years} years
          <br />
          <br />
          {p.experience}
        </>
      ),
    ],
    ["Skills", (p) => <Tags items={p.skills} />],
    [
      "Featured work",
      (p) =>
        p.featuredWork.length
          ? p.featuredWork.map((pr) => (
              <button type="button" key={pr.id} className="btn text sm" style={{ whiteSpace: "normal", textAlign: "left" }} onClick={() => projects.view(pr.id)}>
                {pr.title} <Icon name="arrowUp" />
              </button>
            ))
          : "No featured public work",
    ],
    [
      "Portfolio",
      (p) => (
        <LinkButton href={"/portfolio/" + p.portfolioSlug} variant="sm" icon="external">
          Open portfolio
        </LinkButton>
      ),
    ],
    ["Profile completeness", (p) => p.complete + devCopy("% of demo profile fields", "% of profile fields")],
    [
      "Recorded activity",
      (p) => (
        <>
          {p.publicUpdates} public updates
          <br />
          <br />
          Last recorded: {formatShortDate(p.lastActive)}
        </>
      ),
    ],
    [
      "Next step",
      (p) => (
        <Button variant="primary sm" icon="message" onClick={() => contact(p.id)}>
          Message
        </Button>
      ),
    ],
  ];
  return (
    <>
      <PageHeading
        title="A little more perspective."
        subtitle=""
        actions={
          <>
            <Button icon="users" onClick={dialogs.chooseCompare}>
              Choose candidates
            </Button>
            <LinkButton href="/recruiter/discover" variant="primary" icon="search">
              Discover more
            </LinkButton>
          </>
        }
      />
      <QueryFeedback data={people} error={peopleError} cause={peopleCause} retry={retryPeople} layout="table" label="Loading comparison" />
      {people &&
        (people.length < 2 ? (
          <EmptyState
            icon="compare"
            title="Choose at least two people"
            description="Select candidates from your shortlists or the directory."
            action={
              <Button variant="primary" icon="compare" onClick={dialogs.chooseCompare}>
                Choose candidates
              </Button>
            }
          />
        ) : (
          <>
            <div className="compare-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    {people.map((p) => (
                      <th key={p.id}>
                        <Link href={"/recruiter/talent/" + p.id} aria-label={"View " + p.name + " profile"}>
                          <Avatar person={p} size="lg" />
                        </Link>
                        <h3>
                          <Link href={"/recruiter/talent/" + p.id}>{p.name}</Link>
                        </h3>
                        <p className="small muted" style={{ margin: "7px 0 14px" }}>
                          {p.headline}
                        </p>
                        <Button variant="text sm" icon="close" onClick={() => toggleCompare(p.id)}>
                          Remove
                        </Button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, fn]) => (
                    <tr key={label}>
                      <td>{label}</td>
                      {people.map((p) => (
                        <td key={p.id}>{fn(p)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <InfoBadge label="Candidate comparison information" style={{ marginTop: 18 }}>
              Compare the available evidence. Activity records and profile completeness do not measure candidate quality or suitability.
            </InfoBadge>
          </>
        ))}
    </>
  );
}
