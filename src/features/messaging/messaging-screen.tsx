"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { create } from "zustand";
import type { MessageAttachment, Role } from "@/types/domain";
import type { ConversationFlag, ConversationView, MessageFilter } from "@/services/messaging/messaging.service";
import { formatDay, formatTime } from "@/lib/utils/date";
import { readAsDataUrl } from "@/lib/utils/files";
import { uid } from "@/lib/utils/id";
import { devCopy } from "@/lib/env/app-env";
import { useServiceAction, useServiceQuery } from "@/hooks/use-services";
import { useDismissableDetails } from "@/hooks/use-dismissable";
import { modal } from "@/stores/modal-store";
import { toast } from "@/stores/toast-store";
import { useUiStore } from "@/stores/ui-store";
import { Icon } from "@/components/ui/icon";
import { Avatar, Button, EmptyState, IconButton } from "@/components/ui/primitives";
import { DevOnly } from "@/components/ui/dev-only";
import { FloatingInput, SelectField, TextAreaField } from "@/components/ui/field";
import { confirmAction } from "@/components/ui/feedback";

const EMOJIS = ["😀", "😊", "👋", "👍", "👏", "🎉", "❤️", "💡", "🚀", "🙏", "✅", "✨"];
const FILTERS: [MessageFilter, string][] = [
  ["all", "All messages"],
  ["jobs", "Jobs"],
  ["unread", "Unread"],
  ["starred", "Starred"],
  ["archived", "Archived"],
];

interface Draft {
  text: string;
  files: MessageAttachment[];
  busy: boolean;
}
const EMPTY_DRAFT: Draft = { text: "", files: [], busy: false };

/** Unsent drafts per role and conversation, kept for the session as in the prototype. */
const useDrafts = create<{ drafts: Record<string, Draft>; patch: (key: string, patch: Partial<Draft>) => void; clear: (key: string) => void }>((set) => ({
  drafts: {},
  patch: (key, patch) => set((st) => ({ drafts: { ...st.drafts, [key]: { ...(st.drafts[key] ?? EMPTY_DRAFT), ...patch } } })),
  clear: (key) =>
    set((st) => {
      const next = { ...st.drafts };
      delete next[key];
      return { drafts: next };
    }),
}));

function ReportForm({ role, c }: { role: Role; c: ConversationView }) {
  const run = useServiceAction();
  return (
    <form
      id="message-report-form"
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await run((s) => s.messaging.report(role, c.id, String(f.get("reason") || ""), String(f.get("details") || "")));
        modal.close();
        toast(devCopy("Report recorded in this browser demo.", "Report submitted."));
      }}
    >
      <h3>{c.contact.name}</h3>
      <SelectField label="Reason" name="reason" defaultValue="Spam or unwanted messages" options={["Spam or unwanted messages", "Harassment", "Misleading job or identity", "Other"]} />
      <TextAreaField label="Additional details (optional)" name="details" maxLength={1500} />
      <p className="notice">{devCopy("Reports are recorded only in this browser demo. Blocking prevents you from sending messages in this conversation until you unblock it.", "Blocking prevents you from sending messages in this conversation until you unblock it.")}</p>
      <div className="modal-footer">
        <Button
          variant="danger"
          onClick={async () => {
            const blocked = await run((s) => s.messaging.toggleFlag(role, c.id, "blockedBy"));
            modal.close();
            toast(blocked ? devCopy("Conversation blocked locally.", "Conversation blocked.") : "Conversation unblocked.");
          }}
        >
          {c.flags.blocked ? "Unblock" : "Block"}
        </Button>
        <Button type="submit" variant="primary">
          {devCopy("Save demo report", "Submit report")}
        </Button>
      </div>
    </form>
  );
}

function NewMessage({ role, onStart }: { role: Role; onStart: (id: string) => void }) {
  const { data } = useServiceQuery(["messaging", "recipients", role], (s) => s.messaging.listRecipients(role));
  return (
    <div className="stack">
      <p className="small muted">{devCopy("Choose someone to start a local demo conversation.", "Choose someone to start a conversation.")}</p>
      {data?.map((p) => (
        <button type="button" className="message-recipient" key={p.id} onClick={() => onStart(p.id)}>
          <Avatar person={p} />
          <span>
            <strong>{p.name}</strong>
            <small>{p.headline}</small>
          </span>
          <Icon name="arrow" />
        </button>
      ))}
    </div>
  );
}

function ConversationMenu({ c, onFlag, onUnread, onReport, onDelete }: { c: ConversationView; onFlag: (f: ConversationFlag) => void; onUnread: () => void; onReport: () => void; onDelete: () => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useDismissableDetails(ref, { closeOnAction: true });
  return (
    <details className="message-options" ref={ref}>
      <summary aria-label="Conversation options">
        <Icon name="more" />
      </summary>
      <div className="message-options-list">
        <Button variant="text sm" icon="briefcase" onClick={() => onFlag("jobLabelBy")}>
          {c.flags.jobLabel ? "Remove Jobs label" : "Label as Jobs"}
        </Button>
        <Button variant="text sm" icon="message" onClick={onUnread}>
          Mark as unread
        </Button>
        <Button variant="text sm" icon="star" onClick={() => onFlag("starredBy")}>
          {c.flags.starred ? "Unstar" : "Star"}
        </Button>
        <Button variant="text sm" icon="bell" onClick={() => onFlag("mutedBy")}>
          {c.flags.muted ? "Unmute" : "Mute"}
        </Button>
        <Button variant="text sm" icon="folder" onClick={() => onFlag("archivedBy")}>
          {c.flags.archived ? "Unarchive" : "Archive"}
        </Button>
        <Button variant="text sm" icon="shield" onClick={onReport}>
          Report / Block
        </Button>
        <Button variant="text sm" icon="trash" onClick={onDelete}>
          Delete conversation
        </Button>
      </div>
    </details>
  );
}

export function MessagingScreen({ role }: { role: Role }) {
  const run = useServiceAction();
  const recruiter = role === "recruiter";
  const { query, filter, mobileChat, conversation } = useUiStore((s) => s.messaging);
  const setMessaging = useUiStore((s) => s.setMessaging);
  const { data } = useServiceQuery(["messaging", role, query, filter, conversation], (s) => s.messaging.getInbox(role, { q: query, filter, selectedId: conversation }));
  const c = data?.selected ?? null;
  const [emojiOpen, setEmojiOpen] = useState(false);
  const history = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const draftKey = c ? role + ":" + c.id : "";
  const draft = useDrafts((st) => (draftKey ? (st.drafts[draftKey] ?? EMPTY_DRAFT) : null));
  const patchDraft = useDrafts((st) => st.patch);
  const clearDraft = useDrafts((st) => st.clear);

  useEffect(() => {
    if (c && c.id !== conversation) setMessaging({ conversation: c.id });
  }, [c, conversation, setMessaging]);
  useEffect(() => {
    if (history.current) history.current.scrollTop = history.current.scrollHeight;
  }, [c?.id, c?.messages.length]);
  useEffect(() => {
    if (!emojiOpen) return;
    const close = (e: MouseEvent) => !(e.target as Element).closest(".message-emoji-wrap") && setEmojiOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setEmojiOpen(false);
    document.addEventListener("click", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", key);
    };
  }, [emojiOpen]);

  const select = async (id: string) => {
    setMessaging({ conversation: id, mobileChat: true });
    await run((s) => s.messaging.markRead(role, id));
  };
  const flag = async (key: ConversationFlag) => {
    if (!c) return;
    const on = await run((s) => s.messaging.toggleFlag(role, c.id, key));
    if (key === "mutedBy") toast(on ? devCopy("Conversation muted in this demo.", "Conversation muted.") : "Conversation unmuted.");
    if (key === "archivedBy") {
      setMessaging({ conversation: null, mobileChat: false });
      toast(on ? "Conversation moved to Archived." : "Conversation returned to your inbox.");
    }
  };
  const start = async (id: string) => {
    const conv = await run((s) => s.messaging.start(role, id));
    if (!conv) return;
    setMessaging({ conversation: conv, query: "", filter: "all", mobileChat: true });
    modal.close();
    requestAnimationFrame(() => textRef.current?.focus());
  };
  const attach = async (file: File | undefined, image: boolean) => {
    if (!file || !c || !draft) return;
    if (draft.files.length >= 3) return toast("Attach up to three files per message.");
    if (image && !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) return toast("Choose a PNG, JPEG, WebP, or GIF image.");
    if (file.size > (image ? 1 : 2) * 1024 * 1024) return toast(image ? "Choose an image up to 1 MB." : "Choose a file up to 2 MB.");
    const key = draftKey;
    patchDraft(key, { busy: true });
    try {
      const attachment = { id: uid(), name: file.name, type: file.type, size: file.size, data: await readAsDataUrl(file), image };
      patchDraft(key, { files: [...(useDrafts.getState().drafts[key]?.files ?? []), attachment] });
    } catch {
      toast("That file could not be read. Please try again.");
    } finally {
      patchDraft(key, { busy: false });
    }
  };
  const send = async () => {
    if (!c || !draft || draft.busy || c.flags.blocked) return;
    const text = draft.text.trim();
    if (!text && !draft.files.length) return;
    const ok = await run((s) => s.messaging.send(role, c.id, text, draft.files));
    if (!ok) {
      if (ok === false) toast("Browser storage is full. Remove an attachment or choose a smaller file. Your draft is kept.");
      return;
    }
    clearDraft(draftKey);
    if (textRef.current) textRef.current.value = "";
    textRef.current?.focus();
    toast(devCopy("Message saved locally. It has not been sent to a real person.", "Message sent."));
  };

  const list = data?.threads ?? [];
  let previousDay = "";
  return (
    <section className={"messaging-workspace" + (mobileChat ? " show-direct-message" : "")} aria-label="Messaging">
      <header className="messaging-top">
        <h1>Messaging</h1>
        <label className="messaging-search">
          <Icon name="search" />
          <FloatingInput label="Search messages" id="message-search" type="search" value={query} onChange={(e) => setMessaging({ query: e.target.value })} aria-label="Search messages" placeholder="Search messages" />
        </label>
        <DevOnly>
          <span className="messaging-local">
            <Icon name="shield" />
            Local demo
          </span>
        </DevOnly>
        <IconButton icon="edit" label="New message" onClick={() => modal.show("New message", <NewMessage role={role} onStart={start} />)} />
      </header>
      <div className="messaging-filters" role="group" aria-label="Message filters">
        {FILTERS.map(([id, label]) => (
          <button type="button" key={id} className={filter === id ? "active" : ""} aria-pressed={filter === id} onClick={() => setMessaging({ filter: id })}>
            {label}
            {id === "unread" && !!data?.unreadCount && <span>{data.unreadCount}</span>}
          </button>
        ))}
        <DevOnly>
          <span>Messages stay in this browser.</span>
        </DevOnly>
      </div>
      <div className="messaging-panels">
        <aside className="message-threads" aria-label="Conversations" id="message-threads">
          {data &&
            (list.length ? (
              list.map((t) => {
                const last = t.lastMessage;
                return (
                  <button type="button" key={t.id} className={"message-thread" + (t.id === c?.id ? " active" : "")} aria-current={t.id === c?.id ? "true" : undefined} onClick={() => select(t.id)}>
                    <Avatar person={t.contact} />
                    <span className="message-thread-copy">
                      <span className="message-thread-title">
                        <strong>{t.contact.name}</strong>
                        <time>{last ? new Date(last.time).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "New"}</time>
                      </span>
                      <span className="message-thread-preview">
                        {last?.sender === role ? "You: " : ""}
                        {last?.text || last?.attachments?.[0]?.name || "Start a conversation"}
                      </span>
                    </span>
                    {t.unread && (
                      <i className="message-unread" aria-label="Unread conversation">
                        1
                      </i>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="message-list-empty">
                <Icon name="search" />
                <strong>No conversations found</strong>
                <p>Try another search or filter.</p>
              </div>
            ))}
        </aside>
        {c && draft ? (
          <section className="direct-message" aria-label={"Conversation with " + c.contact.name}>
            <header className="direct-message-head">
              <IconButton icon="chevron" label="Back to conversations" extra="message-back" onClick={() => setMessaging({ mobileChat: false })} />
              <Avatar person={c.contact} />
              <div className="grow">
                <h2>{c.contact.name}</h2>
                <p>
                  {recruiter ? c.contact.headline : c.company}
                  {c.flags.muted ? " · Muted" : ""}
                  {c.flags.blocked ? " · Blocked" : ""}
                </p>
              </div>
              <ConversationMenu
                c={c}
                onFlag={flag}
                onUnread={async () => {
                  await run((s) => s.messaging.markUnread(role, c.id));
                  toast("Conversation marked as unread.");
                }}
                onReport={() => modal.show("Report / Block", <ReportForm role={role} c={c} />)}
                onDelete={() =>
                  confirmAction(
                    "Delete conversation?",
                    devCopy("This removes the conversation from your inbox in this browser. It will remain available in the other demo workspace.", "This removes the conversation from your inbox."),
                    async () => {
                      await run((s) => s.messaging.toggleFlag(role, c.id, "deletedBy"));
                      clearDraft(role + ":" + c.id);
                      setMessaging({ conversation: null, mobileChat: false });
                      modal.close();
                      toast("Conversation removed from your inbox.");
                    },
                    "Delete conversation",
                    { textClassName: "" },
                  )
                }
              />
              <button type="button" className={"iconbtn message-star" + (c.flags.starred ? " is-starred" : "")} onClick={() => flag("starredBy")} aria-label={(c.flags.starred ? "Unstar" : "Star") + " conversation"} aria-pressed={c.flags.starred}>
                <Icon name="star" />
              </button>
            </header>
            <div className="direct-message-history" id="chat-history" role="log" aria-label="Message history" aria-live="polite" ref={history}>
              {c.messages.length ? (
                c.messages.map((m, i) => {
                  const d = formatDay(m.time);
                  const divider = previousDay !== d;
                  previousDay = d;
                  const own = m.sender === role;
                  const who = own ? c.self : c.contact;
                  return (
                    <Fragment key={m.id ?? i}>
                      {divider && (
                        <div className="message-date">
                          <span>{d}</span>
                        </div>
                      )}
                      <article className={"message-entry" + (own ? " is-own" : "")}>
                        <Avatar person={who} />
                        <div className="message-entry-body">
                          <div className="message-entry-meta">
                            <strong>{who.name}</strong>
                            <time>{formatTime(m.time)}</time>
                          </div>
                          {m.text && <p>{m.text}</p>}
                          {(m.attachments || [])
                            .filter((a) => /^data:/.test(a.data || ""))
                            .map((a) =>
                              a.image ? (
                                <a className="message-image" href={a.data} download={a.name} key={a.id}>
                                  {/* eslint-disable-next-line @next/next/no-img-element -- attachment data URL */}
                                  <img src={a.data} alt={a.name} loading="lazy" />
                                </a>
                              ) : (
                                <a className="message-file" href={a.data} download={a.name} key={a.id}>
                                  <Icon name="file" />
                                  <span>
                                    <strong>{a.name}</strong>
                                    <small>{Math.max(1, Math.ceil(a.size / 1024))} KB · Download</small>
                                  </span>
                                  <Icon name="download" />
                                </a>
                              ),
                            )}
                        </div>
                      </article>
                    </Fragment>
                  );
                })
              ) : (
                <div className="message-start-hint">A thoughtful conversation starts with a simple hello.</div>
              )}
            </div>
            <form
              id="message-form"
              className="message-composer"
              data-no-floating-label
              inert={c.flags.blocked}
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <label className="sr-only" htmlFor="message-text">
                Write a message
              </label>
              <textarea
                id="message-text"
                ref={textRef}
                name="text"
                rows={3}
                maxLength={2000}
                placeholder={c.flags.blocked ? "Unblock this conversation to reply" : "Write a message..."}
                aria-label="Write a message"
                disabled={c.flags.blocked}
                defaultValue={draft.text}
                key={c.id}
                onInput={(e) => patchDraft(draftKey, { text: e.currentTarget.value })}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <div className="message-attachment-previews" hidden={!draft.files.length}>
                {draft.files.map((a, i) => (
                  <div className="message-attachment-chip" key={a.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- attachment preview data URL */}
                    {a.image ? <img src={a.data} alt="" /> : <Icon name="file" />}
                    <span>{a.name}</span>
                    <IconButton
                      icon="close"
                      label={"Remove " + a.name}
                      onClick={() => patchDraft(draftKey, { files: draft.files.filter((_, n) => n !== i) })}
                    />
                  </div>
                ))}
              </div>
              <div className="message-composer-tools">
                <div className="message-attachment-tools">
                  <IconButton icon="image" label="Add an image" onClick={() => imageInput.current?.click()} />
                  <IconButton icon="paperclip" label="Attach a file" onClick={() => fileInput.current?.click()} />
                  <div className="message-emoji-wrap">
                    <button type="button" className="iconbtn" aria-label="Choose emoji" aria-expanded={emojiOpen} onClick={() => setEmojiOpen((v) => !v)}>
                      <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
                        <path d="M8 14s1 3 4 3 4-3 4-3M8 9h.01M16 9h.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                    <div className="message-emoji-picker" aria-label="Emoji picker" hidden={!emojiOpen}>
                      {EMOJIS.map((emoji) => (
                        <button
                          type="button"
                          key={emoji}
                          aria-label={"Insert " + emoji}
                          onClick={() => {
                            const el = textRef.current;
                            if (!el) return;
                            el.setRangeText(emoji, el.selectionStart, el.selectionEnd, "end");
                            patchDraft(draftKey, { text: el.value });
                            setEmojiOpen(false);
                            el.focus();
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <span className="message-composer-hint">{draft.busy ? "Adding attachment…" : "Enter for a new line"}</span>
                <button id="message-send" className="btn primary" type="submit" disabled={(!draft.text.trim() && !draft.files.length) || draft.busy || c.flags.blocked}>
                  Send <Icon name="send" />
                </button>
              </div>
              <input
                type="file"
                ref={imageInput}
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                onChange={(e) => {
                  void attach(e.target.files?.[0], true);
                  e.target.value = "";
                }}
              />
              <input
                type="file"
                ref={fileInput}
                hidden
                onChange={(e) => {
                  void attach(e.target.files?.[0], false);
                  e.target.value = "";
                }}
              />
            </form>
          </section>
        ) : data ? (
          <div className="direct-message message-empty">
            <EmptyState
              title="Start a conversation."
              description="Find someone to connect with."
              action={
                <Button variant="primary" icon="edit" onClick={() => modal.show("New message", <NewMessage role={role} onStart={start} />)}>
                  New message
                </Button>
              }
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
