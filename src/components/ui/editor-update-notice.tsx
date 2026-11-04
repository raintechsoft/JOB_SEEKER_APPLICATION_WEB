"use client";
import { Button } from "./primitives";

export function EditorUpdateNotice({ changed, reload }: { changed: boolean; reload: () => void }) {
  if (!changed) return null;
  return <div className="state-panel" role="status"><p>This was updated elsewhere. Your edits are still here. Load the latest version before saving.</p><Button type="button" variant="sm" onClick={reload}>Discard draft and load latest</Button></div>;
}
