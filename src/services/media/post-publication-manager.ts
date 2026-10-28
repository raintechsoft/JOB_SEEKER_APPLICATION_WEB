import { uploadManager } from "./upload-manager";
import { ApiError, errorMessage } from "@/services/api/client";

export type Publication = {
  id: string;
  draftId: string;
  name: string;
  state: "uploading" | "publishing" | "failed" | "completed" | "cancelled";
  progress: number;
  error?: string;
  href?: string;
};
type Task = Publication & {
  active: boolean;
  released?: boolean;
  controller: AbortController;
  run: (
    id: string,
    signal: AbortSignal,
    publishing: () => void,
  ) => Promise<string>;
  release: () => void;
};
const empty: Publication[] = [];
/** Owns an entire publication across route changes, including retries and final acknowledgement. */
class PostPublicationManager {
  private tasks = new Map<string, Task>();
  private listeners = new Set<() => void>();
  private snapshot: Publication[] = empty;
  constructor() {
    uploadManager.subscribe(() => this.emit());
    uploadManager.onReset(() => this.clear());
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => empty;
  private emit() {
    const children = uploadManager.getSnapshot();
    this.snapshot = [...this.tasks.values()].map((task) => {
      if (task.active && task.state !== "publishing") {
        const files = children.filter((file) => file.groupId === task.id);
        const total = files.reduce((n, file) => n + file.bytes, 0);
        if (total)
          task.progress = Math.max(
            task.progress,
            Math.floor(
              (files.reduce((n, file) => n + file.bytes * file.progress, 0) /
                total) *
                0.9,
            ),
          );
        const failed = files.find((file) => file.state === "failed");
        task.state = failed ? "failed" : "uploading";
        task.error = failed?.error;
      }
      const { id, draftId, name, state, progress, error, href } = task;
      return { id, draftId, name, state, progress, error, href };
    });
    for (const listener of this.listeners) listener();
  }
  start(draftId: string, name: string, run: Task["run"], release: () => void) {
    const previous = [...this.tasks.values()].find(
      (task) => task.draftId === draftId && task.state !== "cancelled",
    );
    if (previous) return previous.id;
    const id = crypto.randomUUID();
    const task: Task = {
      id,
      draftId,
      name,
      state: "uploading",
      progress: 0,
      active: false,
      controller: new AbortController(),
      run,
      release,
    };
    this.tasks.set(id, task);
    this.execute(task);
    return id;
  }
  private execute(task: Task) {
    task.active = true;
    task.state = "uploading";
    task.error = undefined;
    this.emit();
    void Promise.resolve()
      .then(() =>
        task.run(task.id, task.controller.signal, () => {
          task.state = "publishing";
          task.progress = 95;
          this.emit();
        }),
      )
      .then((href) => {
        if (task.controller.signal.aborted) return;
        task.active = false;
        task.state = "completed";
        task.progress = 100;
        task.href = href;
        this.release(task);
        this.releaseFiles(task.id);
        this.emit();
      })
      .catch((error) => {
        if (task.controller.signal.aborted) return;
        task.active = false;
        task.state = "failed";
        task.error =
          error instanceof ApiError
            ? errorMessage(error)
            : error instanceof Error
              ? error.message
              : "Your post could not be uploaded. Retry when ready.";
        this.emit();
      });
  }
  retry(id: string) {
    const task = this.tasks.get(id);
    if (!task || task.state !== "failed") return;
    if (task.active) {
      task.state = "uploading";
      task.error = undefined;
      for (const file of uploadManager.getSnapshot())
        if (file.groupId === id && file.state === "failed")
          uploadManager.start(file.id);
      this.emit();
    } else this.execute(task);
  }
  private releaseFiles(id: string) {
    for (const file of uploadManager.getSnapshot())
      if (file.groupId === id) uploadManager.dismiss(file.id);
  }
  private release(task: Task) {
    if (!task.released) {
      task.released = true;
      try {
        task.release();
      } catch {
        /* Cleanup cannot undo an acknowledged publication. */
      }
    }
  }
  cancel(id: string) {
    const task = this.tasks.get(id);
    if (!task || task.state === "publishing" || task.state === "completed")
      return;
    task.controller.abort();
    task.active = false;
    task.state = "cancelled";
    this.release(task);
    this.releaseFiles(id);
    this.emit();
  }
  dismiss(id: string) {
    const task = this.tasks.get(id);
    if (!task) return;
    if (!["completed", "cancelled"].includes(task.state)) return;
    this.tasks.delete(id);
    this.emit();
  }
  clear() {
    const tasks = [...this.tasks.values()];
    this.tasks.clear();
    for (const task of tasks) {
      task.controller.abort();
      this.release(task);
      this.releaseFiles(task.id);
    }
    this.emit();
  }
}
export const postPublications = new PostPublicationManager();
