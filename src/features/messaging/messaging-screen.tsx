"use client";

import { ContentSkeleton } from "@/components/ui/skeleton";
import { QueryFeedback } from "@/components/ui/query-view";

import { Fragment, useEffect, useRef, useState } from "react";
import type { Role } from "@/types/domain";
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
import {useDrafts,EMPTY_DRAFT} from "./draft-store";
import {apiConfig} from "@/services/api/config";
import {messageSchema,reportSchema,validateMessageFile} from "@/lib/validation/communication";
import {useFormAction} from "@/hooks/use-form-action";
import {useServices} from "@/hooks/use-services";
import {usePathname,useRouter,useSearchParams} from "next/navigation";
import {z} from "zod";

const EMOJIS = ["😀", "😊", "👋", "👍", "👏", "🎉", "❤️", "💡", "🚀", "🙏", "✅", "✨"];
const FILTERS: [MessageFilter, string][] = [
  ["all", "All messages"],
  ["jobs", "Jobs"],
  ["unread", "Unread"],
  ["starred", "Starred"],
  ["archived", "Archived"],
];

function ReportForm({ role, c }: { role: Role; c: ConversationView }) {
  const [errors,setErrors]=useState<Record<string,string>>({});
  const {execute,pending}=useFormAction(setErrors);
  return (
    <form
      id="message-report-form"
      className="stack"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const parsed=reportSchema.safeParse({reason:String(f.get("reason")||""),details:String(f.get("details")||"")});
        if(!parsed.success){setErrors(Object.fromEntries(parsed.error.issues.map((i)=>[String(i.path[0]),i.message])));return;}
        if(!await execute((s)=>s.messaging.report(role,c.id,parsed.data.reason,parsed.data.details)))return;
        modal.close();
        toast(devCopy("Report recorded in this browser demo.", "Report submitted."));
      }}
    >
      <h3>{c.contact.name}</h3>
      {errors._form&&<p role="alert" className="error">{errors._form}</p>}
      <SelectField required label="Reason" name="reason" defaultValue="Spam or unwanted messages" options={["Spam or unwanted messages", "Harassment", "Misleading job or identity", "Other"]} error={errors.reason} disabled={pending}/>
      <TextAreaField label="Additional details" name="details" maxLength={1500} error={errors.details} disabled={pending}/>
      <p className="notice">{devCopy("Reports are recorded only in this browser demo. Blocking prevents you from sending messages in this conversation until you unblock it.", "Blocking prevents you from sending messages in this conversation until you unblock it.")}</p>
      <div className="modal-footer">
        <Button
          variant="danger"
          onClick={async () => {
            const blocked=!c.flags.blocked;
            if(!await execute(async(s)=>{await s.messaging.toggleFlag(role,c.id,"blockedBy");return true;}))return;
            modal.close();
            toast(blocked ? devCopy("Conversation blocked locally.", "Conversation blocked.") : "Conversation unblocked.");
          }}
        >
          {c.flags.blocked ? "Unblock" : "Block"}
        </Button>
        <Button type="submit" variant="primary" loading={pending} disabled={pending}>
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
  const services=useServices();
  const real=apiConfig.dataSource==="http";
  const params=useSearchParams(),router=useRouter(),pathname=usePathname();
  const requested=params.get("conversation");
  const [historyLimit,setHistoryLimit]=useState(50);
  const readAcknowledged=useRef("");
  const [error,setError]=useState("");
  const recruiter = role === "recruiter";
  const { query, filter, mobileChat, conversation } = useUiStore((s) => s.messaging);
  const setMessaging = useUiStore((s) => s.setMessaging);
  const { data,isError,refetch } = useServiceQuery(["messaging", role, query, filter, conversation], (s) => s.messaging.getInbox(role, { q: query, filter, selectedId: conversation }),{refetchInterval:real?10000:undefined,keepPreviousData:false});
  const c = data?.selected ?? null;
  const historyPage=useServiceQuery(["message-history",role,c?.id,historyLimit],(s)=>s.messaging.getHistory!(role,c!.id,historyLimit),{enabled:real&&!!c,refetchInterval:real?(historyLimit>50?30000:10000):undefined,keepPreviousData:false});
  const messages=historyPage.isError?[]:historyPage.data?.messages??c?.messages??[];
  const readSequence=historyPage.data?.readSequence??c?.readSequence;
  useEffect(()=>{if(!real||!requested||!z.uuid().safeParse(requested).success)return;setMessaging({conversation:requested,mobileChat:true});router.replace(pathname,{scroll:false});},[real,requested,router,pathname,setMessaging]);
  useEffect(()=>{
    if(!real||!c||readSequence===undefined)return;
    const id=c.id,sequence=readSequence;
    const acknowledge=()=>{if(document.visibilityState!=="visible"||!mobileChat&&!window.matchMedia("(min-width: 768px)").matches)return;const key=`${role}:${id}:${sequence}`;if(readAcknowledged.current===key)return;readAcknowledged.current=key;void services.messaging.markRead(role,id,sequence).catch(()=>{readAcknowledged.current="";});};
    acknowledge();document.addEventListener("visibilitychange",acknowledge);return()=>document.removeEventListener("visibilitychange",acknowledge);
  },[real,c?.id,readSequence,mobileChat,role,services,c]);
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
    setHistoryLimit(50);
    if(real){if(c?.id===id&&readSequence!==undefined)await run((s)=>s.messaging.markRead(role,id,readSequence));return;}
    await run((s) => s.messaging.markRead(role, id));
  };
  const flag = async (key: ConversationFlag) => {
    if (!c) return;
    const on = await run((s) => s.messaging.toggleFlag(role, c.id, key));
    if(on===undefined)return;
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
    if(useDrafts.getState().drafts[draftKey]?.busy)return;
    if(real){const issue=validateMessageFile(file,draft.files.length,image);if(issue){setError(issue);return;}}
    if (draft.files.length >= 3) return toast("Attach up to three files per message.");
    if (image && !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) return toast("Choose a PNG, JPEG, WebP, or GIF image.");
    if (file.size > (image ? 1 : 2) * 1024 * 1024) return toast(image ? "Choose an image up to 1 MB." : "Choose a file up to 2 MB.");
    const key = draftKey;
    patchDraft(key, { busy: true });
    try {
      const asset=real?await services.media.upload(file,"message_attachment",undefined,{manual:true}):null;
      const attachment = { id: asset?.id??uid(), name: file.name, type: file.type, size: file.size, data: asset?.url??await readAsDataUrl(file), image };
      patchDraft(key, { files: [...(useDrafts.getState().drafts[key]?.files ?? []), attachment] });
    } catch {
      toast("That file could not be read. Please try again.");
    } finally {
      patchDraft(key, { busy: false });
    }
  };
  const send = async () => {
    if (!c || !draft || draft.busy || useDrafts.getState().drafts[draftKey]?.busy || c.flags.blocked || c.canSend===false) return;
    const text = draft.text.trim();
    if(real){const parsed=messageSchema.safeParse({text,attachments:draft.files});if(!parsed.success){setError(parsed.error.issues[0].message);return;}}
    if (!text && !draft.files.length) {setError("Write a message or attach a file.");return;}
    setError("");patchDraft(draftKey,{busy:true});
    const ok = await run((s) => s.messaging.send(role, c.id, text, draft.files),{invalidate:["messaging","message-history","messaging-unread","notifications"]});
    if (!ok) {
      patchDraft(draftKey,{busy:false});setError("Your message could not be sent. Your draft is kept here; retry when ready.");
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
      {real&&requested&&!z.uuid().safeParse(requested).success&&<p role="alert">This conversation link is invalid.</p>}
      {isError&&<p role="alert">Messages could not be loaded. <Button onClick={()=>void refetch()}>Try again</Button></p>}
      {error&&<p role="alert" className="error" id="message-error">{error}</p>}
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
          <QueryFeedback data={data} error={isError} retry={refetch} label="Loading conversations" />
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
                        {(last?.own ?? last?.sender === role) ? "You: " : ""}
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
                  const ok=await run(async(s)=>{await s.messaging.markUnread(role,c.id);return true;});if(!ok)return;
                  toast("Conversation marked as unread.");
                }}
                onReport={() => modal.show("Report / Block", <ReportForm role={role} c={c} />)}
                onDelete={() =>
                  confirmAction(
                    "Delete conversation?",
                    devCopy("This removes the conversation from your inbox in this browser. It will remain available in the other demo workspace.", "This removes the conversation from your inbox."),
                    async () => {
                      const ok=await run((s) => s.messaging.toggleFlag(role, c.id, "deletedBy"));if(ok===undefined)return;
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
              {historyPage.isError&&<p role="alert">Message history could not be loaded. <Button onClick={()=>void historyPage.refetch()}>Try again</Button></p>}
              {historyPage.data?.nextBefore&&historyLimit<500&&<Button disabled={historyPage.isFetching} onClick={()=>setHistoryLimit((n)=>n+50)}>Load earlier messages</Button>}
              {real && !historyPage.data && !historyPage.isError && !messages.length ? <ContentSkeleton layout="list" label="Loading messages" /> : messages.length ? (
                messages.map((m, i) => {
                  const d = formatDay(m.time);
                  const divider = previousDay !== d;
                  previousDay = d;
                  const own = m.own ?? m.sender === role;
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
                !historyPage.isError && <div className="message-start-hint">A thoughtful conversation starts with a simple hello.</div>
              )}
            </div>
            {c.canSend===false&&!c.flags.blocked&&<p role="status">Messaging is currently unavailable for this contact. Your previous messages remain available.</p>}
            <form
              id="message-form"
              className="message-composer"
              data-no-floating-label
              inert={c.flags.blocked||c.canSend===false}
              noValidate
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
                maxLength={real?4000:2000}
                placeholder={c.flags.blocked ? "Unblock this conversation to reply" : "Write a message..."}
                aria-label="Write a message"
                disabled={c.flags.blocked||c.canSend===false||draft.busy}
                aria-invalid={!!error}
                aria-describedby={error?"message-error":undefined}
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
                <button id="message-send" className="btn primary" type="submit" disabled={(!draft.text.trim() && !draft.files.length) || draft.busy || c.flags.blocked||c.canSend===false}>
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
        ) : !data && !isError ? <section className="direct-message"><ContentSkeleton label="Loading conversation" /></section> : null}
      </div>
    </section>
  );
}
