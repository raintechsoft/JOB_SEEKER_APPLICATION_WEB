"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { MessageAttachment, Role } from "@/types/domain";
import type { components } from "@/types/generated/application-wizard-v2";
import { apiConfig } from "@/services/api/config";
import { useCommunicationQuery } from "@/hooks/use-communication-query";
import { IconButton } from "@/components/ui/primitives";
import { formatBytes } from "./message-document";

type Resume = components["schemas"]["ApplicationResume"];

export function resumeToAttachment(item: Resume): MessageAttachment {
  const base = apiConfig.baseUrl.replace(/\/$/, "");
  return { id: item.id, name: item.name, type: item.mime, size: item.bytes, data: `${base}/media/${item.id}/download`, image: false };
}

export { ChatAttachment } from "./message-attachment";

export function MessageResumePicker({
  role,
  selectedId,
  disabled,
  onAttach,
}: {
  role: Role;
  selectedId?: string;
  disabled?: boolean;
  onAttach: (item: Resume) => void;
}) {
  const real = apiConfig.dataSource === "http";
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const library = useCommunicationQuery(["resume-library"], (s) => s.applicationDocuments.listResumes(), { enabled: real });
  const items = library.data ?? [];
  const profileHref = role === "professional" ? "/app/profile#profile-resume" : "/recruiter/profile";

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div className="message-resume-wrap" ref={wrap}>
      <IconButton
        icon="file"
        label="Attach resume"
        disabled={disabled}
        extra={open ? "is-open" : ""}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          if (real && items.length === 1 && items[0].id !== selectedId) {
            onAttach(items[0]);
            return;
          }
          setOpen(true);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
      />
      <div className="message-resume-picker" hidden={!open} role="dialog" aria-label="Attach a Skillora resume">
        {real && library.isError ? (
          <p className="message-resume-empty">
            Resumes couldn’t load.{" "}
            <button type="button" className="link" onClick={() => void library.refetch()}>
              Try again
            </button>
          </p>
        ) : real && !library.data ? (
          <p className="message-resume-empty">Loading resumes…</p>
        ) : !items.length ? (
          <p className="message-resume-empty">
            No resume is uploaded on Skillora yet.{" "}
            {role === "professional" ? (
              <Link href={profileHref} onClick={() => setOpen(false)}>
                Upload one from your profile
              </Link>
            ) : (
              "Upload a resume on your professional profile first."
            )}
          </p>
        ) : (
          <>
            <p className="message-resume-heading">{items.length === 1 ? "Attach this resume" : "Choose a resume"}</p>
            <ul className="resume-file-list" aria-label={items.length === 1 ? "Your resume" : "Your resumes"}>
              {items.map((item) => {
                const selected = item.id === selectedId;
                const ext = (item.name.split(".").pop() ?? "").toUpperCase().slice(0, 4);
                return (
                  <li key={item.id} className={"resume-file-card" + (selected ? " is-selected" : "")}>
                    <span className={"resume-file-badge is-" + ext.toLowerCase()} aria-hidden="true">
                      {ext || "FILE"}
                    </span>
                    <span className="resume-file-meta">
                      <strong title={item.name}>{item.name}</strong>
                      <small>{formatBytes(item.bytes)}</small>
                    </span>
                    {selected ? (
                      <span className="resume-file-selected" role="img" aria-label="Attached to this message" />
                    ) : (
                      <button
                        type="button"
                        className="resume-file-select"
                        aria-label={"Attach " + item.name}
                        onClick={() => {
                          onAttach(item);
                          setOpen(false);
                        }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
