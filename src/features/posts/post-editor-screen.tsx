"use client";

import { InfoBadge } from "@/components/ui/info-badge";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { postPublications } from "@/services/media/post-publication-manager";
import type { PostDraft, Project, Role } from "@/types/domain";
import type { PersonSummary } from "@/types/api";
import type { FeedEntry } from "@/services/feed/feed.service";
import { track } from "@/lib/analytics";
import { DevOnly } from "@/components/ui/dev-only";
import { devCopy } from "@/lib/env/app-env";
import { readAsDataUrl, readImage } from "@/lib/utils/files";
import { apiConfig } from "@/services/api/config";
import {
  postDraftValuesSchema,
  postMediaKind,
  postPublishSchema,
  postSelectionSchema,
  postTextSchema,
  validatePostFiles,
} from "@/lib/validation/social";
import { errorMessage } from "@/services/api/client";
import { useServiceQuery, useServices } from "@/hooks/use-services";
import { toast } from "@/stores/toast-store";
import { useUiStore } from "@/stores/ui-store";
import { Icon } from "@/components/ui/icon";
import { Avatar, Button, LinkButton } from "@/components/ui/primitives";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { ScreenError, ScreenFallback } from "@/components/ui/feedback";
import { FeedCard } from "@/features/feed/feed-card";
import { MediaImage } from "@/components/ui/media-image";
import {
  linkPreviewContract,
  type LinkPreview,
} from "@/lib/validation/link-preview";
import { useLinkPreview } from "./use-link-preview";
import { ComposerLinkPreview } from "./composer-link-preview";

const STEPS = ["Post details", "Media & project", "Review & publish"];

function previewEntry(
  d: PostDraft,
  identity: PersonSummary,
  projects: Project[],
  linkPreview?: LinkPreview,
): FeedEntry {
  const image = d.media.find((m) => m.type === "image");
  const video = d.media.find((m) => m.type === "video");
  const project = projects.find((p) => p.id === d.project);
  return {
    id: d.id,
    type: "post",
    ownerId: identity.id,
    title: d.title.trim() || "Your post title",
    body:
      d.body.trim() ||
      "Your story will appear here as you write. Add media to see how your post will look in the feed.",
    kind: d.media.length
      ? "Media post"
      : d.project
        ? "Project showcase"
        : "Professional update",
    createdAt: new Date().toISOString(),
    skills: [],
    media: "",
    image: image?.src || "",
    imageAlt: image?.alt || d.title,
    video: video?.src || "",
    attachments: d.media,
    project: project
      ? {
          id: project.id,
          title: project.title,
          art: project.art,
          cover: project.cover,
          visibility: project.visibility,
        }
      : undefined,
    author: identity,
    linkPreview,
    likes: 0,
    commentCount: 0,
    comments: [],
    viewer: {
      liked: false,
      saved: false,
      following: false,
      own: true,
      canRepost: false,
      reposted: false,
    },
  };
}

function Editor({
  role,
  initial,
  identity,
  projects,
  projectsLoading = false,
}: {
  role: Role;
  initial: PostDraft;
  identity: PersonSummary;
  projects: Project[];
  projectsLoading?: boolean;
}) {
  const cache = useQueryClient();
  const services = useServices();
  const router = useRouter();
  const setFeed = useUiStore((s) => s.setFeed);
  const [d, setD] = useState(initial);
  const latestDraft = useRef(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const publishing = useRef(false);
  const previewsTransferred = useRef(false);
  const [creationKey] = useState(() => crypto.randomUUID());
  const [saveStatus, setSaveStatus] = useState(
    devCopy(
      "Your draft stays in this browser.",
      "Your draft is saved as you write.",
    ),
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const bodyField = useRef<HTMLTextAreaElement>(null);
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>(
    {},
  );
  const previewUrls = useRef<Record<string, string>>({});
  const selectedFiles = useRef(new Map<string, File>());
  const mounted = useRef(false);
  const home = role === "recruiter" ? "/recruiter/dashboard" : "/app/dashboard";
  const publicProjects = projects.filter((p) => p.visibility === "Public");

  const real = apiConfig.dataSource === "http";
  const persist = useCallback(
    async (next: PostDraft) => {
      if (real) {
        const parsed = postDraftValuesSchema.safeParse({
          ...next,
          media: next.media.filter((item) => !item.src.startsWith("blob:")),
        });
        if (!parsed.success) {
          setSaveStatus("Draft needs attention before it can be saved.");
          setError(parsed.error.issues[0].message);
          return false;
        }
      }
      try {
        if (latestDraft.current === next) setSaveStatus("Saving draft…");
        const persistable = real
          ? {
              ...next,
              media: next.media.filter((item) => !item.src.startsWith("blob:")),
            }
          : next;
        const ok = await services.jobPosts.storePostDraft(role, persistable);
        Object.assign(next, { version: persistable.version });
        if (latestDraft.current === next)
          setSaveStatus(
            ok
              ? devCopy("Draft saved in this browser", "Draft saved")
              : "Draft is only kept on this page. Browser storage is full.",
          );
        return ok;
      } catch (e) {
        setSaveStatus(
          "Draft could not be saved. Your changes are kept on this page.",
        );
        setError(errorMessage(e));
        return false;
      }
    },
    [real, role, services],
  );
  useEffect(() => {
    if (!real || publishing.current) return;
    const timer = window.setTimeout(() => {
      if (!publishing.current) void persist(d);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [d, persist, real]);
  useEffect(() => {
    mounted.current = true;
    const urls = previewUrls.current;
    return () => {
      mounted.current = false;
      if (!previewsTransferred.current)
        for (const url of Object.values(urls)) URL.revokeObjectURL(url);
    };
  }, []);
  const update = (patch: Partial<PostDraft>) => {
    const next = { ...d, ...patch };
    latestDraft.current = next;
    if (real) setSaveStatus("Unsaved changes");
    setD(next);
    if (!real) void persist(next);
    return next;
  };
  const link = useLinkPreview({
    role,
    text: d.body,
    dismissed: d.previewDismissedUrls ?? [],
    onDismiss: (key) =>
      update({
        previewDismissedUrls: [
          ...(d.previewDismissedUrls ?? []).filter((k) => k !== key),
          key,
        ].slice(-linkPreviewContract.dismissedMax),
      }),
  });
  const go = (n: number) => {
    if (busy) return toast("Wait for the media to finish loading.");
    if (n > d.reached || n < 0 || n > 2) return;
    if (n > d.step) {
      const text = postTextSchema.safeParse(d);
      if (!text.success) {
        setError(text.error.issues[0].message);
        return;
      }
      if (n === 2) {
        const parsed = postSelectionSchema.safeParse({
          ...d,
          attachments: d.media,
        });
        if (!parsed.success) {
          setError(parsed.error.issues[0].message);
          return;
        }
      }
    }
    setError("");
    update({ step: n });
    window.scrollTo(0, 0);
  };
  const addFiles = async (files: File[]) => {
    if (!files.length || busy) return;
    const validation = validatePostFiles(files, d.media);
    if (validation) {
      setError(validation);
      return;
    }
    if (real) {
      const items = files.map((file) => {
        const src = URL.createObjectURL(file);
        selectedFiles.current.set(src, file);
        previewUrls.current[src] = src;
        return {
          type: postMediaKind(file),
          src,
          alt: "",
          name: file.name,
          bytes: file.size,
        };
      });
      setLocalPreviews({ ...previewUrls.current });
      update({ media: [...d.media, ...items] });
      setError("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const items = await Promise.all(
        files.map(async (file) => {
          const type = postMediaKind(file);
          const src =
            type === "image"
              ? await readImage(file)
              : await readAsDataUrl(file);
          return { type, src, alt: "", name: file.name, bytes: file.size };
        }),
      );
      if (!mounted.current) return;
      if (real) {
        items.forEach((item, index) => {
          if (previewUrls.current[item.src])
            URL.revokeObjectURL(previewUrls.current[item.src]);
          previewUrls.current[item.src] = URL.createObjectURL(files[index]);
        });
        setLocalPreviews({ ...previewUrls.current });
      }
      const next = { ...d, media: [...d.media, ...items] };
      latestDraft.current = next;
      setD(next);
      if (!(await persist(next)))
        setError(
          "Your files are kept on this page. Retry saving the draft before leaving.",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "The file could not be read.");
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    if (busy || publishing.current) return;
    const details = postTextSchema.safeParse(d);
    if (!details.success) {
      setError(details.error.issues[0].message);
      return;
    }
    if (d.step < 2) {
      if (d.step === 1) {
        const result = postSelectionSchema.safeParse({
          ...d,
          attachments: d.media,
        });
        if (!result.success) {
          setError(result.error.issues[0].message);
          return;
        }
      }
      setError("");
      update({ step: d.step + 1, reached: Math.max(d.reached, d.step + 1) });
      window.scrollTo(0, 0);
      return;
    }
    const parsed = postSelectionSchema.safeParse({
      ...d,
      attachments: d.media,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (
      d.media.some(
        (item) =>
          item.src.startsWith("blob:") && !selectedFiles.current.has(item.src),
      )
    ) {
      setError("Reselect the local files before publishing.");
      return;
    }
    if (
      postPublications
        .getSnapshot()
        .some((task) => task.draftId === d.id && task.state !== "cancelled")
    ) {
      setError(
        "This post already has a background upload. Follow its progress or retry it there.",
      );
      return;
    }
    publishing.current = true;
    setBusy(true);
    setError("");
    const frozen: PostDraft = {
      ...d,
      media: d.media.map((item) => ({ ...item })),
    };
    // Only the link is sent; Laravel references its own stored metadata and never waits on a fetch.
    const previewUrl = link.submitUrl;
    const files = new Map(selectedFiles.current);
    const urls = Object.values(previewUrls.current);
    const uploaded = new Map<string, string>();
    let stored: PostDraft | undefined;
    let savedText = false;
    previewsTransferred.current = true;
    postPublications.start(
      d.id,
      d.title.trim() || "Your post",
      async (groupId, signal, markPublishing) => {
        signal.throwIfAborted();
        if (real && !savedText) {
          const textDraft = {
            ...frozen,
            media: frozen.media.filter((item) => !item.src.startsWith("blob:")),
          };
          if (!(await services.jobPosts.storePostDraft(role, textDraft)))
            throw new Error(
              "Your draft could not be saved. Retry this post upload.",
            );
          savedText = true;
        }
        signal.throwIfAborted();
        const media = await Promise.all(
          frozen.media.map(async (item) => {
            const file = files.get(item.src);
            if (!file) return item;
            if (!uploaded.has(item.src)) {
              const asset = await services.media.upload(
                file,
                "post_image",
                undefined,
                { groupId },
              );
              uploaded.set(item.src, asset.url);
            }
            return { ...item, src: uploaded.get(item.src)! };
          }),
        );
        signal.throwIfAborted();
        const resolved = { ...frozen, media };
        const values = (real ? postPublishSchema : postSelectionSchema).parse({
          ...resolved,
          attachments: media,
        });
        if (real && !stored) {
          if (!(await services.jobPosts.storePostDraft(role, resolved)))
            throw new Error(
              "Your draft could not be saved. Retry this post upload.",
            );
          stored = resolved;
        }
        signal.throwIfAborted();
        markPublishing();
        const result = await services.feed.createPost(role, {
          title: values.title,
          body: values.body,
          project: values.project,
          attachments: values.attachments,
          ...(previewUrl ? { previewUrl } : {}),
          creationKey,
          ...(real
            ? {
                draftId: resolved.id,
                draftVersion: stored?.version ?? resolved.version,
                editorToken: resolved.editorToken,
              }
            : {}),
        });
        if (!result)
          throw new Error(
            "Your post could not be published. Retry when ready; your selected files are kept.",
          );
        signal.throwIfAborted();
        track("post_published", {
          mediaCount: media.length,
          hasProject: !!resolved.project,
        });
        void cache
          .invalidateQueries({
            predicate: (query) =>
              ["feed", "post-draft", "activity"].includes(
                String(query.queryKey[0]),
              ),
          })
          .catch(() => undefined);
        toast(
          devCopy(
            "Your demo post is now in your feed.",
            "Your post is now in your feed.",
          ),
        );
        return home + "?post=" + encodeURIComponent(result.id);
      },
      () => {
        for (const url of urls) URL.revokeObjectURL(url);
        files.clear();
      },
    );
    setFeed({ filter: "all", sort: "recent", query: "" });
    router.push(home);
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
              <button
                type="button"
                key={name}
                onClick={() => go(i)}
                className={
                  d.step === i ? "active" : i < d.step ? "completed" : ""
                }
                disabled={i > d.reached}
                aria-current={i === d.step ? "step" : undefined}
              >
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
            <div className="wizard-stage-title-row">
              <h2>{STEPS[d.step]}</h2>
              {real && (
                <InfoBadge label="Post visibility information">
                  Published posts follow your profile visibility. Keep your
                  profile public to share them with the community.
                </InfoBadge>
              )}
            </div>
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
            <fieldset disabled={busy} className="contents">
              {d.step === 0 && (
                <>
                  <div className="row post-author">
                    <Avatar person={identity} size="lg" />
                    <div>
                      <strong>{identity.name}</strong>
                      <p className="small muted">{identity.headline}</p>
                    </div>
                  </div>
                  <TextField
                    label="Post title"
                    name="title"
                    value={d.title}
                    onChange={(e) => update({ title: e.target.value })}
                    maxLength={150}
                  />
                  <TextAreaField
                    ref={bodyField}
                    label="Your story"
                    name="body"
                    value={d.body}
                    onChange={(e) => update({ body: e.target.value })}
                    onPaste={(e) =>
                      link.confirm(e.clipboardData.getData("text"))
                    }
                    onBlur={(e) => link.confirm(e.target.value)}
                    maxLength={3000}
                    rows={9}
                  />
                  <ComposerLinkPreview
                    state={link.state}
                    onRemove={() => {
                      link.dismiss();
                      // The remove button unmounts; keep keyboard focus in the story.
                      bodyField.current?.focus();
                    }}
                  />
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
                      accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/rtf,text/rtf,text/plain,.doc,.docx,.pdf,.txt,.rtf,.mp4,.webm"
                      multiple
                      hidden
                      onChange={(e) => {
                        void addFiles([...(e.target.files || [])]);
                        e.target.value = "";
                      }}
                    />
                    <ol
                      className="post-media-grid"
                      aria-label="Selected media in publishing order"
                    >
                      {d.media.map((m, i) => (
                        <li
                          className="post-media-tile"
                          title={m.name || "Media"}
                          key={m.src}
                        >
                          {m.type === "image" ? (
                            <MediaImage
                              src={localPreviews[m.src] || m.src}
                              alt={m.alt || ""}
                              fallback={
                                <span className="media-fallback" aria-hidden>
                                  <Icon name="image" />
                                </span>
                              }
                            />
                          ) : (
                            <span
                              className={
                                m.type === "video"
                                  ? "post-tile-video"
                                  : "post-tile-file"
                              }
                            >
                              {m.type === "video" &&
                                m.src.startsWith("blob:") && (
                                  <video
                                    src={m.src}
                                    controls
                                    preload="metadata"
                                    aria-label={`Preview ${m.name}`}
                                  />
                                )}
                              <Icon
                                name={m.type === "video" ? "monitor" : "file"}
                              />
                              <small>
                                {m.type === "video"
                                  ? "Video"
                                  : (
                                      m.name.split(".").pop() || "File"
                                    ).toUpperCase()}
                              </small>
                              <small className="post-selected-file-name">
                                {m.name}
                              </small>
                            </span>
                          )}
                          <span
                            className="post-media-position"
                            aria-label={"Position " + (i + 1)}
                          >
                            {i + 1}
                          </span>
                          <button
                            type="button"
                            className="post-media-remove"
                            aria-label={"Remove " + (m.name || "video")}
                            title="Remove media"
                            onClick={() => {
                              const removed = d.media[i];
                              selectedFiles.current.delete(removed.src);
                              if (removed && previewUrls.current[removed.src]) {
                                URL.revokeObjectURL(
                                  previewUrls.current[removed.src],
                                );
                                delete previewUrls.current[removed.src];
                                setLocalPreviews({ ...previewUrls.current });
                              }
                              update({
                                media: d.media.filter((_, n) => n !== i),
                              });
                            }}
                          >
                            <Icon name="close" />
                          </button>
                        </li>
                      ))}
                      {
                        <li className="post-media-add-tile">
                          <button
                            type="button"
                            aria-label="Add files from your computer"
                            onClick={() => !busy && fileInput.current?.click()}
                          >
                            <Icon name="plus" />
                            <span>
                              {d.media.length ? "Add more" : "Add files"}
                            </span>
                          </button>
                        </li>
                      }
                    </ol>
                    <p className="post-upload-help">
                      Images, MP4/WebM video, and documents (PDF, Word, RTF,
                      TXT). Preview immediately; files upload with your post
                      when you publish. New selections are added at the end.
                    </p>
                  </div>
                  {role === "professional" && (
                    <SelectField
                      loading={projectsLoading}
                      label="Link a public project"
                      name="project"
                      value={d.project}
                      onChange={(e) => update({ project: e.target.value })}
                      options={[
                        { value: "", label: "No linked project" },
                        ...publicProjects.map((p) => ({
                          value: p.id,
                          label: p.title,
                        })),
                      ]}
                    />
                  )}
                </>
              )}
              {d.step === 2 && (
                <>
                  <div className="post-review-summary">
                    <div>
                      <Icon name="check" />
                      <div>
                        <strong>Your story</strong>
                        <p>{d.title.trim() || "No title"}</p>
                        <span>
                          {d.body.trim()
                            ? `${d.body.length} / 3000 characters`
                            : "No story"}
                        </span>
                      </div>
                      <Button
                        variant="text sm"
                        icon="edit"
                        onClick={() => go(0)}
                      >
                        Edit
                      </Button>
                    </div>
                    <div>
                      <Icon name="image" />
                      <div>
                        <strong>Media & project</strong>
                        <p>
                          {d.media.length
                            ? d.media.length +
                              " media item" +
                              (d.media.length === 1 ? "" : "s")
                            : "Text-only post"}
                          {d.project ? " · Project linked" : ""}
                        </p>
                        <span>
                          Use the arrows in the preview to review every item.
                        </span>
                      </div>
                      <Button
                        variant="text sm"
                        icon="edit"
                        onClick={() => go(1)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                  <DevOnly>
                    <InfoBadge label="Publishing information">
                      Your post will appear in the public demo feed in this
                      browser. It won’t be sent to an external social network.
                    </InfoBadge>
                  </DevOnly>
                </>
              )}
            </fieldset>
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
              disabled={busy}
              onClick={async () => {
                if (await persist(d))
                  toast("Draft saved. Resume it from Create a post.");
              }}
            >
              Save draft
            </Button>
            <Button
              variant="primary"
              form="post-editor-form"
              type="submit"
              loading={busy && d.step === 2}
              loadingLabel="Publishing post"
              disabled={busy}
            >
              <Icon name={d.step === 2 ? "send" : "arrow"} />
              {d.step === 2
                ? devCopy("Publish demo post", "Publish post")
                : "Next"}
            </Button>
          </div>
          <p className="small muted post-editor-footer-note">
            {busy && "Adding your media…"}
          </p>
        </section>
        <aside className="post-preview-column" aria-label="Live post preview">
          <div className="post-preview-heading">
            <span>
              <Icon name="eye" />
              Live preview
            </span>
          </div>
          <div
            id="post-live-preview"
            onClickCapture={(e) => {
              if (
                (e.target as Element).closest(
                  "[data-carousel-control],video,.post-document",
                )
              )
                return;
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <FeedCard
              entry={previewEntry(d, identity, projects, link.state.preview)}
              role={role}
              noTracking
              localPreview
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

export function PostEditorScreen({ role }: { role: Role }) {
  const mode = useSearchParams().get("mode") || "post";
  const draftQuery = useServiceQuery(["post-draft", role, mode], (s) =>
    s.jobPosts.getPostDraft(role, mode),
  );
  const identityQuery = useServiceQuery(
    ["feed", "identity", role],
    async (s) =>
      role === "recruiter"
        ? (await s.workspace.getRecruiterShell()).identity
        : (await s.workspace.getProfessionalShell()).person,
  );
  const projectQuery = useServiceQuery(
    ["projects", "post-editor", role],
    (s) =>
      role === "recruiter"
        ? Promise.resolve([])
        : s.work.listProjects({
            ownerId: apiConfig.dataSource === "http" ? "me" : "p0",
          }),
  );
  const draft = draftQuery.data,
    identity = identityQuery.data,
    projects = projectQuery.data;
  if (draftQuery.isError || identityQuery.isError)
    return (
      <ScreenError
        onRetry={() => {
          void draftQuery.refetch();
          void identityQuery.refetch();
          void projectQuery.refetch();
        }}
      />
    );
  if (!draft || !identity) return <ScreenFallback layout="form" />;
  // The editor seeds its local state once; later refetches of the stored draft do not reset it.
  return (
    <>
      {projectQuery.isError && (
        <p role="alert">
          Project options could not be loaded.{" "}
          <Button onClick={() => projectQuery.refetch()}>Retry</Button>
        </p>
      )}
      <Editor
        key={role}
        role={role}
        initial={draft}
        identity={identity}
        projects={projects ?? []}
        projectsLoading={projectQuery.isPending}
      />
    </>
  );
}
