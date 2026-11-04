"use client";

import { useEffect } from "react";
import { Icon } from "./icon";
import { Button } from "./primitives";

/**
 * Shared "unsaved changes" confirmation. Shown by the global modal host whenever a dirty editor is
 * being closed (close button, Cancel, Escape, backdrop or an in-dialog link). Escape or clicking
 * outside the card returns to the editor.
 */
export function UnsavedChangesDialog({ onSave, onDiscard, onKeepEditing, saving = false }: { onSave: () => void; onDiscard: () => void; onKeepEditing: () => void; saving?: boolean }) {
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onKeepEditing(); } };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [onKeepEditing]);
  return (
    <div className="unsaved-changes-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onKeepEditing(); }}>
      <div id="profile-discard-prompt" className="unsaved-changes-dialog" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-changes-title" aria-describedby="unsaved-changes-text">
        <span className="unsaved-changes-icon" aria-hidden="true"><Icon name="alert" /></span>
        <h3 id="unsaved-changes-title">Save your changes?</h3>
        <p id="unsaved-changes-text">You have unsaved changes. Save them before leaving, or discard them.</p>
        <div className="unsaved-changes-actions">
          <Button variant="danger" disabled={saving} onClick={onDiscard}>Discard</Button>
          <Button variant="primary" icon="check" disabled={saving} onClick={onSave} autoFocus>Save</Button>
        </div>
      </div>
    </div>
  );
}
