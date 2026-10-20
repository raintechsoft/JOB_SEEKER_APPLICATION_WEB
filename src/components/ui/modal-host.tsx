"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useModalStore } from "@/stores/modal-store";
import { cn } from "@/lib/utils/text";
import { Button, IconButton } from "./primitives";

/**
 * The single application dialog (`<dialog id="modal">`), rendered with the native modal element so
 * focus trapping, Escape handling and inertness come from the browser. Variants map to the
 * prototype's `notification-sheet`, `project-sheet` and `following-sheet` classes.
 */
export function ModalHost() {
  const { open, title, content, variant, version, confirmingDiscard, close, requestClose, keepEditing, discard } = useModalStore();
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
      if (useModalStore.getState().dirty) {
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
      className={cn(sheet && "notification-sheet", variant === "project" && "project-sheet", variant === "following" && "following-sheet")}
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
            <IconButton icon="close" label="Close dialog" onClick={() => requestClose()} />
          </header>
          <div className="modal-body" key={version}>
            {confirmingDiscard && (
              <div id="profile-discard-prompt" className="profile-discard-prompt" role="alert">
                <p>You have unsaved changes. Keep editing or discard them?</p>
                <div className="row">
                  <Button variant="sm" onClick={keepEditing} autoFocus>
                    Keep editing
                  </Button>
                  <Button variant="danger sm" onClick={discard}>
                    Discard changes
                  </Button>
                </div>
              </div>
            )}
            {content}
          </div>
        </>
      )}
    </dialog>
  );
}
