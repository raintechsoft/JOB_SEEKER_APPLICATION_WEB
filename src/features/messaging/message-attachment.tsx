"use client";

import { useEffect, useRef, useState } from "react";
import type { MessageAttachment } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useServices } from "@/hooks/use-services";
import { downloadBlob } from "@/lib/utils/files";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { documentKind, documentMeta, isPdfAttachment } from "./message-document";
import { previewPdf } from "./pdf-first-page";

const blobs = new Map<string, Promise<Blob>>();

function loadBlob(a: MessageAttachment, real: boolean, fetchBlob: (id: string) => Promise<Blob>) {
  const existing = blobs.get(a.id);
  if (existing) return existing;
  const pending = (!real || /^data:/.test(a.data || "") ? fetch(a.data).then((response) => response.blob()) : fetchBlob(a.id)).then((blob) =>
    blob.type && blob.type !== "application/octet-stream" ? blob : new Blob([blob], { type: a.type }),
  );
  blobs.set(a.id, pending);
  return pending;
}

function MessagePdfViewer({ name, blob }: { name: string; blob: Blob }) {
  const [url] = useState(() => URL.createObjectURL(blob));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="document-viewer">
      <div className="document-viewer-bar">
        <span className="document-viewer-name" title={name}>
          <Icon name="file" />
          {name}
        </span>
        <Button variant="primary sm" icon="download" onClick={() => downloadBlob(name, blob)}>
          Download
        </Button>
      </div>
      <iframe className="document-viewer-frame" src={url} title={"Document: " + name} />
    </div>
  );
}

export function ChatAttachment({ a, real }: { a: MessageAttachment; real: boolean }) {
  const services = useServices();
  const root = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ image?: string; pages?: number }>({});
  const kind = documentKind(a.name, a.type);
  const pdf = isPdfAttachment(a.name, a.type);
  const getBlob = (id: string) => services.applicationDocuments.previewResume(id);

  useEffect(() => {
    const el = root.current;
    if (!el || !pdf) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { rootMargin: "120px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pdf]);

  useEffect(() => {
    if (!visible || !pdf || a.image) return;
    let cancelled = false;
    void loadBlob(a, real, getBlob)
      .then(async (blob) => {
        if (cancelled) return;
        const rendered = await previewPdf(a.id, blob);
        if (!cancelled && rendered) setPreview(rendered);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Preview is keyed to the attachment id; the fetch helper is stable for this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id, a.data, a.image, pdf, real, visible]);

  if (a.image && (!real || /^data:/.test(a.data || ""))) {
    return (
      <a className="message-image" href={a.data} download={a.name}>
        {/* eslint-disable-next-line @next/next/no-img-element -- attachment data URL */}
        <img src={a.data} alt={a.name} loading="lazy" />
      </a>
    );
  }

  const open = () => {
    if (busy) return;
    setBusy(true);
    void loadBlob(a, real, getBlob)
      .then((blob) => {
        if (pdf) modal.show(a.name, <MessagePdfViewer blob={blob} name={a.name} />, "project");
        else downloadBlob(a.name, blob);
      })
      .catch(() => toast("This file couldn’t be opened.", "error"))
      .finally(() => setBusy(false));
  };

  if (!pdf) {
    return (
      <button type="button" className="message-file" disabled={busy} onClick={open} aria-label={"Download " + a.name} aria-busy={busy || undefined}>
        <span className={"resume-file-badge is-" + kind.toLowerCase()} aria-hidden="true">
          {kind}
        </span>
        <span>
          <strong title={a.name}>{a.name}</strong>
          <small>{busy ? "Downloading…" : documentMeta(kind, a.size)}</small>
        </span>
        <Icon name="download" />
      </button>
    );
  }

  return (
    <button
      type="button"
      className="message-doc"
      ref={root}
      disabled={busy}
      onClick={open}
      aria-label={"Open " + a.name}
      aria-busy={busy || (visible && !preview.image) || undefined}
    >
      <span className={"message-doc-preview" + (preview.image ? " has-page" : "")}>
        {preview.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- generated first-page thumbnail
          <img src={preview.image} alt="" />
        ) : (
          <span className={"resume-file-badge is-" + kind.toLowerCase()}>{kind}</span>
        )}
      </span>
      <span className="message-doc-foot">
        <span className={"resume-file-badge is-" + kind.toLowerCase()} aria-hidden="true">
          {kind}
        </span>
        <span className="message-doc-copy">
          <strong title={a.name}>{a.name}</strong>
          <small>{busy ? "Opening…" : documentMeta(kind, a.size, preview.pages)}</small>
        </span>
      </span>
    </button>
  );
}
