"use client";

import { ScreenError, ScreenFallback } from "@/components/ui/feedback";
import { LoadingRegion, Skeleton, TextSkeleton } from "@/components/ui/skeleton";

import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from "react";
import { CareerJourney } from "@/features/journey/career-journey";
import { journeyEnabled } from "@/services/journey/journey.service";
import { ProfileActionsMenu } from "./profile-actions-menu";
import "./profile-search.css";
import "./profile-resume.css";
import "./profile-navigation.css";
import { ProfileSectionNavigation } from "./profile-section-navigation";
import { profileSectionById, rememberProfileSection, useProfileSection, useVisibleProfileSections, navigateToProfileSection, focusProfileSection } from "./profile-navigation";
import type { ProfileCollection, ProfileRecord } from "@/types/domain";
import type { ProfileSection, ProfileView } from "@/services/profile/profile.service";
import { ACCOMPLISHMENT_TYPES, type AccomplishmentType } from "@/lib/domain/profile";
import { formatLocaleDate, formatMonth } from "@/lib/utils/date";
import { downloadBlob } from "@/lib/utils/files";
import { safeUrl } from "@/lib/utils/url";
import { DevOnly } from "@/components/ui/dev-only";
import { devCopy } from "@/lib/env/app-env";
import { useServiceAction, useServiceQuery, useServices } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { Icon } from "@/components/ui/icon";
import { Avatar, Button, IconButton, Tags } from "@/components/ui/primitives";
import { TextField } from "@/components/ui/field";
import { confirmAction } from "@/components/ui/feedback";
import { QueryView } from "@/components/ui/query-view";
import { ProjectArt } from "@/components/work/project-art";
import { useProjectDialogs } from "@/features/work/dialogs";
import { collectionTitle, CompletionChecklist, CoverForm, PhotoForm, PreferenceEditor, RecordForm, SectionForm } from "./profile-forms";
import { MediaImage } from "@/components/ui/media-image";
import { validateMedia } from "@/lib/validation/profile";
import { useFormAction } from "@/hooks/use-form-action";
import { ProfileTimelineEntries, type PublicTimelineRecord } from "@/components/profile/profile-public-sections";

const ProfileSectionContext = createContext<string | null>(null);

const text = (v: unknown) => (v ? String(v) : "Not added");
const ADD_LABELS: Partial<Record<ProfileCollection, string>> = { employment: "employment", education: "education", languages: "language", careerBreaks: "career break" };
const recordName = (r: ProfileRecord) => String(r.title || r.name || r.degree || "entry");

function useProfileActions(view: ProfileView) {
  const run = useServiceAction();
  const services = useServices();
  return {
    record: (collection: ProfileCollection, record?: ProfileRecord) => modal.show((record ? "Edit " : "Add ") + collectionTitle(collection), <RecordForm collection={collection} record={record ?? null} details={view.details} projects={view.projects} />),
    section: (name: ProfileSection) =>
      modal.show("Edit " + { identity: "professional profile", headline: "resume headline", summary: "profile summary", career: "career preferences", personal: "personal details", diversity: "personal details" }[name], <SectionForm section={name} person={view.person} details={view.details} />),
    remove: async (collection: ProfileCollection, id: string) => {
      let journeyMessage = "";
      if (collection === "employment" && journeyEnabled) {
        try {
          const chapter = (await services.journey.get()).chapters.find(c=>c.id===id);
          journeyMessage = ` This also deletes ${chapter?.memoryCount??0} memories, their photos, and ${chapter?.colleagues?.length??0} private colleagues from this career chapter.`;
        } catch { toast("Could not check this workplace’s career memories. Try again.","error"); return; }
      }
      confirmAction("Remove this profile entry?", `This removes the saved entry${collection === "skills" ? " and its linked technical-skill details" : ""} from your profile${devCopy(" in this browser", "")}.${journeyMessage}`, async () => {
        const ok = await run(async (s) => { await s.profile.deleteRecord(collection, id, view.version, collection === "employment" && journeyEnabled); return true; });
        if (!ok) return;
        modal.close();
        toast("Profile entry removed.");
      }, "Remove entry");
    },
    move: (collection: ProfileCollection | "projects", id: string, offset: -1 | 1) => run((s) => s.profile.moveRecord(collection, id, offset, view.version)),
  };
}

function Controls({ collection, r, i, count, actions, reorder = true }: { collection: ProfileCollection; r: ProfileRecord; i: number; count: number; actions: ReturnType<typeof useProfileActions>; reorder?: boolean }) {
  const name = recordName(r);
  return (
    <div className="profile-entry-actions">
      {reorder && <IconButton icon="up" label={"Move " + name + " up"} disabled={i === 0} onClick={() => actions.move(collection, r.id, -1)} />}
      {reorder && <IconButton icon="down" label={"Move " + name + " down"} disabled={i === count - 1} onClick={() => actions.move(collection, r.id, 1)} />}
      <IconButton icon="edit" label={"Edit " + name} onClick={() => actions.record(collection, r)} />
      <IconButton icon="trash" label={"Delete " + name} onClick={() => actions.remove(collection, r.id)} />
    </div>
  );
}

/** File-type tile for a saved resume: red PDF, blue Word, grey for other text formats. */
function ResumeTypeIcon({ name, format }: { name: string; format?: string }) {
  const ext = (format || name.split(".").pop() || "").toLowerCase().replace(/^\./, "");
  const kind = ext.includes("pdf") ? "pdf" : ext.includes("doc") || ext.includes("word") ? "word" : "other";
  const label = kind === "pdf" ? "PDF" : kind === "word" ? "DOC" : ext.slice(0, 4).toUpperCase() || "FILE";
  return (
    <span className={`profile-document-icon resume-type-${kind}`} aria-label={kind === "pdf" ? "PDF document" : kind === "word" ? "Word document" : "Document"} role="img">
      <Icon name="file" />
      <b>{label}</b>
    </span>
  );
}

function Section({ id, title, children, action, hint }: { id: string; title: string; children: ReactNode; action?: ReactNode; hint?: string }) {
  const active=useContext(ProfileSectionContext);
  if(active!==null&&active!==id)return null;
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

function CredentialSection({
  id,
  title,
  records,
  actions,
}: {
  id: AccomplishmentType;
  title: string;
  records: ProfileRecord[];
  actions: ReturnType<typeof useProfileActions>;
}) {
  return (
    <Section
      id={id}
      title={title}
      action={
        <Button variant="text sm" icon="plus" onClick={() => actions.record(id)}>
          Add {title.toLowerCase()}
        </Button>
      }
    >
      {records.length ? (
        records.map((r, i) => (
          <div className="profile-accomplishment-record" key={r.id}>
            <div className="row between">
              <h3>{String(r.title)}</h3>
              <Controls collection={id} r={r} i={i} count={records.length} actions={actions} reorder={false} />
            </div>
            <p>{[r.issuer || r.publisher || r.event || r.authority || r.label, r.date || r.issue || r.filing, r.status].filter(Boolean).map(String).join(" · ")}</p>
            {r.description && <p>{String(r.description)}</p>}
            {safeUrl(String(r.url ?? "")) && (
              <a href={String(r.url)} target="_blank" rel="noopener noreferrer">
                {String(r.url)} <Icon name="external" />
              </a>
            )}
            <span className="profile-visibility">{r.public ? "Public professional information" : "Private · not in public views"}</span>
          </div>
        ))
      ) : (
        <p className="profile-empty">Add relevant {title.toLowerCase()} to your professional story.</p>
      )}
    </Section>
  );
}

function toTimelineRecord(r: ProfileRecord): PublicTimelineRecord {
  return {
    id: r.id,
    title: r.title ? String(r.title) : undefined,
    degree: r.degree ? String(r.degree) : undefined,
    company: r.company ? String(r.company) : undefined,
    institution: r.institution ? String(r.institution) : undefined,
    type: r.type ? String(r.type) : undefined,
    start: r.start ? String(r.start) : undefined,
    end: r.end ? String(r.end) : undefined,
    current: !!r.current,
    location: r.location ? String(r.location) : undefined,
    arrangement: r.arrangement ? String(r.arrangement) : undefined,
    field: r.field ? String(r.field) : undefined,
    description: r.description ? String(r.description) : undefined,
    responsibilities: r.responsibilities ? String(r.responsibilities) : undefined,
    achievements: r.achievements ? String(r.achievements) : undefined,
    coursework: r.coursework ? String(r.coursework) : undefined,
    grade: r.grade ? String(r.grade) : undefined,
    skills: r.skills ? String(r.skills) : undefined,
    companyLogo: r.companyLogo ? String(r.companyLogo) : null,
    projects: Array.isArray(r.projects) ? r.projects.map(String) : [],
    public: !!r.public,
  };
}

/** Experience/education entries — same layout as public profile, plus edit controls. */
function Entries({ collection, view, actions }: { collection: "employment" | "education"; view: ProfileView; actions: ReturnType<typeof useProfileActions> }) {
  const list = view.details[collection];
  return (
    <ProfileTimelineEntries
      collection={collection}
      records={list.map(toTimelineRecord)}
      projects={view.projects}
      showVisibility
      renderSide={(record, i, count) => {
        const source = list.find((r) => r.id === record.id) ?? list[i];
        return (
          <>
            {record.current ? <span className="profile-entry-present">Present</span> : null}
            <Controls collection={collection} r={source} i={i} count={count} actions={actions} reorder={false} />
          </>
        );
      }}
    />
  );
}

function SkillsSection({ view, actions }: { view: ProfileView; actions: ReturnType<typeof useProfileActions> }) {
  const run = useServiceAction();
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
      <div className="profile-skill-list">
        {list.length ? (
          list.map((s, i) => (
            <div className="profile-skill-record" key={s.id}>
              <div className="row wrap profile-skill-copy">
                <strong>{s.name}</strong>
                {s.featured && <span className="tag purple">Featured</span>}
                <span className="profile-hint">{[s.category, s.level, s.years ? s.years + " years" : ""].filter(Boolean).join(" · ")}</span>
              </div>
              <div className="row gap8 profile-skill-actions">
                <IconButton icon="star" label={(s.featured ? "Unfeature " : "Feature ") + s.name} extra={s.featured ? "saved" : ""} onClick={() => run((sv) => sv.profile.toggleFeaturedSkill(s.id))} />
                <Controls collection="skills" r={{ ...s }} i={i} count={list.length} actions={actions} reorder={false} />
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

function Profile({ view }: { view: ProfileView }) {
  const services = useServices();
  const run = useServiceAction();
  const actions = useProfileActions(view);
  const projects = useProjectDialogs();
  const active = useProfileSection();
  const visible = useVisibleProfileSections(active);
  const activeIndex = Math.max(0, visible.findIndex((section) => section.id === active));
  const selected = profileSectionById(active) ?? visible[activeIndex];
  const { person: p, details: d, completion: c } = view;

  useEffect(() => {
    rememberProfileSection(active);
  }, [active]);

  useEffect(() => {
    if(!window.location.hash.startsWith("#profile-"))return;
    const frame=requestAnimationFrame(focusProfileSection);
    return ()=>cancelAnimationFrame(frame);
  }, [active]);

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
  const [resumeDragging, setResumeDragging] = useState(false);
  const uploadResume = async (file?: File) => {
    if (!file || resumeAction.pending) return;
    const invalid = validateMedia(file, "resume");
    if (invalid) { setResumeStatus(invalid); return; }
    setResumeStatus(devCopy("Saving to this browser…", "Saving…"));
    const ok = await resumeAction.execute(async (s) => { const result = await s.profile.uploadResume(file, view.version); if (!result.ok) throw new Error(result.error); });
    if (!ok) return;
    setResumeStatus("");
    toast(devCopy("Resume saved in this browser. No server upload occurred.", "Resume saved."));
  };

  return (
    <div className="profile-management">
      <div className={"profile-cover profile-cover-owner" + (p.cover ? " has-image" : "")}>
        {p.cover && <MediaImage src={p.cover} alt="" fallback={null} />}
        <button type="button" className="profile-cover-edit" onClick={() => modal.show("Cover image", <CoverForm person={p} revision={view.version} />)}>
          <Icon name="camera" />
          {p.cover ? "Edit cover" : "Add cover image"}
        </button>
      </div>
      <header className="card professional-profile-summary" id="profile-identity">
        <ProfileActionsMenu previewHref={`/app/professionals/${p.slug}?preview=1`} onCopy={copyLink} onImprove={c.percent < 100 ? completion : undefined} onEdit={() => actions.section("identity")}/>
        <div className="profile-photo-area">
          <button type="button" className="profile-photo-ring" aria-label="View or edit profile photo" style={{ "--completion": c.percent * 3.6 + "deg" } as React.CSSProperties} onClick={() => modal.show("Profile photo", <PhotoForm person={p} revision={view.version} />, "photo")}>
            <Avatar person={p} size="xl" />
          </button>
          <button type="button" className="profile-photo-edit" aria-label="Change profile photo" onClick={() => modal.show("Profile photo", <PhotoForm person={p} revision={view.version} />, "photo")}>
            <Icon name="camera" />
          </button>
          <button type="button" className="profile-completion-link" onClick={completion}>
            {c.percent}% complete
          </button>
        </div>
        <div className="profile-header-body">
          <div className="row between wrap profile-header-top">
            <div>
              <h1>
                {p.name}
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
              {p.location?.trim() ? (
                <span>
                  <Icon name="location" />
                  {p.location}
                </span>
              ) : null}
              <span>
                <Icon name="briefcase" />
                {p.years} years · {d.employmentStatus}
              </span>
              <span>
                <Icon name="users" />
                {(p.followerCount ?? 0) === 1 ? "1 follower" : `${(p.followerCount ?? 0).toLocaleString()} followers`}
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
        </div>
      </header>
      <div className="profile-management-grid profile-editor-grid">
        <ProfileSectionNavigation active={active}/>
        <ProfileSectionContext.Provider value={active}>
        <div className="profile-main-sections profile-editor-panel" id="profile-section-panel" role="region" aria-label={`${selected.label} profile section`} tabIndex={-1}>
          <Section id="resume" title="Resume" action={<span className="resume-privacy"><Icon name="shield"/>Private document</span>}>
            
            {resume ? (
              <div className="profile-resume-record">
                <ResumeTypeIcon name={resume.name} format={resume.format} />
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
                  extra="resume-download"
                  onClick={async () => {
                    try {
                      const file = await services.profile.downloadResume();
                      if (file) downloadBlob(file.name, file.blob);
                      else toast("The file is unavailable. Please replace the resume.", "error");
                    } catch {
                      toast("The file is currently unavailable.", "error");
                    }
                  }}
                />
                <IconButton
                  icon="trash"
                  label="Remove resume"
                  extra="resume-remove"
                  onClick={() =>
                    confirmAction("Remove this resume?", devCopy("The resume file and its metadata will be removed from this browser.", "The resume file and its metadata will be removed from your profile."), async () => {
                      const result = await run((s) => s.profile.removeResume(view.version));
                      if (!result) return;
                      if (!result.ok) return toast(result.error, "error");
                      modal.close();
                      toast("Resume removed.");
                    }, "Remove resume")
                  }
                />
              </div>
            ) : null}
            <div className={`resume-upload-zone${resumeDragging ? " is-dragging" : ""}`} aria-busy={resumeAction.pending}
              onDragOver={e=>{e.preventDefault();if(!resumeAction.pending&&e.dataTransfer.types.includes("Files"))setResumeDragging(true);}}
              onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setResumeDragging(false);}}
              onDrop={e=>{e.preventDefault();setResumeDragging(false);if(resumeAction.pending)return;if(e.dataTransfer.files.length!==1){setResumeStatus("Choose one resume file at a time.");return;}void uploadResume(e.dataTransfer.files[0]);}}
            >
              <div className="resume-upload-main">
                <div className="resume-art" aria-hidden="true"><div className="resume-art-sheet"><Icon name="file"/><span>RESUME</span></div><span className="resume-art-upload"><Icon name="upload"/></span></div>
                <div className="resume-upload-copy"><h3>{resume ? "Keep your story up to date" : "Your experience, all in one place"}</h3><p>{resume ? "Drop a new file here to replace your saved resume." : "Drop your resume here, or choose a file to get started."}</p></div>
              <label className="btn primary resume-choose" aria-disabled={resumeAction.pending}>
                <input
                  type="file"
                  id="profile-resume-file"
                  disabled={resumeAction.pending}
                  accept=".pdf,.doc,.docx,.rtf"
                  className="sr-only"
                  aria-label={resume ? "Replace resume" : "Upload resume"}
                  aria-describedby="resume-file-guidance profile-resume-status"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    void uploadResume(file);
                  }}
                />
                <Icon name="upload" />
                {resumeAction.pending ? "Saving…" : resume ? "Replace resume" : "Upload resume"}
              </label>
              </div>
              <div className="resume-upload-footer" id="resume-file-guidance"><div className="resume-formats" aria-label="Accepted file formats"><span>PDF</span><span>DOC</span><span>DOCX</span><span>RTF</span></div><DevOnly><span className="resume-storage"><Icon name="shield"/>Saved in this browser</span></DevOnly></div>
            </div>
            <p className="resume-status" id="profile-resume-status" aria-live="polite">{resumeStatus}</p>
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
            <Fragment key={k}>
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
            {k === "employment" && active === "journey" && <CareerJourney onAddEmployment={()=>actions.record("employment")} onEditEmployment={id=>actions.record("employment",d.employment.find(e=>e.id===id))}/>}
            </Fragment>
          ))}
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
                      {safeUrl(pr.url) && (
                        <a className="btn text sm" href={pr.url} target="_blank" rel="noopener noreferrer">
                          <Icon name="external" />
                          Preview
                        </a>
                      )}
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
          {(Object.entries(ACCOMPLISHMENT_TYPES) as [AccomplishmentType, string][]).map(([key, label]) => (
            <CredentialSection key={key} id={key} title={label} records={d[key]} actions={actions} />
          ))}
          <Section
            id="career"
            title="Career profile"
           
          >
            <PreferenceEditor section="career" details={d} />
          </Section>
          <Section
            id="personal"
            title="Personal details"
          >
            <PreferenceEditor section="personal" details={d} />
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
            id="careerBreaks"
            title="Career breaks"
            hint="Optional, private by default. Sharing career-break context does not affect profile completion or ranking."
            action={
              <Button variant="text sm" icon="plus" onClick={() => actions.record("careerBreaks")}>
                Add career break
              </Button>
            }
          >
            {d.careerBreaks.length ? d.careerBreaks.map((r, i) => (
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
            )) : (
              <p className="profile-empty">Add a career break if you want to explain a gap in your work history.</p>
            )}
          </Section>
          <nav className="profile-editor-pagination" aria-label="Profile section pagination">
            {activeIndex>0&&<Button variant="text" className="profile-editor-previous" icon="arrow" onClick={()=>navigateToProfileSection(visible[activeIndex-1].id)}>{visible[activeIndex-1].label}</Button>}
            {activeIndex<visible.length-1&&<Button variant="text" onClick={()=>navigateToProfileSection(visible[activeIndex+1].id)}>{visible[activeIndex+1].label}<Icon name="arrow"/></Button>}
          </nav>
        </div>
        </ProfileSectionContext.Provider>
      </div>
      <DevOnly>
        <p className="profile-module-note">Skillora prototype · Your changes stay in this browser. Resume files use browser storage; no server upload or document extraction service is connected.</p>
      </DevOnly>
    </div>
  );
}

export function ProfileScreen() {
  const query = useServiceQuery(["profile"], (s) => s.profile.getProfile());
  if (query.data === undefined) return <ProfilePendingFrame error={query.isError} cause={query.error} retry={() => query.refetch()} />;
  return <QueryView query={query} fallback={null}>{(view) => <Profile view={view} />}</QueryView>;
}

/** Page frame (cover, section navigation, panel chrome) shown while the profile data loads or fails. */
function ProfilePendingFrame({ error, cause, retry }: { error: boolean; cause: unknown; retry: () => unknown }) {
  const active = useProfileSection();
  const visible = useVisibleProfileSections(active);
  const activeIndex = Math.max(0, visible.findIndex(section => section.id === active));
  const selected = profileSectionById(active) ?? visible[activeIndex];
  return (
    <div className="profile-management">
      <div className="profile-cover profile-cover-owner" aria-hidden="true" />
      <header className="card professional-profile-summary" id="profile-identity">
        {error ? <ScreenError error={cause} compact onRetry={() => void retry()} title="Your profile couldn’t load" /> : (
          <LoadingRegion label="Loading your profile" className="grow">
            <div className="skeleton-identity"><Skeleton className="skeleton-avatar" style={{ width: 96, height: 96 }} /><TextSkeleton lines={3} /></div>
          </LoadingRegion>
        )}
      </header>
      <div className="profile-management-grid profile-editor-grid">
        <ProfileSectionNavigation active={active} />
        <div className="profile-main-sections profile-editor-panel" id="profile-section-panel" role="region" aria-label={`${selected?.label ?? "Resume"} profile section`} tabIndex={-1}>
          <div className="profile-editor-panel-meta"><span>Profile / {selected?.label ?? "Resume"}</span><span>Section {activeIndex + 1} of {visible.length}</span></div>
          {!error && <ScreenFallback layout="form" label={`Loading ${(selected?.label ?? "profile").toLowerCase()}`} />}
        </div>
      </div>
    </div>
  );
}

