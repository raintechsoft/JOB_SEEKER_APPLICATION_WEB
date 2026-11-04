export function documentKind(name: string, type: string) {
  const extension = name.split(".").pop()?.toUpperCase() ?? "";
  if (type === "application/pdf" || extension === "PDF") return "PDF";
  if (type === "application/msword" || extension === "DOC") return "DOC";
  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || extension === "DOCX") return "DOCX";
  if (type === "application/rtf" || type === "text/rtf" || extension === "RTF") return "RTF";
  return extension.slice(0, 4) || "FILE";
}

export function formatBytes(bytes: number) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function documentMeta(kind: string, bytes: number, pages?: number) {
  if (pages && pages > 0) return `${pages} page${pages === 1 ? "" : "s"} · ${kind} · ${formatBytes(bytes)}`;
  return `${formatBytes(bytes)} · ${kind}`;
}

export function isPdfAttachment(name: string, type: string) {
  return documentKind(name, type) === "PDF";
}
