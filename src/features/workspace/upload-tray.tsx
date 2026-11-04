"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { uploadManager } from "@/services/media/upload-manager";
import { Icon } from "@/components/ui/icon";
import { MediaImage } from "@/components/ui/media-image";
import { useModalStore } from "@/stores/modal-store";
import Link from "next/link";
import { postPublications } from "@/services/media/post-publication-manager";
/** How long a finished item stays visible before it closes itself. */
const AUTO_CLOSE_MS = 4000;
const TERMINAL_UPLOAD = new Set(["completed", "cancelled", "failed"]);

/**
 * Dismisses finished uploads/posts a few seconds after they settle — success, cancel, or error —
 * so the floating tray closes on its own when nothing remains.
 */
function useAutoCloseFinished(taskIds: string[], postIds: string[]) {
  const scheduled = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timers = scheduled.current;
    const schedule = (key: string, close: () => void) => {
      if (timers.has(key)) return;
      timers.set(key, setTimeout(() => { timers.delete(key); close(); }, AUTO_CLOSE_MS));
    };
    // Re-check at close time: only dismiss terminal items (never cancel an in-flight upload).
    for (const id of taskIds) schedule("task:" + id, () => {
      const state = uploadManager.getSnapshot().find((task) => task.id === id)?.state;
      if (state && TERMINAL_UPLOAD.has(state)) uploadManager.dismiss(id);
    });
    for (const id of postIds) schedule("post:" + id, () => {
      const state = postPublications.getSnapshot().find((post) => post.id === id)?.state;
      if (state && TERMINAL_UPLOAD.has(state)) postPublications.dismiss(id);
    });
  }, [taskIds, postIds]);
  useEffect(() => () => { for (const timer of scheduled.current.values()) clearTimeout(timer); }, []);
}

const MINIMIZED_KEY = "upload-tray-minimized";
function readMinimized() {
  try { return sessionStorage.getItem(MINIMIZED_KEY) === "1"; } catch { return false; }
}

export function UploadTray({ insideModal = false }: { insideModal?: boolean }) {
  const modalOpen = useModalStore((state) => state.open);
  // Minimised like a docked chat widget: only the title, overall bar and percentage stay visible.
  const [minimized, setMinimized] = useState(readMinimized);
  const toggleMinimized = () => setMinimized((value) => {
    const next = !value;
    try { sessionStorage.setItem(MINIMIZED_KEY, next ? "1" : "0"); } catch { /* per-tab convenience only */ }
    return next;
  });
  const allTasks = useSyncExternalStore(
    uploadManager.subscribe,
    uploadManager.getSnapshot,
    uploadManager.getServerSnapshot,
  );
  const posts = useSyncExternalStore(
    postPublications.subscribe,
    postPublications.getSnapshot,
    postPublications.getServerSnapshot,
  );
  const tasks = allTasks.filter((task) => !task.groupId);
  useAutoCloseFinished(
    tasks.filter((task) => TERMINAL_UPLOAD.has(task.state)).map((task) => task.id),
    posts.filter((post) => TERMINAL_UPLOAD.has(post.state)).map((post) => post.id),
  );
  if ((!tasks.length && !posts.length) || modalOpen !== insideModal)
    return null;
  const total = tasks.reduce((n, t) => n + t.bytes, 0);
  // Overall percentage across loose files (weighted by size) and post uploads (each counted once).
  const parts = [...(tasks.length ? [tasks.reduce((n, t) => n + t.bytes * t.progress, 0) / Math.max(1, total)] : []), ...posts.map((post) => post.progress)];
  const progress = Math.round(Math.min(100, parts.reduce((n, value) => n + value, 0) / Math.max(1, parts.length)));
  const running = tasks.filter((t) => !["completed", "cancelled", "failed"].includes(t.state)).length + posts.filter((p) => ["uploading", "publishing"].includes(p.state)).length;
  const failed = tasks.some((t) => t.state === "failed") || posts.some((p) => p.state === "failed");
  return (
    <aside className={"upload-tray" + (minimized ? " is-minimized" : "")} aria-label="Media uploads">
      <header>
        <button type="button" className="upload-tray-toggle" onClick={toggleMinimized} aria-expanded={!minimized} aria-controls="upload-tray-list">
          <strong>Uploads{running > 0 ? ` (${running})` : ""}</strong>
          <span className="upload-tray-percent">{failed ? "Needs attention" : `${progress}%`}</span>
          <span className="upload-tray-chevron" aria-hidden="true"><Icon name={minimized ? "up" : "down"} /></span>
          <span className="sr-only">{minimized ? "Expand uploads" : "Minimise uploads"}</span>
        </button>
        <span className="upload-tray-overall" role="progressbar" aria-label="Overall upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <span style={{ width: progress + "%" }} />
        </span>
      </header>
      <div className="upload-tray-list" id="upload-tray-list" hidden={minimized}>
        {posts.map((post) => (
          <article key={post.id} className="post-publication-progress">
            <Icon name="send" />
            <div>
              <strong>
                {post.state === "completed"
                  ? "Post uploaded"
                  : post.state === "failed"
                    ? "Post upload failed"
                    : post.state === "cancelled"
                      ? "Post cancelled"
                      : "Uploading post"}
              </strong>
              <span>{post.name}</span>
              {!["completed", "cancelled"].includes(post.state) && (
                <progress
                  value={post.progress}
                  max={100}
                  aria-label="Uploading post"
                />
              )}
              <span>{post.progress}%</span>
              {post.error && <span role="alert">{post.error}</span>}
              <div className="upload-tray-actions">
                {post.state === "failed" && (
                  <button
                    type="button"
                    onClick={() => postPublications.retry(post.id)}
                  >
                    Try again
                  </button>
                )}
                {["uploading", "failed"].includes(post.state) && (
                  <button
                    type="button"
                    onClick={() => postPublications.cancel(post.id)}
                  >
                    Cancel
                  </button>
                )}
                {post.href && <Link href={post.href}>View post</Link>}
                {["completed", "cancelled"].includes(post.state) && (
                  <button
                    type="button"
                    onClick={() => postPublications.dismiss(post.id)}
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
        {tasks.map((t) => (
          <article key={t.id}>
            <div className="upload-tray-preview">
              {t.type.startsWith("image/") ? (
                <MediaImage src={t.preview} alt="" />
              ) : t.type.startsWith("video/") ? (
                <video src={t.preview} controls preload="metadata" />
              ) : (
                <Icon name="file" />
              )}
            </div>
            <div>
              <strong>{t.name}</strong>
              <span>
                {(t.bytes / 1048576).toFixed(1)} MB ·{" "}
                {t.state === "pending"
                  ? "Ready to upload"
                  : t.state === "completed"
                    ? "Upload completed"
                    : t.state === "processing"
                      ? "Verifying file"
                      : t.state}
              </span>
              {["uploading", "processing"].includes(t.state) && (
                <progress
                  value={t.progress}
                  max={100}
                  aria-label={`Upload progress for ${t.name}`}
                />
              )}
              {t.error && <span role="alert">{t.error}</span>}
              <div className="upload-tray-actions">
                {["pending", "failed"].includes(t.state) && (
                  <button
                    type="button"
                    onClick={() => uploadManager.start(t.id)}
                  >
                    {t.state === "failed" ? "Try again" : "Upload"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    ["completed", "cancelled"].includes(t.state)
                      ? uploadManager.dismiss(t.id)
                      : uploadManager.cancel(t.id)
                  }
                >
                  {["completed", "cancelled"].includes(t.state)
                    ? "Dismiss"
                    : "Cancel"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}
