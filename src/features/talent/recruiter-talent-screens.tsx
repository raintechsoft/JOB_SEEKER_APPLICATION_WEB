"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { ComparisonPerson } from "@/services/talent/talent.service";
import { formatShortDate } from "@/lib/utils/date";
import { useServiceAction, useServiceQuery } from "@/hooks/use-services";
import { toast } from "@/stores/toast-store";
import { useUiStore } from "@/stores/ui-store";
import { Icon, type IconName } from "@/components/ui/icon";
import { Avatar, Button, EmptyState, LinkButton, PageHeading, Tags } from "@/components/ui/primitives";
import { TalentCard } from "@/components/talent/talent-card";
import { useProjectDialogs } from "@/features/work/dialogs";
import { useCompareToggle, useContactCandidate, useShortlistDialogs } from "./dialogs";

export function StatCard({ label, value, description, icon }: { label: string; value: ReactNode; description: string; icon: IconName }) {
  return (
    <section className="card stat">
      <div className="stat-label">
        {label}
        <Icon name={icon} />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">
        <span>{description}</span>
      </div>
    </section>
  );
}

export function OverviewScreen() {
  const router = useRouter();
  const setMessaging = useUiStore((s) => s.setMessaging);
  const { data } = useServiceQuery(["talent", "overview"], (s) => s.talent.getOverview());
  return (
    <>
      <PageHeading
        title="Good people. Great possibilities."
        subtitle="Look beyond the resume. Find the thinking and craft behind the skills."
        actions={
          <LinkButton href="/recruiter/discover" variant="primary" icon="search">
            Discover talent
          </LinkButton>
        }
      />
      {data && (
        <>
          <div className="stats">
            <StatCard label="Talent to explore" value={data.talentCount} description="Fictional demo professionals" icon="users" />
            <StatCard label="Saved candidates" value={data.savedCandidates} description="Across your shortlists" icon="bookmark" />
            <StatCard label="Your shortlists" value={data.shortlists.length} description="Curated for your team" icon="folder" />
            <StatCard label="Conversations" value={data.conversationCount} description="Local demo messages" icon="message" />
          </div>
          <div className="card" style={{ background: "#eeecfa", marginBottom: 27 }}>
            <div className="row between wrap">
              <div>
                <span className="eyebrow">A DIFFERENT WAY TO DISCOVER</span>
                <h2 style={{ margin: "10px 0" }}>The right skills. The work to show it.</h2>
                <p className="small muted">Explore a candidate’s projects, process, and recorded professional activity.</p>
              </div>
              <LinkButton href="/recruiter/discover" icon="arrow">
                Start a search
              </LinkButton>
            </div>
          </div>
          <div className="section-head">
            <div>
              <h2 style={{ fontSize: 18 }}>People to get to know</h2>
              <p className="small muted" style={{ marginTop: 6 }}>
                A selection from our demo directory, ordered by recent recorded activity.
              </p>
            </div>
            <LinkButton href="/recruiter/discover" variant="text" icon="arrow">
              View all talent
            </LinkButton>
          </div>
          <div className="grid cols3">
            {data.recentTalent.map((p) => (
              <TalentCard key={p.id} person={p} />
            ))}
          </div>
          <div className="grid cols2" style={{ marginTop: 24 }}>
            <section className="card">
              <div className="card-head">
                <h2>Your shortlists</h2>
                <LinkButton href="/recruiter/shortlists" variant="text sm" icon="arrow">
                  Manage
                </LinkButton>
              </div>
              {data.shortlists.map((s) => (
                <Link key={s.id} href="/recruiter/shortlists" className="settings-row">
                  <span className="row">
                    <Icon name="folder" />
                    <strong style={{ fontSize: 12 }}>{s.name}</strong>
                  </span>
                  <span className="tag">{s.candidates.length} candidates</span>
                </Link>
              ))}
            </section>
            <section className="card">
              <div className="card-head">
                <h2>Recent conversations</h2>
                <LinkButton href="/recruiter/messages" variant="text sm" icon="arrow">
                  Open messages
                </LinkButton>
              </div>
              {data.conversations.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  style={{ width: "100%", textAlign: "left" }}
                  className="settings-row"
                  onClick={() => {
                    setMessaging({ conversation: c.id });
                    router.push("/recruiter/messages");
                  }}
                >
                  <Avatar person={c.person} />
                  <div className="grow">
                    <h3>{c.person.name}</h3>
                    <p>{c.lastMessage.slice(0, 60)}…</p>
                  </div>
                  <Icon name="chevron" />
                </button>
              ))}
            </section>
          </div>
        </>
      )}
    </>
  );
}

export function ShortlistsScreen() {
  const run = useServiceAction();
  const dialogs = useShortlistDialogs();
  const tab = useUiStore((s) => s.shortlistTab);
  const compared = useUiStore((s) => s.compared);
  const setUi = useUiStore((s) => s.setUi);
  const toggleCompare = useCompareToggle();
  const { data: lists } = useServiceQuery(["shortlists"], (s) => s.talent.listShortlists());
  const s = lists?.find((x) => x.id === tab) ?? lists?.[0];
  return (
    <>
      <PageHeading
        title="Good people, kept in mind."
        subtitle="Keep the talent you’d like to get to know a little better."
        actions={
          <>
            <Button variant="primary" icon="plus" onClick={() => dialogs.edit()}>
              New shortlist
            </Button>
            <LinkButton href="/recruiter/compare" icon="compare">
              Compare candidates
            </LinkButton>
          </>
        }
      />
      {lists && (
        <>
          <div className="tabs">
            {lists.map((x) => (
              <button type="button" key={x.id} onClick={() => setUi({ shortlistTab: x.id })} className={x.id === s?.id ? "active" : ""}>
                {x.name} <span className="tag">{x.candidates.length}</span>
              </button>
            ))}
          </div>
          {s ? (
            <>
              <div className="row between wrap" style={{ marginBottom: 20 }}>
                <p className="small muted">
                  {s.candidates.length} saved candidates in {s.name}
                </p>
                <div className="row">
                  <Button variant="text sm" icon="edit" onClick={() => dialogs.edit(s.id, s.name)}>
                    Rename
                  </Button>
                  <Button variant="text sm" icon="trash" onClick={() => dialogs.remove(s.id)}>
                    Delete list
                  </Button>
                </div>
              </div>
              <div className="grid cols3 talent-grid">
                {s.people.length ? (
                  s.people.map((p) => (
                    <div key={p.id}>
                      <TalentCard person={p} />
                      <div className="row between" style={{ padding: "12px 4px" }}>
                        <label className="check-row small">
                          <input type="checkbox" checked={compared.includes(p.id)} onChange={() => toggleCompare(p.id)} />
                          Compare
                        </label>
                        <Button
                          variant="text sm"
                          icon="close"
                          onClick={async () => {
                            const ok = await run((sv) => sv.talent.removeFromShortlist(s.id, p.id));
                            if (ok !== undefined) toast(ok ? "Candidate removed from shortlist." : "Saved for this page only. Browser storage is full or unavailable.");
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="A place for promising connections."
                    description="Explore the directory and save someone to this shortlist."
                    action={
                      <LinkButton href="/recruiter/discover" variant="primary" icon="search">
                        Discover talent
                      </LinkButton>
                    }
                  />
                )}
              </div>
            </>
          ) : (
            <EmptyState
              title="Start your first shortlist."
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
  const { data: people } = useServiceQuery(["talent", "compare", compared], (s) => s.talent.compare(compared));
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
    ["Profile completeness", (p) => p.complete + "% of demo profile fields"],
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
        subtitle="Explore the details side by side. No scores, just context."
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
      {people &&
        (people.length < 2 ? (
          <EmptyState
            title="Choose at least two people."
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
                        <Avatar person={p} size="lg" />
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
            <p className="notice" style={{ marginTop: 18 }}>
              Compare the available evidence. Activity records and profile completeness do not measure candidate quality or suitability.
            </p>
          </>
        ))}
    </>
  );
}
