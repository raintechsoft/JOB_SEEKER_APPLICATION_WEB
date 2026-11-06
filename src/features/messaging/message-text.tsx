import { Fragment } from "react";

export type MessageTextPart = { kind: "text" | "link"; value: string };

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/g;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}]+$/;

/** Splits message text into plain runs and http(s) links; everything else stays verbatim. */
export function splitMessageText(text: string): MessageTextPart[] {
  const parts: MessageTextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    let url = match[0];
    const trailing = url.match(TRAILING_PUNCTUATION)?.[0] ?? "";
    url = url.slice(0, url.length - trailing.length);
    if (!url) continue;
    if (start > last) parts.push({ kind: "text", value: text.slice(last, start) });
    parts.push({ kind: "link", value: url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
  return parts;
}

function sameOrigin(url: string) {
  if (typeof window === "undefined") return false;
  try {
    return new URL(url).origin === window.location.origin;
  } catch {
    return false;
  }
}

/** Message body with clickable links; same-site links open in place, others in a new tab. */
export function MessageText({ text }: { text: string }) {
  return (
    <p>
      {splitMessageText(text).map((part, index) =>
        part.kind === "link" ? (
          <a key={index} href={part.value} {...(sameOrigin(part.value) ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
            {part.value}
          </a>
        ) : (
          <Fragment key={index}>{part.value}</Fragment>
        ),
      )}
    </p>
  );
}
