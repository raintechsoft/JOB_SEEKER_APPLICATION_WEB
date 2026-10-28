import { z } from "zod";
import type { HttpClient } from "../api/client";
import { ApiError, fieldErrors, errorMessage } from "../api/client";
import {
  validateMedia,
  setMediaPolicy,
  type MediaPurpose,
  type MediaPolicy,
} from "@/lib/validation/profile";
import { uploadManager, uploadBytes, wait } from "./upload-manager";
import type { components } from "@/types/generated/api";
export type UploadedAsset = components["schemas"]["ManagedAsset"];
type Status = {
  id: string;
  state: string;
  expiresAt: string;
  failureCode: string | null;
  asset: UploadedAsset | null;
};
type Signed = {
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
};
type Authorization = {
  mode: "local" | "put" | "multipart" | "uploaded";
  chunkBytes: number;
  expiresAt: string;
  parts: { number: number; bytes: number; checksum?: string | null }[];
  upload: Signed | null;
};
export interface MediaService {
  upload(
    file: File,
    purpose: MediaPurpose,
    organization?: string,
    options?: { manual?: boolean; groupId?: string },
  ): Promise<UploadedAsset>;
  remove(id: string): Promise<void>;
  policy?(): Promise<MediaPolicy>;
}
const sha = async (blob: Blob) =>
  new Uint8Array(
    await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
  );
const forget = (key?: string) => {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* Browser persistence is optional. */
  }
};
function pruneRecovery() {
  try {
    let keys = Object.keys(localStorage).filter((key) =>
      key.startsWith("skillora.media.resume."),
    );
    for (const key of keys) {
      try {
        const value = JSON.parse(localStorage.getItem(key) ?? "null");
        if (
          !value?.expiresAt ||
          !Number.isFinite(Date.parse(value.expiresAt)) ||
          Date.parse(value.expiresAt) <= Date.now()
        )
          forget(key);
      } catch {
        forget(key);
      }
    }
    keys = Object.keys(localStorage).filter((key) =>
      key.startsWith("skillora.media.resume."),
    );
    for (const key of keys.slice(0, Math.max(0, keys.length - 255)))
      forget(key);
  } catch {
    /* Browser persistence is optional. */
  }
}
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
export function createMediaService(
  http: HttpClient,
  getUser?: () => Promise<{ user: { id: string } }>,
): MediaService {
  let policyRequest: Promise<MediaPolicy> | undefined;
  const policy = () =>
    (policyRequest ??= http
      .get<{ data: MediaPolicy }>("media/policy")
      .then((r) => {
        setMediaPolicy(r.data);
        uploadManager.concurrency = r.data.fileConcurrency;
        return r.data;
      })
      .catch((e) => {
        policyRequest = undefined;
        throw e;
      }));
  const sameFiles = new WeakMap<File, Map<string, Promise<UploadedAsset>>>();
  return {
    policy,
    upload(file, purpose, organization, options = {}) {
      const issue = validateMedia(file, purpose, Number.MAX_SAFE_INTEGER);
      if (issue) return Promise.reject(new Error(issue));
      if (organization) z.uuid().parse(organization);
      const scope = purpose + ":" + (organization ?? "");
      const previous = sameFiles.get(file)?.get(scope);
      if (previous) return previous;
      let assetId: string | undefined,
        initiationKey = crypto.randomUUID(),
        manifestKey: string | undefined;
      const promise = uploadManager.add(
        file,
        async (signal, progress) => {
          signal.throwIfAborted();
          const p = await policy();
          signal.throwIfAborted();
          const invalid = validateMedia(file, purpose);
          if (invalid) throw new Error(invalid);
          const session = getUser
            ? await getUser()
            : (await http.get<{ data: { user: { id: string } } }>("auth/me"))
                .data;
          signal.throwIfAborted();
          const sample = hex(
            await sha(
              new Blob([
                file.slice(0, 65536),
                file.slice(Math.max(0, file.size - 65536)),
              ]),
            ),
          );
          manifestKey =
            "skillora.media.resume." +
            hex(
              await sha(
                new Blob([
                  JSON.stringify([
                    session.user.id,
                    purpose,
                    organization ?? "",
                    file.name,
                    file.size,
                    file.lastModified,
                    sample,
                  ]),
                ]),
              ),
            );
          signal.throwIfAborted();
          pruneRecovery();
          if (!assetId) {
            try {
              const old = JSON.parse(
                localStorage.getItem(manifestKey) ?? "null",
              ) as { id?: string; key?: string } | null;
              if (old?.id && old?.key) {
                assetId = z.uuid().parse(old.id);
                initiationKey = z.uuid().parse(old.key);
              }
            } catch {
              forget(manifestKey);
            }
          }
          const retry = async <T>(operation: () => Promise<T>): Promise<T> => {
            for (let attempt = 0; ; attempt++) {
              signal.throwIfAborted();
              if (!navigator.onLine)
                await new Promise<void>((resolve, reject) => {
                  const done = () => {
                    window.removeEventListener("online", online);
                    signal.removeEventListener("abort", cancel);
                  };
                  const online = () => {
                    done();
                    resolve();
                  };
                  const cancel = () => {
                    done();
                    reject(new DOMException("Upload cancelled.", "AbortError"));
                  };
                  window.addEventListener("online", online, { once: true });
                  signal.addEventListener("abort", cancel, { once: true });
                });
              try {
                return await operation();
              } catch (e) {
                if (signal.aborted) throw e;
                const code =
                  typeof e === "object" && e !== null && "status" in e
                    ? Number(e.status)
                    : 0;
                if (
                  attempt >= p.retries ||
                  [401, 404, 412, 419, 422].includes(code) ||
                  (e instanceof ApiError && [403, 409].includes(code))
                )
                  throw e;
                const delay =
                  e instanceof ApiError && e.retryAfterSeconds
                    ? e.retryAfterSeconds * 1000
                    : Math.min(15000, 500 * 2 ** attempt) + Math.random() * 350;
                await wait(delay, signal);
              }
            }
          };
          try {
            if (assetId) {
              const current = await retry(() =>
                http.get<{ data: Status }>(`media/${assetId}`),
              ).catch((error) => {
                if (!(error instanceof ApiError) || error.status !== 404)
                  throw error;
                forget(manifestKey);
                return {
                  data: {
                    id: assetId!,
                    state: "rejected",
                    expiresAt: new Date().toISOString(),
                    failureCode: null,
                    asset: null,
                  } as Status,
                };
              });
              if (current.data.asset) {
                progress(100);
                return current.data.asset;
              }
              if (
                ["cancelled", "deleting", "rejected"].includes(
                  current.data.state,
                ) ||
                new Date(current.data.expiresAt).getTime() <= Date.now()
              ) {
                assetId = undefined;
                initiationKey = crypto.randomUUID();
              }
            }
            if (!assetId) {
              const r = await retry(() =>
                http.post<{ data: components["schemas"]["MediaPending"] }>(
                  "media",
                  {
                    name: file.name,
                    mime: file.type,
                    bytes: file.size,
                    purpose,
                    initiationKey,
                    ...(organization ? { organization_id: organization } : {}),
                  },
                ),
              );
              assetId = r.data.id;
              try {
                localStorage.setItem(
                  manifestKey,
                  JSON.stringify({
                    id: assetId,
                    key: initiationKey,
                    expiresAt: r.data.expires_at,
                  }),
                );
              } catch {
                /* In-memory retry remains available when browser storage is unavailable. */
              }
            }
            signal.throwIfAborted();
            let current = (
              await retry(() => http.get<{ data: Status }>(`media/${assetId}`))
            ).data;
            if (
              !["uploaded", "processing", "accepted"].includes(current.state)
            ) {
              const authorize = async () =>
                (
                  await retry(() =>
                    http.post<{ data: Authorization }>(
                      `media/${assetId}/authorization`,
                    ),
                  )
                ).data;
              const a = await authorize();
              if (a.mode === "local")
                await retry(() =>
                  http.upload(`media/${assetId}/content`, file, {
                    signal,
                    onProgress: (n) => progress(Math.min(94, n * 94)),
                  }),
                );
              else if (a.mode === "put") {
                let first = true;
                await retry(async () => {
                  const fresh = first
                    ? ((first = false), a)
                    : await authorize();
                  if (fresh.mode === "uploaded") return;
                  try {
                    await uploadBytes(
                      fresh.upload!.url,
                      file,
                      fresh.upload!.headers,
                      signal,
                      (n) => progress(Math.min(94, (n / file.size) * 94)),
                    );
                  } catch (error) {
                    if (
                      typeof error !== "object" ||
                      error === null ||
                      !("status" in error) ||
                      error.status !== 412
                    )
                      throw error;
                    // A lost successful PUT response is resolved by authoritative finalization.
                  }
                });
              } else if (a.mode === "multipart") {
                const count = Math.ceil(file.size / a.chunkBytes),
                  done = new Map(
                    a.parts.map((part) => [part.number, part.bytes]),
                  );
                let next = 1;
                const update = () =>
                  progress(
                    Math.min(
                      94,
                      ([...done.values()].reduce((n, v) => n + v, 0) /
                        file.size) *
                        94,
                    ),
                  );
                update();
                const outcomes = await Promise.allSettled(
                  Array.from(
                    { length: Math.min(p.partConcurrency, count) },
                    async () => {
                      for (;;) {
                        const number = next++;
                        if (number > count) return;
                        const chunk = file.slice(
                          (number - 1) * a.chunkBytes,
                          Math.min(number * a.chunkBytes, file.size),
                        );
                        const checksum = btoa(
                          String.fromCharCode(...(await sha(chunk))),
                        );
                        if (
                          done.get(number) === chunk.size &&
                          a.parts.find((part) => part.number === number)
                            ?.checksum === checksum
                        )
                          continue;
                        await retry(async () => {
                          const signed = (
                            await http.post<{ data: Signed }>(
                              `media/${assetId}/parts/sign`,
                              { number, checksum },
                            )
                          ).data;
                          await uploadBytes(
                            signed.url,
                            chunk,
                            signed.headers,
                            signal,
                            (n) => {
                              done.set(number, Math.min(n, chunk.size));
                              update();
                            },
                          );
                        });
                        done.set(number, chunk.size);
                        update();
                      }
                    },
                  ),
                );
                const failed = outcomes.find(
                  (result) => result.status === "rejected",
                );
                if (failed?.status === "rejected") throw failed.reason;
              }
            }
            signal.throwIfAborted();
            progress(95, true);
            const completed = (
              await retry(() =>
                http.post<{ data: UploadedAsset | Status }>(
                  `media/${assetId}/complete`,
                ),
              )
            ).data;
            if ("url" in completed) {
              if (manifestKey) forget(manifestKey);
              return completed;
            }
            for (;;) {
              signal.throwIfAborted();
              current = (
                await retry(() =>
                  http.get<{ data: Status }>(`media/${assetId}`),
                )
              ).data;
              if (current.asset) {
                if (manifestKey) forget(manifestKey);
                return current.asset;
              }
              if (
                ["rejected", "cancelled", "deleting"].includes(current.state) ||
                current.failureCode
              )
                throw new Error(
                  "The file could not be verified. Retry or choose another file.",
                );
              await wait(2000, signal);
            }
          } catch (e) {
            if (signal.aborted && assetId) {
              void http.post(`media/${assetId}/abort`).catch(() => undefined);
              if (manifestKey) forget(manifestKey);
            }
            if (e instanceof ApiError)
              throw new Error(fieldErrors(e).file?.[0] ?? errorMessage(e));
            throw e;
          }
        },
        options.manual === true,
        () => {
          if (assetId)
            void http.post(`media/${assetId}/abort`).catch(() => undefined);
          forget(manifestKey);
        },
        options.groupId,
      );
      const entries =
        sameFiles.get(file) ?? new Map<string, Promise<UploadedAsset>>();
      entries.set(scope, promise);
      sameFiles.set(file, entries);
      void promise.catch(() => entries.delete(scope));
      return promise;
    },
    async remove(id) {
      z.uuid().parse(id);
      await http.delete(`media/${id}`);
    },
  };
}
