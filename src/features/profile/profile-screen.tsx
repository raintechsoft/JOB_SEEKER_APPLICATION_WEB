"use client";

import { ScreenFallback } from "@/components/ui/feedback";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ProfileCollection, ProfileRecord } from "@/types/domain";
import type { ProfileSection, ProfileView } from "@/services/profile/profile.service";
import { ACCOMPLISHMENT_TYPES, type AccomplishmentType } from "@/lib/domain/profile";
import { formatLocaleDate, formatMonth } from "@/lib/utils/date";
import { downloadBlob } from "@/lib/utils/files";
import { DevOnly } from "@/components/ui/dev-only";
import { devCopy } from "@/lib/env/app-env";
import { useServiceAction, useServiceQuery, useServices } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Icon } from "@/components/ui/icon";
import { Avatar, Button, IconButton, LinkButton, Tags } from "@/components/ui/primitives";
import { FloatingInput, FloatingSelect, TextField } from "@/components/ui/field";
import { confirmAction } from "@/components/ui/feedback";
import { QueryView } from "@/components/ui/query-view";
import { ProjectArt } from "@/components/work/project-art";
import { useProjectDialogs } from "@/features/work/dialogs";
import { collectionTitle, CompletionChecklist, PhotoForm, RecordForm, SectionForm } from "./profile-forms";
import { validateMedia } from "@/lib/validation/profile";
import { useFormAction } from "@/hooks/use-form-action";

const SECTIONS: [string, string][] = [
  ["resume", "Resume"],
  ["headline", "Resume headline"],
  ["skills", "Key skills"],
  ["employment", "Employment"],
  ["education", "Education"],
  ["technical", "Technical skills"],
  ["projects", "Projects"],
  ["summary", "Profile summary"],
  ["accomplishments", "Accomplishments"],
  ["career", "Career profile"],
  ["personal", "Personal details"],
  ["languages", "Languages"],
  ["diversity", "Diversity & inclusion"],
];

const text = (v: unknown) => (v ? String(v) : "Not added");
const ADD_LABELS: Partial<Record<ProfileCollection, string>> = { employment: "employment", education: "education", technicalSkills: "technical skill", languages: "language", careerBreaks: "career break" };
const recordName = (r: ProfileRecord) => String(r.title || r.name || r.degree || "entry");

function useProfileActions(view: ProfileView) {
  const run = useServiceAction();
  return {
    record: (collection: ProfileCollection, record?: ProfileRecord) => modal.show((record ? "Edit " : "Add ") + collectionTitle(collection), <RecordForm collection={collection} record={record ?? null} details={view.details} projects={view.projects} />),
    section: (name: ProfileSection) =>
      modal.show("Edit " + { identity: "professional profile", headline: "resume headline", summary: "profile summary", career: "career preferences", personal: "personal details", diversity: "optional context" }[name], <SectionForm section={name} person={view.person} details={view.details} />),
    remove: (collection: ProfileCollection, id: string) =>
      confirmAction("Remove this profile entry?", `This removes the saved entry${collection === "skills" ? " and its linked technical-skill details" : ""} from your profile${devCopy(" in this browser", "")}.`, async () => {
        const ok = await run(async (s) => { await s.profile.deleteRecord(collection, id, view.version); return true; });
        if (!ok) return;
        modal.close();
        toast("Profile entry removed.");
      }, "Remove entry"),
    move: (collection: ProfileCollection | "projects", id: string, offset: -1 | 1) => run((s) => s.profile.moveRecord(collection, id, offset, view.version)),
  };
}

function Controls({ collection, r, i, count, actions }: { collection: ProfileCollection; r: ProfileRecord; i: number; count: number; actions: ReturnType<typeof useProfileActions> }) {
  const name = recordName(r);
  return (
    <div className="profile-entry-actions">
      <IconButton icon="up" label={"Move " + name + " up"} disabled={i === 0} onClick={() => actions.move(collection, r.id, -1)} />
      <IconButton icon="down" label={"Move " + name + " down"} disabled={i === count - 1} onClick={() => actions.move(collection, r.id, 1)} />
      <IconButton icon="edit" label={"Edit " + name} onClick={() => actions.record(collection, r)} />
      <IconButton icon="trash" label={"Delete " + name} onClick={() => actions.remove(collection, r.id)} />
    </div>
  );
}

function Section({ id, title, children, action, hint }: { id: string; title: string; children: ReactNode; action?: ReactNode; hint?: string }) {
  return (
    <section className="card profile-section-card" id={"profile-" + id}>
      <div className="profile-card-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {hint && <p className="profile-hint">{hint}</p>}
      {children}
    </section>
  );
}

function Entries({ collection, view, actions }: { collection: "employment" | "education"; view: ProfileView; actions: ReturnType<typeof useProfileActions> }) {
  const projects = useProjectDialogs();
  const list = view.details[collection];
  if (!list.length) return <div className="profile-empty">Add your {collection} to give your professional story a little more context.</div>;
  return (
    <>
      {list.map((r, i) => (
        <article className="profile-entry" key={r.id}>
          <div className="row between" style={{ alignItems: "flex-start" }}>
            <div className="grow">
              <h3>{text(r.title || r.degree)}</h3>
              <p className="profile-entry-subtitle">
                {text(r.company || r.institution)}
                {r.type ? " · " + r.type : ""}
              </p>
              <p className="profile-entry-date">
                {formatMonth(String(r.start || ""))} — {r.current ? "Present" : formatMonth(String(r.end || ""))}
                {r.current && (
                  <>
                    {" "}
                    <span className="tag green">Current</span>
                  </>
                )}
              </p>
            </div>
            <Controls collection={collection} r={r} i={i} count={list.length} actions={actions} />
          </div>
          {r.location && (
            <p className="profile-hint">
              {String(r.location)} · {String(r.arrangement || "")}
            </p>
          )}
          {r.field && <p>{String(r.field)}</p>}
          {r.description && <p className="profile-entry-description">{String(r.description)}</p>}
          {r.responsibilities && (
            <p>
              <strong>Responsibilities:</strong> {String(r.responsibilities)}
            </p>
          )}
          {r.achievements && (
            <p>
              <strong>Achievements:</strong> {String(r.achievements)}
            </p>
          )}
          {r.skills && (
            <Tags
              items={String(r.skills)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)}
            />
          )}
          {r.coursework && (
            <p>
              <strong>Coursework:</strong> {String(r.coursework)}
            </p>
          )}
          {r.grade && (
            <p>
              <strong>Grade:</strong> {String(r.grade)}
            </p>
          )}
          {!!r.projects?.length && (
            <div className="row wrap" style={{ marginTop: 9 }}>
              {r.projects
                .map((id) => view.projects.find((p) => p.id === id))
                .filter((p) => !!p)
                .map((p) => (
                  <Button key={p.id} variant="text sm" icon="folder" onClick={() => projects.view(p.id)}>
                    {p.title}
                  </Button>
                ))}
            </div>
          )}
          <span className="profile-visibility">
            <Icon name={r.public ? "globe" : "shield"} />
            {r.public ? "Shown in public profile" : "Private record"}
          </span>
        </article>
      ))}
    </>
  );
}

function Definitions({ obj, labels }: { obj: Record<string, unknown>; labels: Record<string, string> }) {
  return (
    <dl className="profile-definition-grid">
      {Object.entries(labels).map(([key, label]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>{text(obj[key])}</dd>
        </div>
      ))}
    </dl>
  );
}

function SkillsSection({ view, actions }: { view: ProfileView; actions: ReturnType<typeof useProfileActions> }) {
  const run = useServiceAction();
  const [q, setQ] = useState("");
  const list = view.details.skills;
  return (
    <Section
      id="skills"
      title="Key skills"
      action={
        <Button variant="text sm" icon="plus" onClick={() => actions.record("skills")}>
          Add skill
        </Button>
      }
    >
      <div className="profile-skill-tools">
        <label>
          <Icon name="search" />
          <FloatingInput label="Search key skills" id="profile-skill-search" type="search" placeholder="Find a skill..." aria-label="Search key skills" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="profile-skill-list">
        {list.length ? (
          list.map((s, i) => (
            <div className="profile-skill-record" key={s.id} hidden={!s.name.toLowerCase().includes(q.toLowerCase())}>
              <div className="row wrap">
                <strong>{s.name}</strong>
                {s.featured && <span className="tag purple">Featured</span>}
                <span className="profile-hint">{[s.category, s.level, s.years ? s.years + " years" : ""].filter(Boolean).join(" · ")}</span>
              </div>
              <div className="row gap8">
                <IconButton icon="star" label={(s.featured ? "Unfeature " : "Feature ") + s.name} extra={s.featured ? "saved" : ""} onClick={() => run((sv) => sv.profile.toggleFeaturedSkill(s.id))} />
                <Controls collection="skills" r={{ ...s }} i={i} count={list.length} actions={actions} />
              </div>
            </div>
          ))
        ) : (
          <p className="profile-empty">Add the skills that describe what you do.</p>
        )}
      </div>
    </Section>
  );
}

function TechnicalSection({ view, actions }: { view: ProfileView; actions: ReturnType<typeof useProfileActions> }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("name");
  const rows = useMemo(
    () =>
      [...view.details.technicalSkills]
        .filter((r) => String(r.name).toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => (sort === "experience" ? Number(b.years || 0) * 12 + Number(b.months || 0) - Number(a.years || 0) * 12 - Number(a.months || 0) : String(a.name).localeCompare(String(b.name)))),
    [view.details.technicalSkills, q, sort],
  );
  return (
    <Section
      id="technical"
      title="Technical skills"
      hint="Manual experience details, linked to your key skills. Years do not determine proficiency."
      action={
        <Button variant="text sm" icon="plus" onClick={() => actions.record("technicalSkills")}>
          Add technical skill
        </Button>
      }
    >
      <div className="profile-skill-tools">
        <label>
          <Icon name="search" />
          <FloatingInput label="Filter technical skills" id="profile-technical-search" type="search" aria-label="Filter technical skills" placeholder="Filter skills or technologies..." value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <FloatingSelect
          label="Sort technical skills"
          id="profile-technical-sort"
          aria-label="Sort technical skills"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          options={[
            { value: "name", label: "Skill name" },
            { value: "experience", label: "Experience" },
          ]}
        />
      </div>
      <div className="profile-table-wrap">
        <table className="profile-table">
          <thead>
            <tr>
              <th>Skill / technology</th>
              <th>Version</th>
              <th>Last used</th>
              <th>Experience</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="profile-technical-rows">
            {rows.length ? (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{String(r.name)}</td>
                  <td>{text(r.version)}</td>
                  <td>{r.lastUsed ? formatMonth(String(r.lastUsed)) : "Not specified"}</td>
                  <td>
                    {String(r.years || 0)} yr {String(r.months || 0)} mo
                  </td>
                  <td>
                    <IconButton icon="edit" label={"Edit " + r.name} onClick={() => actions.record("technicalSkills", r)} />
                    <IconButton icon="trash" label={"Remove " + r.name} onClick={() => actions.remove("technicalSkills", r.id)} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="profile-empty">
                  Add experience details for the tools and technologies you use.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Profile({ view }: { view: ProfileView }) {
  const services = useServices();
  const run = useServiceAction();
  const actions = useProfileActions(view);
  const projects = useProjectDialogs();
  const [active, setActive] = useState("");
  const { person: p, details: d, completion: c } = view;

  useEffect(() => {
    const cards = [...document.querySelectorAll<HTMLElement>(".profile-section-card")];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length) setActive(visible[0].target.id);
      },
      { rootMargin: "-130px 0px -50% 0px", threshold: 0 },
    );
    cards.forEach((card) => observer.observe(card));
    if (location.hash.startsWith("#profile-")) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
    return () => observer.disconnect();
  }, []);

  const copyLink = async () => {
    const url = window.location.origin + "/professionals/" + p.slug;
    try {
      await navigator.clipboard.writeText(url);
      toast(devCopy("Public profile link copied. Local edits stay in this browser.", "Public profile link copied."));
    } catch {
      modal.show("Your public profile link", <TextField label="Copy this link" name="copy" defaultValue={url} readOnly onClick={(e) => e.currentTarget.select()} />);
    }
  };
  const completion = () => modal.show("A stronger professional story.", <CompletionChecklist percent={c.percent} items={c.items} />);
  const resume = d.resume;
  const [resumeStatus, setResumeStatus] = useState("");
  const resumeAction = useFormAction((fields) => setResumeStatus(Object.values(fields).join(" ")));

  return (
    <div className="profile-management">
      <header className="card professional-profile-summary" id="profile-identity">
        <div className="profile-photo-area">
          <div className="profile-photo-ring" style={{ "--completion": c.percent * 3.6 + "deg" } as React.CSSProperties}>
            <Avatar person={p} size="xl" />
          </div>
          <button type="button" className="profile-photo-edit" aria-label="Change profile photo" onClick={() => modal.show("Your professional profile photo", <PhotoForm person={p} revision={view.version} />)}>
            <Icon name="edit" />
          </button>
          <button type="button" className="profile-completion-link" onClick={completion}>
            {c.percent}% complete
          </button>
        </div>
        <div className="profile-header-body">
          <div className="row between wrap">
            <div>
              <h1>
                {p.name} <IconButton icon="edit" label="Edit basic profile" onClick={() => actions.section("identity")} />
              </h1>
              <p className="profile-header-headline">{p.headline}</p>
              <p className="profile-header-company">
                {d.currentTitle || p.headline}
                {d.currentCompany ? " at " + d.currentCompany : ""}
              </p>
            </div>
            <span className="profile-last-updated">{d.updatedAt ? "Updated " + formatLocaleDate(d.updatedAt) : "Your saved professional profile"}</span>
          </div>
          <div className="profile-header-facts">
            <div>
              <span>
                <Icon name="location" />
                {p.location}
              </span>
              <span>
                <Icon name="briefcase" />
                {p.years} years · {d.employmentStatus}
              </span>
              <span>
                <Icon name="globe" />
                {p.public ? "Public profile enabled" : "Profile hidden"}
              </span>
            </div>
            <div>
              <span>
                <Icon name="mail" />
                {p.email} <small>{d.privacy.email ? "Public" : "Private"}</small>
              </span>
              <span>
                <Icon name="phone" />
                {d.phone || "Add phone number"} <small>{d.privacy.phone ? "Public" : "Private"}</small>
              </span>
              <span>
                <Icon name="clock" />
                {d.career.notice || "Availability not added"} <small>Private</small>
              </span>
            </div>
          </div>
          <div className="profile-header-actions">
            <LinkButton href={"/professionals/" + p.slug} variant="sm" icon="external">
              Preview public profile
            </LinkButton>
            <Button variant="sm" icon="copy" onClick={copyLink}>
              Copy profile link
            </Button>
            <Button variant="text sm" icon="spark" onClick={completion}>
              Improve profile
            </Button>
          </div>
        </div>
      </header>
      <div className="profile-management-grid">
        <aside className="profile-quick-links">
          <h2>Quick links</h2>
          <nav aria-label="Profile sections">
            {SECTIONS.map(([id, label]) => (
              <a
                key={id}
                href={"#profile-" + id}
                className={active === "profile-" + id ? "active" : undefined}
                aria-current={active === "profile-" + id ? "location" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("profile-" + id)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
                  history.replaceState(null, "", "#profile-" + id);
                  setActive("profile-" + id);
                }}
              >
                {label}
                {["employment", "education", "projects"].includes(id) && <span>Add</span>}
              </a>
            ))}
          </nav>
        </aside>
        <div className="profile-main-sections">
          <Section id="resume" title="Resume">
            {resume ? (
              <div className="profile-resume-record">
                <span className="profile-document-icon">
                  <Icon name="file" />
                </span>
                <div className="grow">
                  <h3>{resume.name}</h3>
                  <p>
                    {(resume.size / 1024).toFixed(0)} KB · {resume.format} · Added {formatLocaleDate(resume.uploadedAt)}
                  </p>
                  <DevOnly>
                    <span className="profile-visibility">Stored in this browser</span>
                  </DevOnly>
                </div>
                <IconButton
                  icon="download"
                  label="Download resume"
                  onClick={async () => {
                    try {
                      const file = await services.profile.downloadResume();
                      if (file) downloadBlob(file.name, file.blob);
                      else toast("The file is unavailable. Please replace the resume.");
                    } catch {
                      toast("The file is currently unavailable.");
                    }
                  }}
                />
                <IconButton
                  icon="trash"
                  label="Remove resume"
                  onClick={() =>
                    confirmAction("Remove this resume?", devCopy("The resume file and its metadata will be removed from this browser.", "The resume file and its metadata will be removed from your profile."), async () => {
                      const result = await run((s) => s.profile.removeResume(view.version));
                      if (!result) return;
                      if (!result.ok) return toast(result.error);
                      modal.close();
                      toast("Resume removed.");
                    }, "Remove resume")
                  }
                />
              </div>
            ) : (
              <p className="profile-hint">A concise starting point for your professional story.</p>
            )}
            <div className="profile-resume-upload">
              <label className="btn sm">
                <input
                  type="file"
                  id="profile-resume-file"
                  disabled={resumeAction.pending}
                  accept=".pdf,.doc,.docx,.rtf"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    const invalid = validateMedia(file, "resume");
                    if (invalid) { setResumeStatus(invalid); return; }
                    setResumeStatus(devCopy("Saving to this browser…", "Saving…"));
                    const ok = await resumeAction.execute(async (s) => { const result = await s.profile.uploadResume(file, view.version); if (!result.ok) throw new Error(result.error); });
                    if (!ok) return;
                    setResumeStatus("");
                    toast(devCopy("Resume saved in this browser. No server upload occurred.", "Resume saved."));
                  }}
                />
                <Icon name="upload" />
                {resume ? "Replace resume" : "Upload resume"}
              </label>
              <p>PDF, DOC, DOCX or RTF · Up to 2 MB · {devCopy("Browser storage only", "Private storage")}</p>
              <span id="profile-resume-status" aria-live="polite">
                {resumeStatus}
              </span>
            </div>
          </Section>
          <Section
            id="headline"
            title="Resume headline"
            action={
              <Button variant="text sm" icon="edit" onClick={() => actions.section("headline")}>
                Edit
              </Button>
            }
          >
            <p className="profile-body-copy">
              {p.headline}
              {d.focus ? " · " + d.focus : ""}
            </p>
          </Section>
          <SkillsSection view={view} actions={actions} />
          {(["employment", "education"] as const).map((k) => (
            <Section
              key={k}
              id={k}
              title={k === "employment" ? "Employment" : "Education"}
              action={
                <Button variant="text sm" icon="plus" onClick={() => actions.record(k)}>
                  Add {ADD_LABELS[k]}
                </Button>
              }
            >
              <Entries collection={k} view={view} actions={actions} />
            </Section>
          ))}
          <TechnicalSection view={view} actions={actions} />
          <Section
            id="projects"
            title="Projects"
            action={
              <Button variant="text sm" icon="plus" onClick={projects.create}>
                Add project
              </Button>
            }
          >
            {view.projects.length ? (
              view.projects.map((pr, i) => (
                <article className="profile-project-record" key={pr.id}>
                  <button type="button" className="profile-project-cover" onClick={() => projects.view(pr.id)}>
                    <ProjectArt project={pr} />
                  </button>
                  <div className="grow">
                    <div className="row between wrap">
                      <h3>{pr.title}</h3>
                      <div className="profile-entry-actions">
                        <IconButton icon="edit" label={"Edit " + pr.title} onClick={() => projects.edit(pr.id)} />
                        <IconButton icon="trash" label={"Delete " + pr.title} onClick={() => projects.remove(pr.id)} />
                      </div>
                    </div>
                    <p>{pr.contribution}</p>
                    <p className="profile-entry-date">
                      {formatMonth(pr.start)} — {formatMonth(pr.date)} · {pr.visibility}
                    </p>
                    <p>{pr.description}</p>
                    <Tags items={pr.skills} />
                    <div className="profile-project-actions">
                      <Button variant="text sm" icon="external" onClick={() => projects.view(pr.id)}>
                        Preview
                      </Button>
                      <Button variant="text sm" icon="star" onClick={() => run((s) => s.work.setProjectFeatured(pr.id, !pr.featured))}>
                        {pr.featured ? "Featured" : "Feature project"}
                      </Button>
                      {i > 0 && <IconButton icon="up" label="Move project up" onClick={() => actions.move("projects", pr.id, -1)} />}
                      {i < view.projects.length - 1 && <IconButton icon="down" label="Move project down" onClick={() => actions.move("projects", pr.id, 1)} />}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="profile-empty">Show what you do through the projects you’ve helped build.</p>
            )}
          </Section>
          <Section
            id="summary"
            title="Profile summary"
            action={
              <Button variant="text sm" icon="edit" onClick={() => actions.section("summary")}>
                Edit
              </Button>
            }
          >
            <p className="profile-body-copy">{p.summary || "Add a little about your professional background and what matters to you."}</p>
            {d.strengths && (
              <p className="profile-hint" style={{ marginTop: 12 }}>
                Strengths: {d.strengths}
              </p>
            )}
          </Section>
          <Section id="accomplishments" title="Accomplishments">
            {(Object.entries(ACCOMPLISHMENT_TYPES) as [AccomplishmentType, string][]).map(([key, label]) => (
              <details className="profile-accomplishment" open key={key}>
                <summary>
                  <span>
                    {label}
                    <small>{d[key].length}</small>
                  </span>
                  <Icon name="down" />
                </summary>
                <div className="profile-accomplishment-content">
                  {d[key].length ? (
                    d[key].map((r, i) => (
                      <div className="profile-accomplishment-record" key={r.id}>
                        <div className="row between">
                          <h3>{String(r.title)}</h3>
                          <Controls collection={key} r={r} i={i} count={d[key].length} actions={actions} />
                        </div>
                        <p>{[r.issuer || r.publisher || r.event || r.authority || r.label, r.date || r.issue || r.filing, r.status].filter(Boolean).map(String).join(" · ")}</p>
                        {r.description && <p>{String(r.description)}</p>}
                        {r.url && (
                          <a href={String(r.url)} target="_blank" rel="noopener">
                            {String(r.url)} <Icon name="external" />
                          </a>
                        )}
                        <span className="profile-visibility">{r.public ? "Public professional information" : "Private · not in public views"}</span>
                      </div>
                    ))
                  ) : (
                    <p className="profile-empty">Add relevant {label.toLowerCase()} to your professional story.</p>
                  )}
                  <Button variant="text sm" icon="plus" onClick={() => actions.record(key)}>
                    Add {label.toLowerCase()}
                  </Button>
                </div>
              </details>
            ))}
          </Section>
          <Section
            id="career"
            title="Career profile"
            hint="Preferences help you explore opportunities. Salary and notice details stay private. No automatic ranking is applied."
            action={
              <Button variant="text sm" icon="edit" onClick={() => actions.section("career")}>
                Edit
              </Button>
            }
          >
            <Definitions obj={{ ...d.career }} labels={{ industry: "Current industry", department: "Current department", category: "Role category", currentType: "Employment type", roles: "Preferred roles", industries: "Preferred industries", departments: "Preferred departments", types: "Preferred employment types", locations: "Preferred locations", arrangement: "Work arrangement", notice: "Availability / notice", salary: "Expected annual salary", currency: "Currency", interests: "Career interests" }} />
          </Section>
          <Section
            id="personal"
            title="Personal details"
            hint="Private account details. Not included in public profiles, portfolios, or talent search."
            action={
              <Button variant="text sm" icon="edit" onClick={() => actions.section("personal")}>
                Edit
              </Button>
            }
          >
            <Definitions obj={{ ...d.personal }} labels={{ gender: "Gender (optional)", dob: "Date of birth", marital: "Marital status", nationality: "Nationality / citizenship", permit: "Work authorization", address: "Address", city: "City", region: "State / region", country: "Country", postal: "Postal code", contact: "Preferred contact" }} />
          </Section>
          <Section
            id="languages"
            title="Languages"
            action={
              <Button variant="text sm" icon="plus" onClick={() => actions.record("languages")}>
                Add language
              </Button>
            }
          >
            <div className="profile-table-wrap">
              <table className="profile-table">
                <thead>
                  <tr>
                    <th>Language</th>
                    <th>Overall</th>
                    <th>Reading</th>
                    <th>Writing</th>
                    <th>Speaking</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {d.languages.length ? (
                    d.languages.map((r) => (
                      <tr key={r.id}>
                        <td>{String(r.name)}</td>
                        <td>{text(r.level)}</td>
                        <td>{text(r.reading)}</td>
                        <td>{text(r.writing)}</td>
                        <td>{text(r.speaking)}</td>
                        <td>
                          <IconButton icon="edit" label={"Edit " + r.name} onClick={() => actions.record("languages", r)} />
                          <IconButton icon="trash" label={"Delete " + r.name} onClick={() => actions.remove("languages", r.id)} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="profile-empty">
                        Add the languages you use and the proficiency details you know.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
          <Section
            id="diversity"
            title="Diversity & inclusion"
            hint="These optional details are private by default and never contribute to profile completion or candidate ranking."
            action={
              <Button variant="text sm" icon="edit" onClick={() => actions.section("diversity")}>
                Edit
              </Button>
            }
          >
            <p className="profile-body-copy">Optional context, shared on your terms.</p>
            <Definitions obj={{ ...d.diversity }} labels={{ accessibility: "Accessibility information", military: "Military service", context: "Additional context" }} />
            <hr className="divider" />
            <div className="profile-card-heading">
              <h3>Career breaks</h3>
              <Button variant="text sm" icon="plus" onClick={() => actions.record("careerBreaks")}>
                Add career break
              </Button>
            </div>
            {d.careerBreaks.map((r, i) => (
              <div className="profile-entry" key={r.id}>
                <div className="row between">
                  <h3>
                    {formatMonth(String(r.start || ""))} — {r.current ? "Ongoing" : formatMonth(String(r.end || ""))}
                  </h3>
                  <Controls collection="careerBreaks" r={r} i={i} count={d.careerBreaks.length} actions={actions} />
                </div>
                <p>{String(r.description || "No explanation added.")}</p>
                <span className="profile-visibility">{r.public ? "Public context (you opted in)" : "Private"}</span>
              </div>
            ))}
          </Section>
        </div>
      </div>
      <DevOnly>
        <p className="profile-module-note">Skillora prototype · Your changes stay in this browser. Resume files use browser storage; no server upload or document extraction service is connected.</p>
      </DevOnly>
    </div>
  );
}

export function ProfileScreen() {
  const query = useServiceQuery(["profile"], (s) => s.profile.getProfile());
  return <QueryView query={query} fallback={<ScreenFallback layout="profile" />}>{(view) => <Profile view={view} />}</QueryView>;
}

