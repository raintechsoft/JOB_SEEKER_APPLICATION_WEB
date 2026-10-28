"use client";
import { useSyncExternalStore } from "react";
import { uploadManager } from "@/services/media/upload-manager";
import { Icon } from "@/components/ui/icon";
import { MediaImage } from "@/components/ui/media-image";
import { useModalStore } from "@/stores/modal-store";
import Link from "next/link";
import { postPublications } from "@/services/media/post-publication-manager";
export function UploadTray({ insideModal = false }: { insideModal?: boolean }) {
  const modalOpen = useModalStore((state) => state.open);
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
  if ((!tasks.length && !posts.length) || modalOpen !== insideModal)
    return null;
  const total = tasks.reduce((n, t) => n + t.bytes, 0),
    progress = Math.round(
      tasks.reduce((n, t) => n + t.bytes * t.progress, 0) / Math.max(1, total),
    );
  return (
    <aside className="upload-tray" aria-label="Media uploads">
      <header>
        <strong>Uploads</strong>
        {!posts.length && <span>{progress}%</span>}
      </header>
      <div className="upload-tray-list">
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
                    Retry
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
                    {t.state === "failed" ? "Retry" : "Upload"}
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
