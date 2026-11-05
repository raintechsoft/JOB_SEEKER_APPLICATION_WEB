"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { SubmittedDocumentViewer } from "@/features/applications/application-sharing-details";
import { useShortlistDialogs } from "@/features/talent/dialogs";
import { Icon } from "@/components/ui/icon";
import { Button, IconButton, LinkButton } from "@/components/ui/primitives";
import { useServiceQuery } from "@/hooks/use-services";
import { modal } from "@/stores/modal-store";
import { applicantProfileHref, type ResponseItem } from "@/services/recruiting/recruiting.service";
import type { Id } from "@/types/domain";

type Props = {
  item: ResponseItem;
  onContact: () => void;
  onMessage: () => void;
  onMarkViewed: (id: Id) => void | Promise<void>;
  /** Table cells use icons only; card/aside keeps labeled buttons. */
  iconOnly?: boolean;
};

export function openResume(item: ResponseItem) {
  const resume = item.sharing?.attachments.find((file) => file.kind === "resume");
  if (!resume) return;
  modal.show(
    "Resume · " + item.profile.name,
    <SubmittedDocumentViewer file={resume} applicationId={item.application.id} reviewer />,
    "project",
  );
}

export function CandidateProfileActions({ item, onContact, onMessage, onMarkViewed, iconOnly = false }: Props) {
  const a = item.application;
  const p = item.profile;
  const profileHref = applicantProfileHref(item);
  const resume = item.sharing?.attachments.find((file) => file.kind === "resume");
  const shortlists = useShortlistDialogs();
  const { data: lists } = useServiceQuery(["shortlists"], (s) => s.talent.listShortlists());
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  // Profile id is the professional id used by messaging and shortlist membership writes.
  const candidateId = p.id || a.candidate;
  const membershipIds = new Set([p.id, a.candidate].filter(Boolean));
  const saved = !!lists?.some(
    (list) =>
      list.candidates.some((id) => membershipIds.has(id)) ||
      list.people?.some((person) => membershipIds.has(person.id)),
  );
  const saveLabel = saved ? "Manage saved lists for " + p.name : "Save " + p.name;

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  function saveProfile() {
    void shortlists.choose(candidateId);
  }

  return (
    <div className={"response-profile-actions" + (iconOnly ? " is-icon-only" : "")}>
      <div className="response-profile-actions-list">
        {iconOnly ? (
          <>
            <IconButton icon="phone" label={"Contact " + p.name} onClick={onContact} />
            <IconButton icon="message" label={"Message " + p.name} onClick={onMessage} />
            <Link className="iconbtn" href={profileHref} aria-label={"View profile for " + p.name} title={"View profile for " + p.name} onClick={() => void onMarkViewed(a.id)}>
              <Icon name="user" />
            </Link>
            <IconButton
              icon="bookmark"
              label={saveLabel}
              extra={"response-save-btn" + (saved ? " is-saved" : "")}
              iconClassName={saved ? "is-filled-bookmark" : undefined}
              aria-pressed={saved}
              onClick={saveProfile}
            />
          </>
        ) : (
          <>
            <Button variant="sm" icon="phone" onClick={onContact}>
              Contact
            </Button>
            <Button variant="text sm" icon="message" onClick={onMessage}>
              Message
            </Button>
            <LinkButton variant="text sm" icon="user" href={profileHref} onClick={() => void onMarkViewed(a.id)}>
              View profile
            </LinkButton>
            {resume ? (
              <Button
                variant="sm"
                icon="eye"
                className="response-resume-download"
                onClick={() => openResume(item)}
                aria-label={"View submitted resume: " + resume.name}
                title={resume.name}
              >
                View resume
              </Button>
            ) : null}
            <Button
              variant={"text sm response-save-btn" + (saved ? " is-saved" : "")}
              icon="bookmark"
              className={saved ? "is-saved" : undefined}
              aria-pressed={saved}
              aria-label={saveLabel}
              onClick={saveProfile}
            >
              {saved ? "Saved" : "Save"}
            </Button>
          </>
        )}
      </div>
      <div className="response-profile-menu" ref={root}>
        <IconButton
          icon="more"
          label={"More actions for " + p.name}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((value) => !value)}
        />
        {open ? (
          <div className="response-profile-menu-panel" id={menuId} role="menu" aria-label={"Actions for " + p.name}>
            <button type="button" role="menuitem" onClick={() => run(onContact)}>
              <Icon name="phone" />
              Contact
            </button>
            <button type="button" role="menuitem" onClick={() => run(onMessage)}>
              <Icon name="message" />
              Message
            </button>
            <Link
              role="menuitem"
              href={profileHref}
              onClick={() => {
                setOpen(false);
                void onMarkViewed(a.id);
              }}
            >
              <Icon name="user" />
              View profile
            </Link>
            {!iconOnly && resume ? (
              <button type="button" role="menuitem" onClick={() => run(() => openResume(item))}>
                <Icon name="eye" />
                View resume
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              className={"response-save-btn" + (saved ? " is-saved" : "")}
              aria-pressed={saved}
              onClick={() => run(saveProfile)}
            >
              <Icon name="bookmark" className={saved ? "is-filled-bookmark" : undefined} />
              {saved ? "Saved" : "Save"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
