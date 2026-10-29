"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDrop } from "@/components/ui/file-drop";
import { ApiError, errorMessage } from "@/services/api/client";
import { Icon } from "@/components/ui/icon";
import { mediaRules } from "@/lib/validation/profile";
import { downloadBlob } from "@/lib/utils/files";
import {
  validateApplicationResume,
  type ApplicationDocumentContext,
  type createApplicationDocumentService,
} from "@/services/applications/application-documents.http";

type Props = {
  context: ApplicationDocumentContext;
  service: Pick<
    ReturnType<typeof createApplicationDocumentService>,
    "uploadResume" | "previewResume"
  > &
    Partial<
      Pick<ReturnType<typeof createApplicationDocumentService>, "removeResume">
    >;
  onResume: (id: string | null) => Promise<void>;
  onPortfolio: (included: boolean) => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
  errors?: { resume?: string; portfolio?: string };
  beforeUpload?: () => boolean;
};

/** A5 owns mounting and draft saves. Local selection is immediate; only a confirmed save is shared. */
export function ApplicationDocumentsStep(props: Props) {
  return <DocumentSelection key={props.context.draftId} {...props} />;
}

function DocumentSelection({
  context,
  service,
  onResume,
  onPortfolio,
  onBusyChange,
  errors,
  beforeUpload,
}: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const selection = useRef(0);
  const errorId = useId();
  const portfolioErrorId = useId();
  const inputId = useId();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    onBusyChange?.(true);
    setError("");
    try {
      await action();
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error && !("status" in e) ? e.message : errorMessage(e),
        );
    } finally {
      lock.current = false;
      onBusyChange?.(false);
      if (mounted.current) setPending(false);
    }
  }

  /** Choosing a file uploads it to managed storage straight away and selects it for this application. */
  function choose(files: FileList | null) {
    if (!files || lock.current) return;
    const list = Array.from(files),
      issue = validateApplicationResume(list);
    if (fileRef.current) fileRef.current.value = "";
    if (issue) {
      setError(issue);
      fileRef.current?.focus();
      return;
    }
    if (beforeUpload && !beforeUpload()) return;
    const intent = ++selection.current;
    void run(async () => {
      const asset = await service.uploadResume(list);
      if (!mounted.current || intent !== selection.current) return;
      await onResume(asset.id);
    });
  }

  type Resume = NonNullable<ApplicationDocumentContext["resume"]>;
  // Files removed in this session disappear at once; the server context drops them on its next refresh.
  const [removed, setRemoved] = useState<string[]>([]);
  const libraryIds = new Set((context.library ?? []).map((r) => r.id));
  const items: Resume[] = [];
  for (const r of [context.resume, context.savedResume, ...(context.library ?? [])]) {
    if (r && !items.some((x) => x.id === r.id) && !removed.includes(r.id)) items.push(r);
  }

  /** The cross removes a file from the list and deletes it from storage, unless something else still uses it. */
  function remove(item: Resume) {
    void run(async () => {
      if (context.resume?.id === item.id) await onResume(null);
      if (item.id === context.savedResume?.id || !service.removeResume) return;
      try {
        await service.removeResume(item.id);
      } catch (e) {
        // 404: not in the library (an older upload); 409: still in use, so the server keeps the file.
        if (!(e instanceof ApiError && (e.status === 404 || e.status === 409))) throw e;
      }
      if (mounted.current) setRemoved((list) => [...list, item.id]);
    });
  }

  const download = (resume: Resume) =>
    run(async () => {
      const blob = await service.previewResume(resume.id);
      if (mounted.current) downloadBlob(resume.name, blob);
    });
  const accept = mediaRules.resume.extensions.map((v) => `.${v}`).join(",");
  const hint = `${mediaRules.resume.extensions.map((v) => v.toUpperCase()).join(", ")} · up to ${Math.round((mediaRules.resume.max / 1048576) * 10) / 10} MB. Uploading here keeps your saved profile resume unchanged.`;
  const extension = (name: string) => (name.split(".").pop() ?? "").toUpperCase().slice(0, 4);

  return (
    <section
      className="grid gap-5"
      aria-label="Application documents"
      aria-busy={pending}
    >
      <div className="grid gap-3">
        <div>
        <h2 className="text-lg font-semibold">
          Resume
          {context.requirements.requireResume && (
            <span aria-hidden="true"> *</span>
          )}
        </h2>
        <small className="text-xs text-muted-foreground">{hint}</small>
        </div>


        {context.resumeIssue && <p role="alert">{context.resumeIssue}</p>}
        {items.length ? (
          <>
            <ul className="resume-file-list" aria-label="Your resumes">
              {items.map((item) => {
                const selected = context.resume?.id === item.id;
                const saved = item.id === context.savedResume?.id;
                const ext = extension(item.name);
                return (
                  <li key={item.id} className={"resume-file-card" + (selected ? " is-selected" : "")}>
                    <span className={"resume-file-badge is-" + ext.toLowerCase()} aria-hidden="true">{ext || "FILE"}</span>
                    <span className="resume-file-meta">
                      <strong title={item.name}>{item.name}</strong>
                      <small>{formatBytes(item.bytes)}{saved ? " · Saved profile resume" : ""}</small>
                    </span>
                    <button type="button" className="resume-file-action" aria-label={"Download " + item.name} disabled={pending} onClick={() => download(item)}>
                      <Icon name="download" />
                    </button>
                    {selected ? (
                      <span className="resume-file-selected" role="img" aria-label="Selected for this application" />
                    ) : (
                      <button type="button" className="resume-file-select" aria-label={"Use " + item.name + " for this application"} disabled={pending} onClick={() => run(() => onResume(item.id))} />
                    )}
                    {!saved && (libraryIds.has(item.id) || selected) && (
                      <button type="button" className="resume-file-action is-remove" aria-label={"Remove " + item.name} disabled={pending} onClick={() => remove(item)}>
                        <Icon name="close" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                id={inputId}
                className="sr-only"
                type="file"
                accept={accept}
                tabIndex={-1}
                aria-label="Upload another resume"
                aria-invalid={!!(error || errors?.resume) || undefined}
                aria-describedby={error || errors?.resume ? errorId : undefined}
                onChange={(e) => choose(e.target.files)}
              />
              <Button icon="upload" disabled={pending} onClick={() => fileRef.current?.click()}>
                {pending ? "Uploading…" : "Upload resume"}
              </Button>
            </div>
          </>
        ) : (
          <FileDrop
            id={inputId}
            inputRef={fileRef}
            label=""
            srLabel="Choose a resume"
            accept={accept}
            disabled={pending}
            invalid={!!(error || errors?.resume)}
            describedBy={error || errors?.resume ? errorId : undefined}
            onFiles={choose}
            hint={pending && "Uploading your resume…" }
          />
        )}
        {errors?.resume && !error && (
          <p id={errorId} role="alert" className="field-error">
            {errors.resume}
          </p>
        )}
      </div>
      <div className="grid gap-3">
        <h2 className="text-lg font-semibold">
          Portfolio
          {context.requirements.requirePortfolio && (
            <span aria-hidden="true"> *</span>
          )}
        </h2>
        <label className="flex items-center gap-2">
          <input
            name="documents.includePortfolio"
            type="checkbox"
            checked={context.includePortfolio}
            disabled={
              pending || (!context.portfolio.ready && !context.includePortfolio)
            }
            aria-invalid={!!errors?.portfolio}
            aria-describedby={errors?.portfolio ? portfolioErrorId : undefined}
            onChange={(e) => run(() => onPortfolio(e.target.checked))}
          />
          Include my current portfolio
        </label>
        {errors?.portfolio && (
          <p id={portfolioErrorId} role="alert" className="field-error">
            {errors.portfolio}
          </p>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}

const formatBytes = (bytes: number) =>
  bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
