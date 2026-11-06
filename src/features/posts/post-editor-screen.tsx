"use client";

import { InfoBadge } from "@/components/ui/info-badge";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AvatarSkeleton, CardSkeleton, LoadingRegion, Skeleton, TextSkeleton } from "@/components/ui/skeleton";
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
  emptyQuickJob,
  postDraftValuesSchema,
  postMediaKind,
  postPublishSchema,
  postSelectionSchema,
  postTextSchema,
  validatePostFiles,
} from "@/lib/validation/social";
import { JOB_RULES } from "@/lib/validation/job";
import { withResolvedMediaMime } from "@/lib/validation/profile";
import { errorMessage } from "@/services/api/client";
import { useServiceQuery, useServices } from "@/hooks/use-services";
import { toast } from "@/stores/toast-store";
import { useUiStore } from "@/stores/ui-store";
import { Icon } from "@/components/ui/icon";
import { Avatar, Button, LinkButton } from "@/components/ui/primitives";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { ScreenError } from "@/components/ui/feedback";
import { ErrorState } from "@/components/ui/state-views";
import { CatalogMultiPicker } from "@/components/ui/skill-picker";
import { FeedCard } from "@/features/feed/feed-card";
import { MediaImage } from "@/components/ui/media-image";
import { modal } from "@/stores/modal-store";
import {
  emptyPostMediaEditing,
  exportCroppedImage,
  isCroppableImage,
  isPostAspectRatioId,
  mimeFromName,
  isDefaultCrop,
  isPreviewableVideo,
  mediaCropOf,
  removePostMedia,
  type PostMediaEditingState,
} from "@/lib/media/post-crop";
import { PostCropEditor, type PostCropEditorItem } from "./post-crop-editor";
import {
  findLinks,
  linkPreviewContract,
  type LinkPreview,
} from "@/lib/validation/link-preview";
import { useLinkPreview } from "./use-link-preview";
import { ComposerLinkPreview } from "./composer-link-preview";

const CREATE_STEPS = ["Post details", "Media & project", "Review & publish"];
const EDIT_STEPS = ["Post details", "Media & project", "Review & save"];

function postDraftFromEntry(entry: FeedEntry): PostDraft {
  const media =
    entry.attachments?.length
      ? entry.attachments.map((item) => ({ ...item }))
      : [
          ...(entry.image
            ? [{ type: "image" as const, src: entry.image, alt: entry.imageAlt || "", name: "image", bytes: undefined }]
            : []),
          ...(entry.video
            ? [{ type: "video" as const, src: entry.video, alt: "", name: "video", bytes: undefined }]
            : []),
        ];
  return {
    id: entry.id,
    title: "",
    body: entry.body,
    project: entry.project?.id || "",
    media,
    videoUrl: entry.video || "",
    commentsEnabled: entry.commentsEnabled !== false,
    mediaAspect: entry.mediaAspect ?? null,
    previewDismissedUrls: entry.linkPreview ? [] : findLinks(entry.body).map((link) => link.key),
    quickJob: entry.linkedJob
      ? {
          enabled: true,
          title: entry.linkedJob.title,
          locations: entry.linkedJob.location
            ? entry.linkedJob.location.split(" · ").map((part) => part.trim()).filter(Boolean)
            : [],
          employment: entry.linkedJob.employment,
          arrangement: entry.linkedJob.arrangement,
        }
      : undefined,
    step: 0,
    reached: 2,
    version: entry.version,
  };
}

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
    title: "",
    body:
      d.body.trim() ||
      "Your caption will appear here as you write. Add media to see how your post will look in the feed.",
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
    commentsEnabled: d.commentsEnabled !== false,
    mediaAspect: d.mediaAspect ?? (d.media.length ? "original" : null),
    linkedJob:
      d.quickJob?.enabled && d.quickJob.title
        ? {
            id: "preview-job",
            title: d.quickJob.title,
            location: d.quickJob.locations.join(" · "),
            arrangement: d.quickJob.arrangement || "",
            employment: d.quickJob.employment || "",
            ownedByViewer: true,
            applied: false,
            open: true,
          }
        : undefined,
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
  edit,
}: {
  role: Role;
  initial: PostDraft;
  identity: PersonSummary;
  projects: Project[];
  projectsLoading?: boolean;
  edit?: { postId: string; version: number; linkPreview?: LinkPreview };
}) {
  const cache = useQueryClient();
  const services = useServices();
  const router = useRouter();
  const setFeed = useUiStore((s) => s.setFeed);
  const editing = !!edit;
  const steps = editing ? EDIT_STEPS : CREATE_STEPS;
  // Posts are caption-only; a title saved by an older editor is cleared rather than published unseen.
  // Comments stay on unless the author explicitly turns them off.
  const [untitled] = useState(() => ({
    ...initial,
    title: "",
    commentsEnabled: initial.commentsEnabled !== false,
    quickJob: initial.quickJob ?? (role === "recruiter" ? emptyQuickJob() : undefined),
  }));
  const [d, setD] = useState(untitled);
  const latestDraft = useRef(untitled);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const publishing = useRef(false);
  const previewsTransferred = useRef(false);
  const [creationKey] = useState(() => crypto.randomUUID());
  const editVersion = useRef(edit?.version ?? initial.version ?? 1);
  const [saveStatus, setSaveStatus] = useState(
    editing
      ? "Changes save when you confirm on the last step."
      : devCopy(
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
  /**
   * Instagram-style cropping. One global ratio for the post, per-item zoom/focus keyed by a stable
   * media id (never the src, which changes when a crop is exported, and never the index). The
   * original File / preview stays in `originals` so a crop can be re-edited from the source.
   */
  const [mediaEditing, setMediaEditing] = useState<PostMediaEditingState>(() => ({
    ...emptyPostMediaEditing(),
    // The draft/post remembers the chosen ratio; the editor starts from it.
    aspectRatio: isPostAspectRatioId(untitled.mediaAspect) ? untitled.mediaAspect : "original",
  }));
  const mediaEditingRef = useRef(mediaEditing);
  const commitEditing = (next: PostMediaEditingState) => {
    mediaEditingRef.current = next;
    setMediaEditing(next);
  };
  type TileInfo = { id: string; editable: "image" | "video" | null };
  type OriginalMedia = { file?: File; src: string; name: string; mime: string; type: "image" | "video" | "document" };
  /** Media already in the draft (mock mode keeps data URLs) is editable again from its stored source. */
  const [hydrated] = useState(() => {
    const tiles: Record<string, TileInfo> = {};
    const originals = new Map<string, OriginalMedia>();
    for (const m of untitled.media) {
      if (!(m.src.startsWith("data:") || m.src.startsWith("blob:"))) continue;
      const mime = mimeFromName(m.name);
      const id = crypto.randomUUID();
      originals.set(id, { src: m.src, name: m.name, mime, type: m.type });
      tiles[m.src] = {
        id,
        editable:
          m.type === "image" && isCroppableImage({ type: m.type, src: m.src, name: m.name, mime })
            ? "image"
            : m.type === "video" && isPreviewableVideo({ type: m.type, src: m.src })
              ? "video"
              : null,
      };
    }
    return { tiles, originals };
  });
  /** Current src -> stable id + what the crop editor can do with it. Mirrored in a ref for async work. */
  const [tileInfo, setTileInfo] = useState<Record<string, TileInfo>>(hydrated.tiles);
  const tileInfoRef = useRef<Record<string, TileInfo>>(hydrated.tiles);
  const commitTiles = (next: Record<string, TileInfo>) => {
    tileInfoRef.current = next;
    setTileInfo(next);
  };
  const originals = useRef<Map<string, OriginalMedia>>(hydrated.originals);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const processingVersion = useRef(new Map<string, number>());
  const processingChain = useRef<Promise<void>>(Promise.resolve());
  const home = role === "recruiter" ? "/recruiter/dashboard" : "/app/dashboard";
  const publicProjects = projects.filter((p) => p.visibility === "Public");

  const real = apiConfig.dataSource === "http";
  const persist = useCallback(
    async (next: PostDraft) => {
      if (editing) return true;
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
    [editing, real, role, services],
  );
  useEffect(() => {
    if (editing || !real || publishing.current) return;
    const timer = window.setTimeout(() => {
      if (!publishing.current) void persist(d);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [d, editing, persist, real]);
  useEffect(() => {
    mounted.current = true;
    const urls = previewUrls.current;
    const originalsAtUnmount = originals.current;
    return () => {
      mounted.current = false;
      if (!previewsTransferred.current)
        for (const url of Object.values(urls)) URL.revokeObjectURL(url);
      // Original (uncropped) previews are never handed to the publication task.
      const kept = new Set(previewsTransferred.current ? Object.values(urls) : []);
      for (const original of originalsAtUnmount.values())
        if (original.src.startsWith("blob:") && !kept.has(original.src)) URL.revokeObjectURL(original.src);
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
  /** Like update(), but based on the latest draft so async work never writes over newer edits. */
  const updateLatest = (patch: Partial<PostDraft>) => {
    const next = { ...latestDraft.current, ...patch };
    latestDraft.current = next;
    if (real) setSaveStatus("Unsaved changes");
    setD(next);
    if (!real) void persist(next);
    return next;
  };
  const registerOriginal = (
    src: string,
    file: File | undefined,
    type: "image" | "video" | "document",
    name: string,
    mime: string,
    tiles: Record<string, TileInfo>,
  ) => {
    const id = crypto.randomUUID();
    originals.current.set(id, { file, src, name, mime, type });
    const editable =
      type === "image" && isCroppableImage({ type, src, name, mime }) ? "image" : type === "video" && isPreviewableVideo({ type, src }) ? "video" : null;
    tiles[src] = { id, editable };
    return id;
  };
  const currentSrcOf = (id: string) => Object.entries(tileInfoRef.current).find(([, info]) => info.id === id)?.[0];
  /** Replace a tile's preview + File with the processed output; the original stays untouched. */
  const swapMediaSource = (id: string, nextSrc: string, nextFile: File) => {
    const currentSrc = currentSrcOf(id);
    if (!currentSrc || currentSrc === nextSrc) return;
    const original = originals.current.get(id);
    const tiles = { ...tileInfoRef.current };
    const info = tiles[currentSrc];
    delete tiles[currentSrc];
    tiles[nextSrc] = info;
    commitTiles(tiles);
    if (real) {
      selectedFiles.current.delete(currentSrc);
      selectedFiles.current.set(nextSrc, nextFile);
      if (currentSrc !== original?.src) URL.revokeObjectURL(currentSrc);
      delete previewUrls.current[currentSrc];
      previewUrls.current[nextSrc] = nextSrc;
      setLocalPreviews({ ...previewUrls.current });
    }
    updateLatest({
      media: latestDraft.current.media.map((m) => (m.src === currentSrc ? { ...m, src: nextSrc, name: nextFile.name, bytes: nextFile.size } : m)),
    });
  };
  /**
   * Export the given items from their ORIGINAL file with the current global ratio + their own crop.
   * Runs sequentially in the background (tiles show "Cropping…"); publish waits for the chain.
   */
  const processItems = (ids: string[]) => {
    const run = async () => {
      for (const id of ids) {
        const original = originals.current.get(id);
        if (!original || original.type !== "image" || !isCroppableImage({ type: "image", src: original.src, name: original.name, mime: original.mime })) continue;
        const version = (processingVersion.current.get(id) ?? 0) + 1;
        processingVersion.current.set(id, version);
        setProcessing((prev) => ({ ...prev, [id]: true }));
        try {
          const editing = mediaEditingRef.current;
          const crop = mediaCropOf(editing, id);
          let nextFile: File | undefined;
          let nextSrc: string;
          if (editing.aspectRatio === "original" && isDefaultCrop(crop)) {
            // Untouched: publish the original bytes, no re-encode.
            nextFile = original.file;
            nextSrc = original.src;
          } else {
            const result = await exportCroppedImage({
              source: original.file ?? original.src,
              sourceName: original.name,
              sourceMime: original.mime,
              presetId: editing.aspectRatio,
              crop,
            });
            nextFile = result.file;
            nextSrc = real ? URL.createObjectURL(nextFile) : await readAsDataUrl(nextFile);
          }
          const stale = !mounted.current || processingVersion.current.get(id) !== version;
          if (stale) {
            if (real && nextSrc !== original.src && nextSrc.startsWith("blob:")) URL.revokeObjectURL(nextSrc);
            continue;
          }
          if (nextFile) swapMediaSource(id, nextSrc, nextFile);
        } catch (e) {
          if (mounted.current) setError(e instanceof Error ? e.message : "The image could not be cropped. The original is kept.");
        } finally {
          if (mounted.current)
            setProcessing((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
        }
      }
    };
    const chained = processingChain.current.then(run, run);
    processingChain.current = chained;
    return chained;
  };
  const editableImageIds = () =>
    latestDraft.current.media.map((m) => tileInfoRef.current[m.src]).filter((info): info is TileInfo => !!info && info.editable === "image").map((info) => info.id);
  /** Instagram/profile-photo flow: picking media opens the editor right away on the first new image. */
  const openEditorForNew = (ids: string[], tiles: Record<string, TileInfo>) => {
    const first = ids.find((id) => Object.values(tiles).some((info) => info.id === id && info.editable === "image"));
    if (first) openCropEditor(first);
  };
  const openCropEditor = (activeId: string) => {
    const items: PostCropEditorItem[] = latestDraft.current.media
      .map((m) => tileInfoRef.current[m.src])
      .filter((info): info is TileInfo => !!info && info.editable !== null)
      .map((info) => {
        const original = originals.current.get(info.id)!;
        return { id: info.id, src: original.src, type: info.editable as "image" | "video", name: original.name };
      });
    if (!items.length) return;
    modal.show(
      items.length > 1 ? "Edit media" : "Edit image",
      <PostCropEditor
        items={items}
        activeId={activeId}
        state={mediaEditingRef.current}
        onCancel={() => modal.close()}
        onApply={(next) => {
          modal.close();
          const prev = mediaEditingRef.current;
          commitEditing(next);
          const ratioChanged = prev.aspectRatio !== next.aspectRatio;
          if (ratioChanged) updateLatest({ mediaAspect: next.aspectRatio });
          const changed = editableImageIds().filter((id) => {
            if (ratioChanged) return true;
            const before = mediaCropOf(prev, id);
            const after = mediaCropOf(next, id);
            return before.zoom !== after.zoom || before.focus.x !== after.focus.x || before.focus.y !== after.focus.y;
          });
          if (changed.length) void processItems(changed);
        }}
      />,
      // Centered 620px dialog (the profile photo editor's shell): wide enough for the crop stage.
      "photo",
    );
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
    initial: edit?.linkPreview,
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
          setError("");
          toast(parsed.error.issues[0].message);
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
    const validation = await validatePostFiles(files, d.media);
    if (validation) {
      setError(validation);
      return;
    }
    if (real) {
      const tiles = { ...tileInfoRef.current };
      const addedIds: string[] = [];
      const items = files.map((file) => {
        const upload = withResolvedMediaMime(file, "post_image") ?? file;
        const src = URL.createObjectURL(upload);
        selectedFiles.current.set(src, upload);
        previewUrls.current[src] = src;
        const type = postMediaKind(upload);
        addedIds.push(registerOriginal(src, upload, type, upload.name, upload.type, tiles));
        return {
          type,
          src,
          alt: "",
          name: upload.name,
          bytes: upload.size,
        };
      });
      commitTiles(tiles);
      setLocalPreviews({ ...previewUrls.current });
      update({ media: [...d.media, ...items], mediaAspect: d.mediaAspect ?? mediaEditingRef.current.aspectRatio });
      setError("");
      // New items pick up the post's current global ratio.
      if (mediaEditingRef.current.aspectRatio !== "original") void processItems(addedIds);
      openEditorForNew(addedIds, tiles);
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
      const tiles = { ...tileInfoRef.current };
      const addedIds = items.map((item, index) =>
        registerOriginal(item.src, files[index], item.type, item.name, files[index].type || item.type, tiles),
      );
      commitTiles(tiles);
      if (real) {
        items.forEach((item, index) => {
          if (previewUrls.current[item.src])
            URL.revokeObjectURL(previewUrls.current[item.src]);
          previewUrls.current[item.src] = URL.createObjectURL(files[index]);
        });
        setLocalPreviews({ ...previewUrls.current });
      }
      const next = { ...d, media: [...d.media, ...items], mediaAspect: d.mediaAspect ?? mediaEditingRef.current.aspectRatio };
      latestDraft.current = next;
      setD(next);
      // The editor reads the latest draft, so it opens only after the new items are in it.
      if (mediaEditingRef.current.aspectRatio !== "original") void processItems(addedIds);
      openEditorForNew(addedIds, tiles);
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
      setError("");
      toast(details.error.issues[0].message);
      return;
    }
    if (d.step < 2) {
      if (d.step === 1) {
        // Quick-job title/location fields live on the review step; do not block media → review.
        const result = postSelectionSchema.safeParse({
          ...d,
          attachments: d.media,
          quickJob: undefined,
        });
        if (!result.success) {
          setError("");
          toast(result.error.issues[0].message);
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
      setError("");
      toast(parsed.error.issues[0].message);
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
    const publicationId = editing ? edit!.postId : d.id;
    if (
      postPublications
        .getSnapshot()
        .some(
          (task) =>
            task.draftId === publicationId &&
            task.state !== "cancelled" &&
            task.state !== "completed",
        )
    ) {
      setError(
        "This post already has a background upload. Follow its progress or retry it there.",
      );
      return;
    }
    publishing.current = true;
    setBusy(true);
    setError("");
    // A crop export may still be running; the published file must be the latest confirmed crop.
    await processingChain.current.catch(() => {});
    if (!mounted.current) return;
    const frozen: PostDraft = {
      ...latestDraft.current,
      media: latestDraft.current.media.map((item) => ({ ...item })),
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
      publicationId,
      editing ? "Your changes" : "Your post",
      async (groupId, signal, markPublishing) => {
        signal.throwIfAborted();
        if (real && !editing && !savedText) {
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
        if (real && !editing && !stored) {
          if (!(await services.jobPosts.storePostDraft(role, resolved)))
            throw new Error(
              "Your draft could not be saved. Retry this post upload.",
            );
          stored = resolved;
        }
        signal.throwIfAborted();
        markPublishing();
        if (editing) {
          const expectedVersion = editVersion.current;
          const ok = await services.feed.updatePost(role, edit!.postId, {
            title: "",
            body: values.body,
            project: values.project,
            attachments: values.attachments,
            commentsEnabled: values.commentsEnabled !== false,
            mediaAspect: values.mediaAspect ?? (values.attachments.length ? "original" : null),
            version: expectedVersion,
            previewUrl: previewUrl ?? "",
            ...(role === "recruiter" && values.quickJob
              ? { quickJob: values.quickJob }
              : {}),
          });
          if (!ok)
            throw new Error(
              "Your changes could not be saved. Retry when ready; your selected files are kept.",
            );
          // Server bumps version on every successful PATCH; keep the ref in sync so a
          // retry after a late client failure does not resend the spent revision.
          if (editVersion.current === expectedVersion) editVersion.current = expectedVersion + 1;
          signal.throwIfAborted();
          track("post_edited", {
            mediaCount: media.length,
            hasProject: !!resolved.project,
          });
          void cache
            .invalidateQueries({
              predicate: (query) =>
                ["feed", "feed-entry", "activity"].includes(
                  String(query.queryKey[0]),
                ),
            })
            .catch(() => undefined);
          toast("Changes saved.");
          return home + "?post=" + encodeURIComponent(edit!.postId);
        }
        const result = await services.feed.createPost(role, {
          // Posts have no title field; a title left in an older draft is not published.
          title: "",
          body: values.body,
          project: values.project,
          attachments: values.attachments,
          commentsEnabled: values.commentsEnabled !== false,
          mediaAspect: values.mediaAspect ?? (values.attachments.length ? "original" : null),
          ...(previewUrl ? { previewUrl } : {}),
          ...(role === "recruiter" && values.quickJob
            ? { quickJob: values.quickJob }
            : {}),
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
              ["feed", "activity"].includes(String(query.queryKey[0])),
          })
          .catch(() => undefined);
        // The server deleted the draft with the publication. Drop the cached copy entirely:
        // invalidating would still seed the next editor from the stale draft (old step and
        // media) before the refetch lands, since the editor seeds its state once.
        cache.removeQueries({ queryKey: ["post-draft"] });
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
        <div className="post-editor-title">
          <h1>{editing ? "Edit post" : "Create a post"}</h1>
        </div>
        <LinkButton href={home} icon="arrow">
          Back to feed
        </LinkButton>
      </header>
      <div className="post-editor-layout">
        <aside className="card job-wizard-stepper post-editor-stepper">
          <h2>{editing ? "Edit post" : "Create a post"}</h2>
          <nav aria-label={editing ? "Post edit steps" : "Post creation steps"}>
            {steps.map((name, i) => (
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
              STEP {d.step + 1} OF {steps.length}
            </span>
            <div className="wizard-stage-title-row">
              <h2>{steps[d.step]}</h2>
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
                  <TextAreaField
                    ref={bodyField}
                    label="Caption"
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
                      <span className="post-upload-heading-end">
                        {d.media.some((m) => tileInfo[m.src]?.editable) ? (
                          <Button
                            variant="sm"
                            icon="edit"
                            disabled={busy || Object.keys(processing).length > 0}
                            onClick={() => {
                              const first = d.media.map((m) => tileInfo[m.src]).find((info) => info?.editable);
                              if (first) openCropEditor(first.id);
                            }}
                          >
                            Edit media
                          </Button>
                        ) : null}
                      </span>
                    </div>
                    <input
                      ref={fileInput}
                      id="post-editor-files"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif,video/mp4,video/quicktime,video/webm,video/x-matroska,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.pdf,.doc,.docx,.ppt,.pptx,.mp4,.mov,.webm,.mkv"
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
                          {tileInfo[m.src]?.editable ? (
                            <button
                              type="button"
                              className={
                                "post-media-crop" +
                                (tileInfo[m.src].editable === "image" &&
                                (mediaEditing.aspectRatio !== "original" || !isDefaultCrop(mediaCropOf(mediaEditing, tileInfo[m.src].id)))
                                  ? " is-cropped"
                                  : "")
                              }
                              aria-label={"Edit crop for " + (m.name || "media")}
                              title="Edit crop"
                              disabled={busy || !!processing[tileInfo[m.src].id]}
                              onClick={() => openCropEditor(tileInfo[m.src].id)}
                            >
                              <Icon name="edit" />
                              <span>Edit</span>
                            </button>
                          ) : null}
                          {tileInfo[m.src] && processing[tileInfo[m.src].id] ? (
                            <span className="post-media-processing" role="status">
                              Cropping…
                            </span>
                          ) : null}
                          <button
                            type="button"
                            className="post-media-remove"
                            aria-label={"Remove " + (m.name || "video")}
                            title="Remove media"
                            onClick={() => {
                              const removed = d.media[i];
                              const info = tileInfoRef.current[removed.src];
                              if (info) {
                                const original = originals.current.get(info.id);
                                if (real && original && original.src !== removed.src && original.src.startsWith("blob:"))
                                  URL.revokeObjectURL(original.src);
                                originals.current.delete(info.id);
                                processingVersion.current.set(info.id, (processingVersion.current.get(info.id) ?? 0) + 1);
                                const tiles = { ...tileInfoRef.current };
                                delete tiles[removed.src];
                                commitTiles(tiles);
                                commitEditing(removePostMedia(mediaEditingRef.current, info.id));
                              }
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
                      Images (PNG, JPEG, WEBP, GIF, HEIC), video (MP4, MOV,
                      WEBM, MKV), and documents (PDF, DOC/DOCX, PPT/PPTX) up to
                      50 MB each. Preview immediately; files upload when you
                      publish. GIFs are not used for profile or background
                      photos.
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
                        <strong>Caption</strong>
                        <span>
                          {d.body.trim()
                            ? `${d.body.length} / 3000 characters`
                            : "No caption"}
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
                  {role === "recruiter" ? (
                    <div className="stack gap-md post-quick-job">
                      <div className="settings-row post-comments-toggle">
                        <div>
                          <h3>Quick job post</h3>
                          <p>
                            Keep this as a social post and also open applications for a linked role.
                          </p>
                        </div>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={!!d.quickJob?.enabled}
                            disabled={busy}
                            aria-label="Quick job post"
                            onChange={(event) =>
                              update({
                                quickJob: {
                                  ...(d.quickJob ?? emptyQuickJob()),
                                  enabled: event.target.checked,
                                },
                              })
                            }
                          />
                          <span />
                        </label>
                      </div>
                      {d.quickJob?.enabled ? (
                        <div className="stack gap-sm">
                          <TextField
                            label="Job title"
                            name="quickJobTitle"
                            required
                            maxLength={JOB_RULES.text.title}
                            value={d.quickJob.title}
                            disabled={busy}
                            onChange={(event) =>
                              update({
                                quickJob: {
                                  ...d.quickJob!,
                                  title: event.target.value,
                                },
                              })
                            }
                          />
                          <div
                            className="post-quick-job-locations"
                            {...(busy ? { inert: true } : {})}
                          >
                            <CatalogMultiPicker
                              catalog="location"
                              name="quickJobLocations"
                              label="Job locations"
                              variant="floating"
                              value={d.quickJob.locations}
                              max={JOB_RULES.lists.locations}
                              onChange={(values) =>
                                update({
                                  quickJob: {
                                    ...d.quickJob!,
                                    locations: values,
                                  },
                                })
                              }
                            />
                          </div>
                          <SelectField
                            required
                            label="Employment type"
                            name="quickJobEmployment"
                            value={d.quickJob.employment}
                            options={["", ...JOB_RULES.employment]}
                            disabled={busy}
                            onChange={(event) =>
                              update({
                                quickJob: {
                                  ...d.quickJob!,
                                  employment: event.target.value,
                                },
                              })
                            }
                          />
                          <SelectField
                            required
                            label="Work arrangement"
                            name="quickJobArrangement"
                            value={d.quickJob.arrangement}
                            options={["", ...JOB_RULES.arrangements]}
                            disabled={busy}
                            onChange={(event) =>
                              update({
                                quickJob: {
                                  ...d.quickJob!,
                                  arrangement: event.target.value,
                                },
                              })
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="settings-row post-comments-toggle">
                    <div>
                      <h3>Allow comments</h3>
                      <p>Comments are on by default. Turn this off to publish without comments or replies.</p>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={d.commentsEnabled !== false}
                        disabled={busy}
                        aria-label="Allow comments on this post"
                        onChange={(event) => update({ commentsEnabled: event.target.checked })}
                      />
                      <span />
                    </label>
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
            {!editing && (
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
            )}
            <Button
              variant="primary"
              form="post-editor-form"
              type="submit"
              loading={busy && d.step === 2}
              loadingLabel={editing ? "Saving changes" : "Publishing post"}
              disabled={busy}
            >
              <Icon name={d.step === 2 ? (editing ? "check" : "send") : "arrow"} />
              {d.step === 2
                ? editing
                  ? "Save changes"
                  : devCopy("Publish demo post", "Publish post")
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
                  "[data-carousel-control],video,.post-document,.post-doc-viewer",
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

/** Editor chrome (title, back link, steps, preview column) shown while the draft and identity load. */
function PostEditorFrame({ role, children }: { role: Role; children: ReactNode }) {
  const home = role === "recruiter" ? "/recruiter/dashboard" : "/app/dashboard";
  return (
    <div className="post-editor">
      <header className="job-wizard-top">
        <div className="post-editor-title">
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
            {CREATE_STEPS.map((name, i) => (
              <button type="button" key={name} disabled>
                <span>{i + 1}</span>
                <strong>{name}</strong>
              </button>
            ))}
          </nav>
        </aside>
        <section className="card job-wizard-content post-editor-content">{children}</section>
        <aside className="post-preview-column" aria-label="Live post preview">
          <div className="post-preview-heading">
            <span>
              <Icon name="eye" />
              Live preview
            </span>
          </div>
          <LoadingRegion label="Loading post preview">
            <CardSkeleton media />
          </LoadingRegion>
        </aside>
      </div>
    </div>
  );
}

export function PostEditorScreen({ role }: { role: Role }) {
  const params = useSearchParams();
  const mode = params.get("mode") || "post";
  const editId = params.get("id") || "";
  const editing = !!editId;
  const draftQuery = useServiceQuery(["post-draft", role, mode], (s) => s.jobPosts.getPostDraft(role, mode), {
    enabled: !editing,
  });
  const entryQuery = useServiceQuery(
    ["feed-entry", role, editId, "edit"],
    (s) => s.feed.getEntry(role, editId),
    { enabled: editing, staleTime: 0 },
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
  const identity = identityQuery.data;
  const projects = projectQuery.data;
  const entry = entryQuery.data;
  const editable = !!entry && entry.viewer.own && entry.type === "post";
  const draft = editing ? (editable ? postDraftFromEntry(entry) : undefined) : draftQuery.data;
  const editDenied = editing && entryQuery.isSuccess && !editable;
  const loadError = editing
    ? entryQuery.isError
      ? entryQuery.error
      : editDenied
        ? new Error("You can only edit your own posts.")
        : null
    : draftQuery.isError
      ? draftQuery.error
      : null;
  const waiting = editing ? entryQuery.isPending : draftQuery.isPending;
  const showError = !!(identityQuery.isError || loadError);
  if (showError || !identity || waiting || !draft)
    return (
      <PostEditorFrame role={role}>
        {showError ? (
          <ScreenError
            compact
            error={identityQuery.error ?? loadError}
            title={editing ? "This post couldn’t be opened for editing" : "The post editor couldn’t open"}
            description={editing ? "Only your own posts can be edited here. Try again from your feed." : "Something interrupted the request. Please try again."}
            homeHref={role === "recruiter" ? "/recruiter/dashboard" : "/app/dashboard"}
            homeLabel="Back to feed"
            onRetry={() => {
              void (editing ? entryQuery.refetch() : draftQuery.refetch());
              void identityQuery.refetch();
              void projectQuery.refetch();
            }}
          />
        ) : (
          <LoadingRegion label={editing ? "Loading post" : "Loading post editor"}>
            <div className="stack">
              <div className="skeleton-lines"><Skeleton style={{ width: "25%" }} /><Skeleton style={{ width: "45%", height: 28 }} /></div>
              <div className="skeleton-identity"><AvatarSkeleton /><TextSkeleton lines={2} /></div>
              <div className="skeleton-lines"><Skeleton style={{ width: "20%" }} /><Skeleton style={{ height: 200 }} /></div>
            </div>
          </LoadingRegion>
        )}
      </PostEditorFrame>
    );
  // The editor seeds its local state once; later refetches of the stored draft do not reset it.
  return (
    <>
      {projectQuery.isError && (
        <ErrorState
          compact
          error={projectQuery.error}
          title="Project options couldn’t load"
          description="You can still write your post. Try again to link it to a project."
          onRetry={() => void projectQuery.refetch()}
        />
      )}
      <Editor
        key={editing ? "edit-" + editId : "create-" + role}
        role={role}
        initial={draft}
        identity={identity}
        projects={projects ?? []}
        projectsLoading={projectQuery.isPending}
        edit={
          editing
            ? {
                postId: editId,
                version: entry!.version ?? 1,
                linkPreview: entry!.linkPreview,
              }
            : undefined
        }
      />
    </>
  );
}
