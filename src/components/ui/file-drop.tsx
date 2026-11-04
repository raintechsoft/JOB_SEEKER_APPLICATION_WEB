"use client";

import { useState, type DragEvent, type ReactNode, type Ref } from "react";
import { Icon } from "./icon";
import { cn } from "@/lib/utils/text";

type Props = {
  id: string;
  label: string;
  /** Accessible name when no visible label is shown. */
  srLabel?: string;
  /** Product area this picker belongs to, e.g. career-journey. */
  section?: string;
  /** What the file is for, e.g. memory-photos. */
  use?: string;
  prompt?: string;
  promptHint?: string;
  buttonLabel?: string;
  changeLabel?: string;
  icon?: "upload" | "file" | "image";
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
export function FileDrop({ id, label, srLabel, section, use, prompt = "Drag and drop a file here", promptHint = "or use the button to browse", buttonLabel = "Choose file", changeLabel = "Change file", icon = "upload", hint, accept, multiple, disabled, required, invalid, describedBy, fileName, inputRef, onFiles }: Props) {
  const [over, setOver] = useState(false);
  const drag = (event: DragEvent, active: boolean) => {
    event.preventDefault();
    if (!disabled) setOver(active);
  };
  return (
    <div className="file-drop-field" data-upload-section={section} data-upload-use={use}>
      {label && (
        <label className="file-drop-label" htmlFor={id} id={id + "-label"}>
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
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
        <input id={id} ref={inputRef} className="file-drop-input" type="file" accept={accept} multiple={multiple} disabled={disabled} required={required} aria-labelledby={label ? id + "-label" : undefined} aria-label={label ? undefined : srLabel} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
        <span className="file-drop-icon" aria-hidden="true">
          <Icon name={fileName ? "file" : icon} />
        </span>
        <span className="file-drop-text">
          {fileName ? (
            <strong className="file-drop-name" title={fileName}>{fileName}</strong>
          ) : (
            <>
              <strong>{prompt}</strong>
              <span>{promptHint}</span>
            </>
          )}
        </span>
        <span className="file-drop-button" aria-hidden="true">
          {fileName ? changeLabel : buttonLabel}
        </span>
      </label>
      {hint && <small className="file-drop-hint">{hint}</small>}
    </div>
  );
}
