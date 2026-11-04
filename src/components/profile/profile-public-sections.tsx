"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Project } from "@/types/domain";
import type { PublicSkillRecord, PublicTimelineRecord } from "@/services/talent/public-profile";
import { formatMonth } from "@/lib/utils/date";
import { safeUrl } from "@/lib/utils/url";
import { MediaImage } from "@/components/ui/media-image";
import { Icon } from "@/components/ui/icon";
import { Button, Tags } from "@/components/ui/primitives";
import { ProjectArt } from "@/components/work/project-art";
import { useProjectDialogs } from "@/features/work/dialogs";
import "./profile-timeline.css";

export type { PublicSkillRecord, PublicTimelineRecord };

const text = (v: unknown) => (v ? String(v) : "Not added");
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "•";

/** "1 yr 3 mos" between two YYYY-MM months (inclusive of the start month); empty when unknown. */
function monthSpan(start?: string, end?: string) {
  const parse = (value?: string) => {
    const m = /^(\d{4})-(\d{2})/.exec(value ?? "");
    return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
  };
  const from = parse(start);
  const now = new Date();
  const to = end ? parse(end) : now.getFullYear() * 12 + now.getMonth();
  if (from === null || to === null || to < from) return "";
  const total = to - from + 1;
  const years = Math.floor(total / 12);
  const months = total % 12;
  return [
    years ? years + (years === 1 ? " yr" : " yrs") : "",
    months ? months + (months === 1 ? " mo" : " mos") : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function ExpandableText({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 2);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children]);
  return (
    <div className="profile-entry-expandable">
      <div ref={box} className={open ? "profile-entry-text is-open" : "profile-entry-text"}>
        {children}
      </div>
      {(overflows || open) && (
        <button
          type="button"
          className="profile-entry-more"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Show less" : "…see more"}
        </button>
      )}
    </div>
  );
}

export function ProfileSectionCard({
  title,
  children,
  action,
  empty,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  empty?: string;
}) {
  return (
    <section className="card profile-section-card">
      <div className="profile-card-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children ?? (empty ? <p className="profile-empty">{empty}</p> : null)}
    </section>
  );
}

/** Key-skills list matching the own-profile skill rows (read-only when no side actions). */
export function ProfileSkillList({
  skills,
  renderActions,
}: {
  skills: PublicSkillRecord[];
  renderActions?: (skill: PublicSkillRecord, index: number) => ReactNode;
}) {
  if (!skills.length) {
    return <p className="profile-empty">Add the skills that describe what you do.</p>;
  }
  return (
    <div className="profile-skill-list">
      {skills.map((s, i) => (
        <div className="profile-skill-record" key={s.id}>
          <div className="row wrap profile-skill-copy">
            <strong>{s.name}</strong>
            {s.featured ? <span className="tag purple">Featured</span> : null}
            <span className="profile-hint">
              {[s.category, s.level, s.years ? s.years + " years" : ""].filter(Boolean).join(" · ")}
            </span>
          </div>
          {renderActions ? <div className="row gap8 profile-skill-actions">{renderActions(s, i)}</div> : null}
        </div>
      ))}
    </div>
  );
}

/** Employment / education timeline matching the own-profile entries. */
export function ProfileTimelineEntries({
  collection,
  records,
  projects = [],
  renderSide,
  showVisibility = false,
}: {
  collection: "employment" | "education";
  records: PublicTimelineRecord[];
  projects?: Project[];
  /** Own-profile edit/delete controls (and Present badge). Omit on public read-only views. */
  renderSide?: (record: PublicTimelineRecord, index: number, count: number) => ReactNode;
  showVisibility?: boolean;
}) {
  const dialogs = useProjectDialogs();
  const list = [...records].sort(
    (a, b) =>
      Number(!!b.current) - Number(!!a.current) ||
      String(b.start || "").localeCompare(String(a.start || "")),
  );
  if (!list.length) {
    return (
      <div className="profile-empty">
        Add your {collection} to give your professional story a little more context.
      </div>
    );
  }
  return (
    <>
      {list.map((r, i) => {
        const org = text(r.company || r.institution);
        const skills = String(r.skills ?? "")
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean);
        const span = monthSpan(String(r.start || ""), r.current ? undefined : String(r.end || ""));
        const place = [r.location, r.arrangement]
          .map((value) => String(value ?? "").trim())
          .filter(Boolean)
          .join(" · ");
        const linked = (r.projects ?? [])
          .map((id) => projects.find((p) => p.id === id))
          .filter((p): p is Project => !!p);
        const side = renderSide
          ? renderSide(r, i, list.length)
          : r.current
            ? <span className="profile-entry-present">Present</span>
            : null;
        return (
          <article className="profile-entry profile-timeline-entry" key={r.id}>
            <span className="profile-entry-logo" aria-hidden="true">
              {r.companyLogo ? (
                <MediaImage src={String(r.companyLogo)} alt="" fallback={initialsOf(org)} />
              ) : (
                initialsOf(org)
              )}
            </span>
            <div className="profile-entry-main">
              <div className="profile-entry-head">
                <div className="profile-entry-lines">
                  <h3>{text(r.title || r.degree)}</h3>
                  <p className="profile-entry-subtitle">
                    {[org, r.type ? String(r.type) : ""].filter(Boolean).join(" · ")}
                  </p>
                  <p className="profile-entry-date">
                    {formatMonth(String(r.start || ""))} –{" "}
                    {r.current ? "Present" : formatMonth(String(r.end || ""))}
                    {span ? " · " + span : ""}
                  </p>
                  {place ? <p className="profile-entry-place">{place}</p> : null}
                  {r.field ? <p className="profile-entry-place">{String(r.field)}</p> : null}
                </div>
                {side ? <div className="profile-entry-side">{side}</div> : null}
              </div>
              {(r.description ||
                r.responsibilities ||
                r.achievements ||
                r.coursework ||
                r.grade) && (
                <ExpandableText>
                  {(
                    [
                      ["", r.description],
                      ["Responsibilities", r.responsibilities],
                      ["Achievements", r.achievements],
                      ["Coursework", r.coursework],
                      ["Grade", r.grade],
                    ] as const
                  )
                    .filter(([, body]) => body)
                    .map(([heading, body]) => (
                      <section className="profile-entry-block" key={heading || "description"}>
                        {heading ? <h4>{heading}</h4> : null}
                        <p className="profile-entry-description">{String(body)}</p>
                      </section>
                    ))}
                </ExpandableText>
              )}
              {!!skills.length && (
                <div className="profile-entry-skills">
                  <Icon name="badge" />
                  <ul aria-label="Skills used">
                    {skills.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!!linked.length && (
                <div className="row wrap profile-entry-projects">
                  {linked.map((p) => (
                    <Button key={p.id} variant="text sm" icon="folder" onClick={() => void dialogs.view(p.id)}>
                      {p.title}
                    </Button>
                  ))}
                </div>
              )}
              {showVisibility ? (
                <span className="profile-visibility">
                  <Icon name={r.public ? "globe" : "shield"} />
                  {r.public ? "Shown in public profile" : "Private record"}
                </span>
              ) : null}
            </div>
          </article>
        );
      })}
    </>
  );
}

/** Projects list matching the own-profile project records (read-only). */
export function ProfileProjectList({
  projects,
  renderActions,
}: {
  projects: Project[];
  renderActions?: (project: Project, index: number) => ReactNode;
}) {
  const dialogs = useProjectDialogs();
  if (!projects.length) {
    return <p className="profile-empty">Show what you do through the projects you’ve helped build.</p>;
  }
  return (
    <>
      {projects.map((pr, i) => (
        <article className="profile-project-record" key={pr.id}>
          <button
            type="button"
            className="profile-project-cover"
            onClick={() => void dialogs.view(pr.id)}
          >
            <ProjectArt project={pr} />
          </button>
          <div className="grow">
            <div className="row between wrap">
              <h3>{pr.title}</h3>
              {renderActions ? <div className="profile-entry-actions">{renderActions(pr, i)}</div> : null}
            </div>
            {pr.contribution ? <p>{pr.contribution}</p> : null}
            <p className="profile-entry-date">
              {formatMonth(pr.start)} — {formatMonth(pr.date)} · {pr.visibility}
            </p>
            {pr.description ? <p>{pr.description}</p> : null}
            <Tags items={pr.skills} />
            {safeUrl(pr.url) ? (
              <div className="profile-project-actions">
                <a className="btn text sm" href={pr.url} target="_blank" rel="noopener noreferrer">
                  <Icon name="external" />
                  Preview
                </a>
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </>
  );
}

/** @deprecated Prefer ProfileSkillList */
export const PublicSkillList = ProfileSkillList;
/** @deprecated Prefer ProfileTimelineEntries */
export const PublicTimelineEntries = ProfileTimelineEntries;
/** @deprecated Prefer ProfileProjectList */
export const PublicProjectList = ProfileProjectList;
