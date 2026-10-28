import type { UploadedAsset } from "./media.http";
export type UploadState =
  "pending" | "uploading" | "processing" | "completed" | "failed" | "cancelled";
export type UploadTask = {
  id: string;
  name: string;
  bytes: number;
  type: string;
  preview: string;
  state: UploadState;
  progress: number;
  error?: string;
  result?: UploadedAsset;
  groupId?: string;
};
type Task = UploadTask & {
  controller: AbortController;
  run: (
    signal: AbortSignal,
    progress: (n: number, processing?: boolean) => void,
  ) => Promise<UploadedAsset>;
  resolve: (a: UploadedAsset) => void;
  reject: (e: Error) => void;
  started: boolean;
  cancelUpload?: () => void;
};
const empty: UploadTask[] = [];
/** Browser-lifetime queue. Navigation does not own transfer cancellation/completion. */
class UploadManager {
  private tasks = new Map<string, Task>();
  private listeners = new Set<() => void>();
  private snapshot: UploadTask[] = empty;
  private active = 0;
  private resetListeners = new Set<() => void>();
  onReset(fn: () => void) {
    this.resetListeners.add(fn);
    return () => {
      this.resetListeners.delete(fn);
    };
  }
  private editIntents = new Map<string, symbol>();
  claimEdit(key: string) {
    const intent = Symbol(key);
    this.editIntents.set(key, intent);
    return () => this.editIntents.get(key) === intent;
  }
  concurrency = 1;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => empty;
  private emit() {
    this.snapshot = [...this.tasks.values()].map(
      ({
        id,
        name,
        bytes,
        type,
        preview,
        state,
        progress,
        error,
        result,
        groupId,
      }) => ({
        id,
        name,
        bytes,
        type,
        preview,
        state,
        progress,
        error,
        result,
        groupId,
      }),
    );
    for (const fn of this.listeners) fn();
  }
  add(
    file: File,
    run: Task["run"],
    manual: boolean,
    cancelUpload?: () => void,
    groupId?: string,
  ) {
    const id = crypto.randomUUID();
    const promise = new Promise<UploadedAsset>((resolve, reject) => {
      this.tasks.set(id, {
        id,
        name: file.name,
        bytes: file.size,
        type: file.type,
        preview: URL.createObjectURL(file),
        state: "pending",
        progress: 0,
        controller: new AbortController(),
        run,
        resolve,
        reject,
        started: !manual,
        cancelUpload,
        groupId,
      });
    });
    this.emit();
    this.pump();
    return promise;
  }
  start(id: string) {
    const t = this.tasks.get(id);
    if (!t || !["pending", "failed"].includes(t.state)) return;
    t.state = "pending";
    t.started = true;
    t.error = undefined;
    t.controller = new AbortController();
    this.emit();
    this.pump();
  }
  cancel(id: string) {
    const t = this.tasks.get(id);
    if (!t || ["completed", "cancelled"].includes(t.state)) return;
    t.controller.abort();
    t.cancelUpload?.();
    t.state = "cancelled";
    t.reject(new DOMException("Upload cancelled.", "AbortError"));
    this.emit();
  }
  dismiss(id: string) {
    const t = this.tasks.get(id);
    if (!t) return;
    if (!["completed", "cancelled"].includes(t.state)) this.cancel(id);
    URL.revokeObjectURL(t.preview);
    this.tasks.delete(id);
    this.emit();
  }
  clear() {
    for (const reset of this.resetListeners) reset();
    this.editIntents.clear();
    for (const id of this.tasks.keys()) this.dismiss(id);
  }
  private pump() {
    for (const t of this.tasks.values()) {
      if (this.active >= this.concurrency) break;
      if (t.state !== "pending" || !t.started) continue;
      t.state = "uploading";
      this.active++;
      this.emit();
      void t
        .run(t.controller.signal, (n, processing = false) => {
          if (t.controller.signal.aborted) return;
          t.progress = Math.max(0, Math.min(100, n));
          t.state = processing ? "processing" : "uploading";
          this.emit();
        })
        .then((a) => {
          if (t.controller.signal.aborted) return;
          t.state = "completed";
          t.progress = 100;
          t.result = a;
          this.emit();
          t.resolve(a);
        })
        .catch((e) => {
          if (t.controller.signal.aborted) return;
          t.state = "failed";
          t.error =
            e instanceof Error ? e.message : "Upload failed. Retry or cancel.";
        })
        .finally(() => {
          this.active--;
          this.emit();
          this.pump();
        });
    }
  }
}
export const uploadManager = new UploadManager();
export function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const cancel = () => {
      clearTimeout(timer);
      reject(new DOMException("Upload cancelled.", "AbortError"));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    signal.addEventListener("abort", cancel, { once: true });
  });
}
/** No Laravel credentials/cookies are sent to S3. */
export function uploadBytes(
  url: string,
  body: Blob,
  headers: Record<string, string>,
  signal: AbortSignal,
  progress: (bytes: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const r = new XMLHttpRequest(),
      abort = () => r.abort();
    r.open("PUT", url);
    r.withCredentials = false;
    r.timeout = 180000;
    for (const [k, v] of Object.entries(headers)) r.setRequestHeader(k, v);
    signal.addEventListener("abort", abort, { once: true });
    const done = () => signal.removeEventListener("abort", abort);
    r.upload.onprogress = (e) => progress(e.loaded);
    r.onload = () => {
      done();
      if (r.status >= 200 && r.status < 300) resolve();
      else
        reject(
          Object.assign(
            new Error(
              `Upload failed (${r.status}). Retry to request fresh authorization.`,
            ),
            { status: r.status },
          ),
        );
    };
    r.onerror = r.ontimeout = () => {
      done();
      reject(new Error("The connection was interrupted. Retry the upload."));
    };
    r.onabort = () => {
      done();
      reject(new DOMException("Upload cancelled.", "AbortError"));
    };
    r.send(body);
  });
}
