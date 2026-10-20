"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PostDraft, Project, Role } from "@/types/domain";
import type { PersonSummary } from "@/types/api";
import type { FeedEntry } from "@/services/feed/feed.service";
import { track } from "@/lib/analytics";
import { DevOnly } from "@/components/ui/dev-only";
import { devCopy } from "@/lib/env/app-env";
import { IMAGE_TYPES, MB, readImage } from "@/lib/utils/files";
import { safeVideoUrl } from "@/lib/utils/url";
import { useServiceAction, useServiceQuery, useServices } from "@/hooks/use-services";
import { toast } from "@/stores/toast-store";
import { useUiStore } from "@/stores/ui-store";
import { Icon } from "@/components/ui/icon";
import { Avatar, Button, LinkButton } from "@/components/ui/primitives";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { ScreenFallback } from "@/components/ui/feedback";
import { FeedCard } from "@/features/feed/feed-card";

const STEPS = ["Post details", "Media & project", "Review & publish"];
const STEP_COPY = ["Start with the story you want to share.", "Bring your story to life with media and a project.", "Take one last look before publishing."];

function previewEntry(d: PostDraft, identity: PersonSummary, projects: Project[]): FeedEntry {
  const image = d.media.find((m) => m.type === "image");
  const video = d.media.find((m) => m.type === "video");
  const project = projects.find((p) => p.id === d.project);
  return {
    id: d.id,
    type: "post",
    ownerId: identity.id,
    title: d.title.trim() || "Your post title",
    body: d.body.trim() || "Your story will appear here as you write. Add media to see how your post will look in the feed.",
    kind: d.media.length ? "Media post" : d.project ? "Project showcase" : "Professional update",
    createdAt: new Date().toISOString(),
    skills: [],
    media: "",
    image: image?.src || "",
    imageAlt: image?.alt || d.title,
    video: video?.src || "",
    attachments: d.media,
    project: project ? { id: project.id, title: project.title, art: project.art, cover: project.cover, visibility: project.visibility } : undefined,
    author: identity,
    likes: 0,
    comments: [],
    viewer: { liked: false, saved: false, following: false, own: true },
  };
}

function Editor({ role, initial, identity, projects }: { role: Role; initial: PostDraft; identity: PersonSummary; projects: Project[] }) {
  const run = useServiceAction();
  const services = useServices();
  const router = useRouter();
  const setFeed = useUiStore((s) => s.setFeed);
  const [d, setD] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState(devCopy("Your draft stays in this browser.", "Your draft is saved as you write."));
  const fileInput = useRef<HTMLInputElement>(null);
  const home = role === "recruiter" ? "/recruiter/dashboard" : "/app/dashboard";
  const publicProjects = projects.filter((p) => p.visibility === "Public");

  const persist = async (next: PostDraft) => {
    const ok = await services.jobPosts.storePostDraft(role, next);
    setSaveStatus(ok ? devCopy("Draft saved in this browser", "Draft saved") : "Draft is only kept on this page. Browser storage is full.");
    return ok;
  };
  const update = (patch: Partial<PostDraft>) => {
    const next = { ...d, ...patch };
    setD(next);
    void persist(next);
    return next;
  };
  const go = (n: number) => {
    if (busy) return toast("Wait for the media to finish loading.");
    if (n > d.reached || n < 0 || n > 2) return;
    setError("");
    update({ step: n });
    window.scrollTo(0, 0);
  };
  const appendVideo = (draft: PostDraft): PostDraft | null => {
    if (!draft.videoUrl.trim()) return draft;
    const src = safeVideoUrl(draft.videoUrl);
    if (!src) {
      setError("Use a direct HTTP or HTTPS MP4 or WebM video URL.");
      return null;
    }
    if (draft.media.length >= 5) {
      setError("You can add up to 5 media items.");
      return null;
    }
    return { ...draft, videoUrl: "", media: [...draft.media, { type: "video", src, alt: "Post video", name: "Video " + (draft.media.filter((m) => m.type === "video").length + 1) }] };
  };
  const addFiles = async (files: File[]) => {
    if (!files.length || busy) return;
    const total = d.media.filter((m) => m.type === "image").reduce((n, m) => n + (m.bytes || 0), 0) + files.reduce((n, f) => n + f.size, 0);
    if (files.length + d.media.length > 5 || total > 2 * MB || files.some((f) => f.size > MB || !IMAGE_TYPES.includes(f.type))) {
      setError("Add up to 5 media items. Images must be PNG, JPEG or WebP, up to 1 MB each and 2 MB total.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const items = await Promise.all(files.map(async (file) => ({ type: "image" as const, src: await readImage(file), alt: "", name: file.name, bytes: file.size })));
      const next = { ...d, media: [...d.media, ...items] };
      setD(next);
      if (!(await persist(next))) toast("Browser storage is full. Remove media or publish a smaller post.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The file could not be read.");
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    if (busy) return toast("Wait for the media to finish loading.");
    if (!d.title.trim() || !d.body.trim()) {
      setError("Add a post title and your story to continue.");
      return update({ step: 0 });
    }
    if (d.title.length > 150 || d.body.length > 3e3) {
      setError("Keep the title under 150 characters and the story under 3000 characters.");
      return update({ step: 0 });
    }
    let draft = d;
    if (draft.step === 1) {
      const withVideo = appendVideo(draft);
      if (!withVideo) return;
      draft = withVideo;
    }
    if (draft.step < 2) {
      setError("");
      update({ ...draft, step: draft.step + 1, reached: Math.max(draft.reached, draft.step + 1) });
      window.scrollTo(0, 0);
      return;
    }
    const result = await run((s) => s.feed.createPost(role, { title: draft.title, body: draft.body, project: draft.project, attachments: draft.media }));
    if (result === undefined) return;
    if (!result) return setError("Browser storage is full. Remove some media and try again.");
    track("post_published", { mediaCount: draft.media.length, hasProject: !!draft.project });
    setFeed({ filter: "all", sort: "recent", query: "" });
    router.push(home + "?post=" + encodeURIComponent(result.id));
    toast(devCopy("Your demo post is now in your feed.", "Your post is now in your feed."));
  };

  return (
    <div className="post-editor">
      <header className="job-wizard-top">
        <div>
          <span className="eyebrow">SHARE YOUR STORY</span>
          <h1>Create a post</h1>
        </div>
        <LinkButton href={home} icon="arrow">
          Back to feed
        </LinkButton>
      </header>
      <div className="post-editor-layout">
        <aside className="card job-wizard-stepper post-editor-stepper">
          <h2>Create a post</h2>
          <nav aria-label="Post creation steps">
            {STEPS.map((name, i) => (
              <button type="button" key={name} onClick={() => go(i)} className={d.step === i ? "active" : i < d.step ? "completed" : ""} disabled={i > d.reached} aria-current={i === d.step ? "step" : undefined}>
                <span>{i < d.step ? <Icon name="check" /> : i + 1}</span>
                <strong>{name}</strong>
              </button>
            ))}
          </nav>
          <div className="wizard-save-note">
            <Icon name="shield" />
            <p id="post-save-status">{saveStatus}</p>
          </div>
        </aside>
        <section className="card job-wizard-content post-editor-content">
          <div className="wizard-stage-heading">
            <span>
              STEP {d.step + 1} OF {STEPS.length}
            </span>
            <h2>{STEPS[d.step]}</h2>
            <p>{STEP_COPY[d.step]}</p>
          </div>
          <form
            id="post-editor-form"
            className="stack"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {error && (
              <p className="error post-editor-error" role="alert">
                {error}
              </p>
            )}
            {d.step === 0 && (
              <>
                <div className="row post-author">
                  <Avatar person={identity} size="lg" />
                  <div>
                    <strong>{identity.name}</strong>
                    <p className="small muted">{identity.headline}</p>
                  </div>
                </div>
                <TextField label="Post title" name="title" value={d.title} onChange={(e) => update({ title: e.target.value })} required maxLength={150} />
                <TextAreaField label="Your story" name="body" value={d.body} onChange={(e) => update({ body: e.target.value })} required maxLength={3000} rows={9} />
                <p className="small muted">Share a team update, a learning, or something you’re working on.</p>
              </>
            )}
            {d.step === 1 && (
              <>
                <div className="post-media-upload">
                  <div className="post-upload-heading">
                    <strong>Post media</strong>
                    <span>In selection order</span>
                  </div>
                  <input
                    ref={fileInput}
                    id="post-editor-files"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    hidden
                    onChange={(e) => {
                      void addFiles([...(e.target.files || [])]);
                      e.target.value = "";
                    }}
                  />
                  <ol className="post-media-grid" aria-label="Selected media in publishing order">
                    {d.media.map((m, i) => (
                      <li className="post-media-tile" title={m.name || "Video"} key={i}>
                        {m.type === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element -- selected media data URL
                          <img src={m.src} alt={m.alt || m.name || "Selected image"} />
                        ) : (
                          <span className="post-tile-video">
                            <Icon name="monitor" />
                            <small>Video</small>
                          </span>
                        )}
                        <span className="post-media-position" aria-label={"Position " + (i + 1)}>
                          {i + 1}
                        </span>
                        <button type="button" className="post-media-remove" aria-label={"Remove " + (m.name || "video")} title="Remove media" onClick={() => update({ media: d.media.filter((_, n) => n !== i) })}>
                          <Icon name="close" />
                        </button>
                      </li>
                    ))}
                    {d.media.length < 5 && (
                      <li className="post-media-add-tile">
                        <button type="button" aria-label="Add images from your computer" onClick={() => !busy && fileInput.current?.click()}>
                          <Icon name="plus" />
                          <span>{d.media.length ? "Add more" : "Add images"}</span>
                        </button>
                      </li>
                    )}
                  </ol>
                  <p className="post-upload-help">Up to 5 media items. PNG, JPEG or WebP, 1 MB per image and 2 MB total. New selections are added at the end.</p>
                  {d.media.length > 0 && (
                    <details className="post-media-descriptions">
                      <summary>
                        Media descriptions <span>(optional)</span>
                      </summary>
                      <div>
                        {d.media.map((m, i) => (
                          <TextField key={i} label={"Media " + (i + 1) + " description"} name={"mediaAlt" + i} value={m.alt || ""} maxLength={220} onChange={(e) => update({ media: d.media.map((x, n) => (n === i ? { ...x, alt: e.target.value } : x)) })} />
                        ))}
                      </div>
                    </details>
                  )}
                </div>
                <div className="post-video-add">
                  <TextField label="Direct video URL (optional)" name="videoUrl" type="url" value={d.videoUrl} onChange={(e) => update({ videoUrl: e.target.value })} />
                  <p className="small muted">Use a direct HTTPS MP4 or WebM link. You can combine images and video in the same post.</p>
                  <Button
                    icon="plus"
                    onClick={() => {
                      setError("");
                      const next = appendVideo(d);
                      if (next) update(next);
                    }}
                  >
                    Add video
                  </Button>
                </div>
                {role === "professional" && <SelectField label="Link a public project" name="project" value={d.project} onChange={(e) => update({ project: e.target.value })} options={[{ value: "", label: "No linked project" }, ...publicProjects.map((p) => ({ value: p.id, label: p.title }))]} />}
              </>
            )}
            {d.step === 2 && (
              <>
                <div className="post-review-summary">
                  <div>
                    <Icon name="check" />
                    <div>
                      <strong>Your story</strong>
                      <p>{d.title}</p>
                      <span>{d.body.length} / 3000 characters</span>
                    </div>
                    <Button variant="text sm" icon="edit" onClick={() => go(0)}>
                      Edit
                    </Button>
                  </div>
                  <div>
                    <Icon name="image" />
                    <div>
                      <strong>Media & project</strong>
                      <p>
                        {d.media.length ? d.media.length + " media item" + (d.media.length === 1 ? "" : "s") : "Text-only post"}
                        {d.project ? " · Project linked" : ""}
                      </p>
                      <span>Use the arrows in the preview to review every item.</span>
                    </div>
                    <Button variant="text sm" icon="edit" onClick={() => go(1)}>
                      Edit
                    </Button>
                  </div>
                </div>
                <DevOnly>
                  <p className="notice">Your post will appear in the public demo feed in this browser. It won’t be sent to an external social network.</p>
                </DevOnly>
              </>
            )}
          </form>
          <div className="post-editor-footer">
            {d.step ? (
              <Button icon="arrow" onClick={() => go(d.step - 1)}>
                Back
              </Button>
            ) : (
              <LinkButton href={home} variant="text">
                Cancel
              </LinkButton>
            )}
            <span />
            <Button
              variant="text sm"
              icon="file"
              onClick={async () => toast((await persist(d)) ? "Draft saved. Resume it from Create a post." : "Browser storage is full. Your draft is only kept on this page.")}
            >
              Save draft
            </Button>
            <button className="btn primary" form="post-editor-form" type="submit" disabled={busy}>
              <Icon name={d.step === 2 ? "send" : "arrow"} />
              {d.step === 2 ? devCopy("Publish demo post", "Publish post") : "Next"}
            </button>
          </div>
          <p className="small muted post-editor-footer-note">{busy ? "Adding your media…" : "Progress is saved as you write."}</p>
        </section>
        <aside className="post-preview-column" aria-label="Live post preview">
          <div className="post-preview-heading">
            <span>
              <Icon name="eye" />
              Live preview
            </span>
            <span>Only you can see this</span>
          </div>
          <div
            id="post-live-preview"
            onClickCapture={(e) => {
              if ((e.target as Element).closest("[data-carousel-control]")) return;
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <FeedCard entry={previewEntry(d, identity, projects)} role={role} noTracking />
          </div>
          <p className="post-preview-note">A quick look at your post in the feed. Browse every media item before publishing.</p>
        </aside>
      </div>
    </div>
  );
}

export function PostEditorScreen({ role }: { role: Role }) {
  const mode = useSearchParams().get("mode") || "post";
  const { data: draft } = useServiceQuery(["post-draft", role, mode], (s) => s.jobPosts.getPostDraft(role, mode));
  const { data: identity } = useServiceQuery(["feed", "identity", role], async (s) => (role === "recruiter" ? (await s.workspace.getRecruiterShell()).identity : (await s.workspace.getProfessionalShell()).person));
  const { data: projects } = useServiceQuery(["projects", "p0", "all"], (s) => s.work.listProjects({ ownerId: "p0" }));
  if (!draft || !identity || !projects) return <ScreenFallback />;
  // The editor seeds its local state once; later refetches of the stored draft do not reset it.
  return <Editor key={role} role={role} initial={draft} identity={identity} projects={projects} />;
}
