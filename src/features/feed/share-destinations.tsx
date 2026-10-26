"use client";

import { useRef, useState } from "react";
import type { Id, Role } from "@/types/domain";
import { useHydrated } from "@/hooks/use-hydrated";
import { Icon } from "@/components/ui/icon";
import { postShareUrl } from "./share-links";

export function ShareDestinations({ role, postId }: { role: Role; postId: Id }) {
  const hydrated = useHydrated();
  const url = hydrated ? postShareUrl(role, postId, window.location.origin) : "";
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [copying, setCopying] = useState(false);
  const [sharing, setSharing] = useState(false);
  const copyLock = useRef(false), shareLock = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  const copy = async () => {
    if (!url || copyLock.current) return;
    copyLock.current = true; setCopying(true); setMessage(""); setCopied(false);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      input.current?.focus(); input.current?.select();
      setMessage("Couldn’t copy automatically. Select and copy the link.");
    } finally { copyLock.current = false; setCopying(false); }
  };

  const systemShare = async () => {
    if (!url || shareLock.current) return;
    setMessage("");
    if (typeof navigator.share !== "function") {
      setMessage("System sharing isn’t available in this browser. Copy the link instead."); return;
    }
    shareLock.current = true; setSharing(true);
    try {
      // Call during the original click; awaiting a request first loses browser user activation.
      await navigator.share({ title: "Post on Skillora", url });
      // Opening a composer is not confirmation that the user sent or published anything.
    } catch (error) {
      if (!(error && typeof error === "object" && "name" in error && error.name === "AbortError")) setMessage("System sharing couldn’t open. Copy the link instead.");
    } finally { shareLock.current = false; setSharing(false); }
  };

  return <section className="post-share-destinations" aria-label="Share outside Skillora" data-no-floating-label>
    <h3>Share link</h3>
    <div className="post-share-controls">
      <div className="post-share-copy">
      <label className="sr-only" htmlFor="post-share-link">Post link</label>
      <input ref={input} id="post-share-link" aria-label="Post link" type="text" value={url} readOnly onFocus={event => event.currentTarget.select()} />
      <button type="button" disabled={!url || copying} onClick={() => void copy()}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <button type="button" className="post-share-more" aria-label="More sharing options" disabled={!url || sharing} onClick={() => void systemShare()}><Icon name="more" /><span>More</span></button>
    </div>
   
  </section>;
}
