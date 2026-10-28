"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useServices } from "@/hooks/use-services";
import { findLinks, isCompleteLink, linkPreviewContract, normalizeLinkUrl, type FoundLink, type LinkPreview } from "@/lib/validation/link-preview";
import type { Role } from "@/types/domain";

export type LinkPreviewStatus = "idle" | "loading" | "ready" | "unavailable" | "dismissed";

export interface LinkPreviewState {
  status: LinkPreviewStatus;
  /** The link the state describes; it always stays in the post text whatever the status. */
  link?: FoundLink;
  preview?: LinkPreview;
}

/**
 * Preview lifecycle for one composer. Policy: the first complete, non-dismissed link in the text
 * gets the single preview. A link is complete when a delimiter follows it, when it was pasted,
 * when it was already in the text on open, or when the field loses focus. Dismissals are keyed by
 * normalized URL, so deleting and re-entering a dismissed link keeps it dismissed for this draft,
 * while a different link gets its own preview.
 */
export function useLinkPreview({
  role,
  text,
  dismissed,
  onDismiss,
  initial,
}: {
  role: Role;
  text: string;
  dismissed: readonly string[];
  onDismiss: (key: string) => void;
  /** Stored preview of a published post being edited. */
  initial?: LinkPreview;
}) {
  const services = useServices();
  const [confirmed, setConfirmed] = useState(() => new Set(findLinks(text).map((link) => link.key)));
  // Results by normalized URL; null means the page offered no preview. Each URL is requested once.
  const [results, setResults] = useState(() => {
    const seeded = new Map<string, LinkPreview | null>();
    const key = initial && normalizeLinkUrl(initial.url);
    if (initial && key) seeded.set(key, initial);
    return seeded;
  });
  const links = useMemo(() => findLinks(text), [text]);
  const eligible = links.filter((link) => confirmed.has(link.key) || isCompleteLink(text, link));
  const target = eligible.find((link) => !dismissed.includes(link.key));
  const targetKey = target?.key;
  const targetRaw = target?.raw;
  const pending = !!targetKey && !results.has(targetKey);

  useEffect(() => {
    if (!pending || !targetKey || !targetRaw) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      services.feed
        .getLinkPreview(role, targetRaw, controller.signal)
        // The preview is optional: any failure quietly leaves the plain link in the post.
        .catch(() => null)
        .then((preview) => {
          // A replaced or removed link aborts its request, so a late response cannot land.
          if (!controller.signal.aborted) setResults((current) => new Map(current).set(targetKey, preview));
        });
    }, linkPreviewContract.debounceMs);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [pending, targetKey, targetRaw, role, services]);

  const confirm = useCallback((value: string) => {
    const keys = findLinks(value).map((link) => link.key);
    if (keys.length) setConfirmed((current) => (keys.every((key) => current.has(key)) ? current : new Set([...current, ...keys])));
  }, []);

  let state: LinkPreviewState;
  if (target) {
    const result = results.get(target.key);
    state = pending ? { status: "loading", link: target } : result ? { status: "ready", link: target, preview: result } : { status: "unavailable", link: target };
  } else {
    state = eligible.length ? { status: "dismissed", link: eligible[0] } : { status: "idle" };
  }

  return {
    state,
    /** Hides the preview; the link text is untouched. */
    dismiss: () => target && onDismiss(target.key),
    /** Call with pasted text (paste) or the current value (blur) to treat its links as complete. */
    confirm,
    /** Raw link to submit: Laravel attaches its stored preview if one is ready, never waiting on a fetch. */
    submitUrl: state.status === "ready" || state.status === "loading" ? state.link!.raw : "",
  };
}
