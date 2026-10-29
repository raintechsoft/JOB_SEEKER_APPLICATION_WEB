"use client";

import { useState, type DragEvent, type ReactNode, type Ref } from "react";
import { Icon } from "./icon";
import { cn } from "@/lib/utils/text";

type Props = {
  id: string;
  label: string;
  /** Accessible name when no visible label is shown. */
  srLabel?: string;
  hint?: ReactNode;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  /** Name of the chosen file, shown in place of the prompt. */
  fileName?: string;
  inputRef?: Ref<HTMLInputElement>;
  onFiles: (files: FileList | null) => void;
};

/**
 * Themed file picker: a drop zone with a "Choose file" button. The native input stays in the page
 * (visually hidden) so labels, keyboard focus, validation and screen readers keep working; dropped
 * files go through the same onFiles handler, which owns all type and size checks.
 */
export function FileDrop({ id, label, srLabel, hint, accept, multiple, disabled, required, invalid, describedBy, fileName, inputRef, onFiles }: Props) {
  const [over, setOver] = useState(false);
  const drag = (event: DragEvent, active: boolean) => {
    event.preventDefault();
    if (!disabled) setOver(active);
  };
  return (
    <div className="file-drop-field">
      {label && (
        <span className="file-drop-label" id={id + "-label"}>
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </span>
      )}
      <label
        htmlFor={id}
        className={cn("file-drop", over && "is-over", invalid && "is-invalid", disabled && "is-disabled", fileName && "has-file")}
        onDragEnter={(e) => drag(e, true)}
        onDragOver={(e) => drag(e, true)}
        onDragLeave={(e) => drag(e, false)}
        onDrop={(e) => {
          drag(e, false);
          if (!disabled && e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
        }}
      >
        <input id={id} ref={inputRef} className="file-drop-input" type="file" accept={accept} multiple={multiple} disabled={disabled} required={required} aria-labelledby={label ? id + "-label" : undefined} aria-label={label ? undefined : srLabel} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => onFiles(e.target.files)} />
        <span className="file-drop-icon" aria-hidden="true">
          <Icon name={fileName ? "file" : "upload"} />
        </span>
        <span className="file-drop-text">
          {fileName ? (
            <strong className="file-drop-name" title={fileName}>{fileName}</strong>
          ) : (
            <>
              <strong>Drag and drop a file here</strong>
              <span>or use the button to browse</span>
            </>
          )}
        </span>
        <span className="file-drop-button" aria-hidden="true">
          {fileName ? "Change file" : "Choose file"}
        </span>
      </label>
      {hint && <small className="file-drop-hint">{hint}</small>}
    </div>
  );
}
