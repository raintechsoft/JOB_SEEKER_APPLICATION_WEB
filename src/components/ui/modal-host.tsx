"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useModalStore } from "@/stores/modal-store";
import { cn } from "@/lib/utils/text";
import { IconButton } from "./primitives";
import {UploadTray} from "@/features/workspace/upload-tray";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";

/** Editors opt in to "Save" from the unsaved-changes dialog by marking their form. */
const SAVABLE_FORM = "form[data-profile-editor], form[data-unsaved-guard]";

/**
 * The single application dialog (`<dialog id="modal">`), rendered with the native modal element so
 * focus trapping, Escape handling and inertness come from the browser. Variants map to the
 * prototype's `notification-sheet`, `project-sheet` and `following-sheet` classes.
 */
export function ModalHost() {
  const { open, title, content, variant, version, blocking, confirmingDiscard, close, requestClose, keepEditing, discard } = useModalStore();
  const ref = useRef<HTMLDialogElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      lastFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
    } else if (!open && dialog.open) dialog.close();
  }, [open, version]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onClose = () => {
      if (useModalStore.getState().open) close();
      if (lastFocus.current?.isConnected) lastFocus.current.focus();
    };
    const onCancel = (e: Event) => {
      if (useModalStore.getState().dirty || useModalStore.getState().blocking) {
        e.preventDefault();
        requestClose();
      }
    };
    dialog.addEventListener("close", onClose);
    dialog.addEventListener("cancel", onCancel);
    return () => {
      dialog.removeEventListener("close", onClose);
      dialog.removeEventListener("cancel", onCancel);
    };
  }, [close, requestClose]);

  const sheet = variant === "sheet" || variant === "project" || variant === "following";

  return (
    <dialog
      id="modal"
      ref={ref}
      aria-labelledby="dialog-title"
      className={cn(sheet && "notification-sheet", variant === "project" && "project-sheet", variant === "following" && "following-sheet", variant === "photo" && "profile-photo-dialog")}
      onClick={(e) => {
        // Following an in-app link from a dialog navigates away, so the dialog closes (prototype `navigate`).
        const link = (e.target as Element).closest("a[href]");
        if (link && !link.getAttribute("target") && !link.hasAttribute("download") && link.getAttribute("href")?.startsWith("/")) {
          close();
          return;
        }
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) requestClose();
      }}
    >
      {open && (
        <>
          <header className="modal-head">
            <h2 id="dialog-title">{title}</h2>
            <IconButton icon="close" label="Close dialog" disabled={blocking} onClick={() => requestClose()} />
          </header>
          <div className="modal-body" key={version}>
            {confirmingDiscard && variant !== "photo" && (
              <UnsavedChangesDialog
                saving={blocking}
                onKeepEditing={keepEditing}
                onDiscard={discard}
                onSave={() => {
                  const form = ref.current?.querySelector<HTMLFormElement>(SAVABLE_FORM);
                  keepEditing();
                  // The form's own submit validates, saves and closes the dialog on success.
                  form?.requestSubmit();
                }}
              />
            )}
            {content}
            <UploadTray insideModal />
          </div>
        </>
      )}
    </dialog>
  );
}
