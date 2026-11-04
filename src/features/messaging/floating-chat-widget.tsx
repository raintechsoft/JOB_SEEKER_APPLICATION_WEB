"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Avatar, IconButton } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state-views";
import { apiConfig } from "@/services/api/config";
import { applyPeerReceipts, outgoingTick, tickLabel } from "@/services/messaging/message-status";
import { ChatAttachment } from "@/features/messaging/message-attachment";
import { EMPTY_DRAFT, useDrafts } from "@/features/messaging/draft-store";
import { useCommunicationQuery } from "@/hooks/use-communication-query";
import { useServiceAction, useServices } from "@/hooks/use-services";
import { formatDay, formatTime } from "@/lib/utils/date";
import { uid } from "@/lib/utils/id";
import { quickMessageSchema } from "@/lib/validation/communication";
import { useFloatingChatStore, type FloatingChat } from "@/stores/floating-chat-store";
import { useUiStore } from "@/stores/ui-store";
import type { Message } from "@/types/domain";
import type { SignalNotice } from "@/services/realtime/signal-hub";

const EMOJIS = ["😀", "😊", "👋", "👍", "👏", "🎉", "❤️", "💡", "🚀", "🙏", "✅", "✨"];

type PendingMessage = Message & { id: string; conversationId: string };

export function FloatingChatWidget({ chat }: { chat: FloatingChat }) {
  const role = "recruiter" as const;
  const real = apiConfig.dataSource === "http";
  const run = useServiceAction();
  const services = useServices();
  const cache = useQueryClient();
  const router = useRouter();
  const setMinimized = useFloatingChatStore((s) => s.setMinimized);
  const setMaximized = useFloatingChatStore((s) => s.setMaximized);
  const closeChat = useFloatingChatStore((s) => s.closeChat);
  const setMessaging = useUiStore((s) => s.setMessaging);
  const [error, setError] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const historyRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const readAcknowledged = useRef("");
  const draftKey = role + ":" + chat.conversationId;
  const draft = useDrafts((st) => st.drafts[draftKey] ?? EMPTY_DRAFT);
  const patchDraft = useDrafts((st) => st.patch);
  const clearDraft = useDrafts((st) => st.clear);

  const person = { id: chat.candidateId, name: chat.name, picture: chat.picture, headline: chat.headline };

  const inbox = useCommunicationQuery(
    ["messaging", role, "", "all", chat.conversationId],
    (s, scope) => s.messaging.getInbox(role, { q: "", filter: "all", selectedId: chat.conversationId }, scope),
  );
  const historyPage = useCommunicationQuery(
    ["message-history", role, chat.conversationId, 50],
    (s, scope) => s.messaging.getHistory!(role, chat.conversationId, 50, scope),
    { enabled: real },
  );

  const selected = inbox.data?.selected ?? null;
  const view = real ? (historyPage.isError ? selected : historyPage.data ?? selected) : selected;
  // Receipt watermarks only upgrade ticks when `own` is set; normalize before applying.
  const normalized = (view?.messages ?? []).map((m) => ({
    ...m,
    own: m.own ?? m.sender === role,
  }));
  const stored = applyPeerReceipts(normalized, view?.peerDeliveredSequence ?? 0, view?.peerReadSequence ?? 0);
  const messages: Message[] = [
    ...stored,
    ...pending
      .filter((m) => m.conversationId === chat.conversationId)
      .map(({ conversationId: _c, ...m }) => ({ ...m, sender: role, own: true as const })),
  ];
  const threadUnread = !!inbox.data?.threads.find((t) => t.id === chat.conversationId)?.unread;
  // Open panel = messages are being viewed; only show the badge on minimized unread tabs.
  const showUnreadDot = threadUnread && chat.minimized;
  const blocked = !!selected?.flags.blocked;
  const canSend = selected ? selected.canSend !== false && !blocked : true;
  const readSequence = historyPage.data?.readSequence ?? selected?.readSequence;

  const refreshUnread = () => {
    void cache.invalidateQueries({
      predicate: (q) =>
        (q.queryKey[0] === "message-history" && String(q.queryKey[4]) === String(chat.conversationId)) ||
        q.queryKey[0] === "messaging" ||
        q.queryKey[0] === "messaging-unread" ||
        q.queryKey[0] === "notifications",
    });
  };

  useEffect(() => {
    if (chat.minimized) return;
    const el = historyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.minimized, messages.length, chat.conversationId]);

  useEffect(() => {
    if (chat.minimized || !chat.conversationId) return;
    if (document.visibilityState !== "visible") return;
    if (real && readSequence === undefined) return;
    const key = real
      ? `${role}:${chat.conversationId}:${readSequence}`
      : `mock:${role}:${chat.conversationId}:seen`;
    if (readAcknowledged.current === key) return;
    readAcknowledged.current = key;
    void services.messaging
      .markRead(role, chat.conversationId, real ? readSequence : undefined)
      .then(refreshUnread)
      .catch(() => {
        if (readAcknowledged.current === key) readAcknowledged.current = "";
      });
  }, [real, chat.minimized, chat.conversationId, readSequence, services, cache]);

  // Re-arm mark-read when the widget is minimized again so the next open clears a new unread.
  useEffect(() => {
    if (chat.minimized) readAcknowledged.current = "";
  }, [chat.minimized]);

  useEffect(() => {
    if (!real) return;
    const onSignal = (event: SignalNotice) => {
      if (!("data" in event)) return;
      if (String(event.data.conversationId) !== String(chat.conversationId)) return;
      if (event.type !== "conversation.updated") return;
      refreshUnread();
      if (chat.minimized || document.visibilityState !== "visible") return;
      void services.messaging.markRead(role, chat.conversationId).then(refreshUnread).catch(() => {});
    };
    return services.realtime?.hub.subscribe(onSignal);
  }, [real, chat.minimized, chat.conversationId, services, cache]);

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

  async function send() {
    if (!canSend || draft.busy || useDrafts.getState().drafts[draftKey]?.busy) return;
    const text = draft.text.trim();
    const parsed = quickMessageSchema.safeParse(text);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Write a message.");
      return;
    }
    setError("");
    const pendingId = "pending-" + uid();
    const conversationId = chat.conversationId;
    setPending((list) => [
      ...list,
      { id: pendingId, conversationId, text: parsed.data, attachments: [], time: new Date().toISOString(), sender: role, own: true },
    ]);
    clearDraft(draftKey);
    if (textRef.current) textRef.current.value = "";
    textRef.current?.focus();
    const ok = await run((s) => s.messaging.send(role, conversationId, parsed.data, []), { refresh: false });
    if (!ok) {
      setPending((list) => list.filter((m) => m.id !== pendingId));
      patchDraft(draftKey, { text: parsed.data, files: [], busy: false });
      if (textRef.current) textRef.current.value = parsed.data;
      setError("Your message could not be sent. Your draft is kept here; retry when ready.");
      return;
    }
    void cache.invalidateQueries({ predicate: (q) => ["messaging", "messaging-unread", "notifications"].includes(String(q.queryKey[0])) });
    await cache.invalidateQueries({ queryKey: ["message-history"] });
    setPending((list) => list.filter((m) => m.id !== pendingId));
  }

  function insertEmoji(emoji: string) {
    const el = textRef.current;
    if (!el) return;
    el.setRangeText(emoji, el.selectionStart, el.selectionEnd, "end");
    patchDraft(draftKey, { text: el.value });
    setEmojiOpen(false);
    el.focus();
  }

  function openInMessages() {
    setMessaging({ conversation: chat.conversationId, mobileChat: true });
    router.push("/recruiter/messages");
  }

  let previousDay = "";
  const textId = "floating-chat-text-" + chat.conversationId;
  const errorId = "floating-chat-error-" + chat.conversationId;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chat.conversationId,
  });
  const sortStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.72 : 1,
    zIndex: isDragging ? 2 : undefined,
  };

  return (
    <aside
      ref={setNodeRef}
      style={sortStyle}
      className={
        "floating-chat-widget" +
        (chat.minimized ? " is-minimized" : "") +
        (chat.maximized && !chat.minimized ? " is-maximized" : "") +
        (isDragging ? " is-dragging" : "")
      }
      aria-label={"Chat with " + chat.name}
    >
      <header className="floating-chat-head">
        <button
          type="button"
          className="floating-chat-head-main"
          onClick={() => setMinimized(chat.conversationId, !chat.minimized)}
          aria-expanded={!chat.minimized}
          {...attributes}
          {...listeners}
        >
          <span className="floating-chat-avatar-wrap">
            <Avatar person={person} />
            {showUnreadDot ? <i className="floating-chat-unread" aria-label="Unread messages" /> : null}
          </span>
          <span className="floating-chat-head-copy">
            <strong>{chat.name}</strong>
            {!chat.minimized && chat.headline ? <span>{chat.headline}</span> : null}
          </span>
          <Icon name={chat.minimized ? "up" : "down"} />
        </button>
        {!chat.minimized ? (
          <div className="floating-chat-head-actions">
            <IconButton icon="external" label="Open in Messages" onClick={openInMessages} />
            <IconButton
              icon={chat.maximized ? "compress" : "expand"}
              label={chat.maximized ? "Restore chat size" : "Maximise chat"}
              onClick={() => setMaximized(chat.conversationId, !chat.maximized)}
            />
            <IconButton icon="close" label="Close chat" onClick={() => closeChat(chat.conversationId)} />
          </div>
        ) : (
          <IconButton icon="close" label="Close chat" onClick={() => closeChat(chat.conversationId)} />
        )}
      </header>

      <div className="floating-chat-body" hidden={chat.minimized}>
        <div className="floating-chat-history" role="log" aria-label="Message history" aria-live="polite" ref={historyRef}>
          {real && historyPage.isError ? (
            <ErrorState
              compact
              error={historyPage.error}
              title="Message history couldn’t load"
              description="Something interrupted the request. Please try again."
              onRetry={() => void historyPage.refetch()}
            />
          ) : null}
          {real && !historyPage.data && !historyPage.isError && !messages.length ? (
            <ContentSkeleton layout="list" label="Loading messages" />
          ) : messages.length ? (
            messages.map((m, i) => {
              const d = formatDay(m.time);
              const divider = previousDay !== d;
              previousDay = d;
              const own = m.own ?? m.sender === role;
              const tick = outgoingTick({ ...m, own });
              const who = own ? selected?.self ?? { id: "self", name: "You" } : selected?.contact ?? person;
              return (
                <Fragment key={m.id ?? i}>
                  {divider ? (
                    <div className="message-date">
                      <span>{d}</span>
                    </div>
                  ) : null}
                  <article
                    className={
                      "message-entry" + (own ? " is-own" : "") + (m.id?.startsWith("pending-") ? " is-sending" : "")
                    }
                    aria-busy={m.id?.startsWith("pending-") || undefined}
                  >
                    <Avatar person={who} />
                    <div className="message-entry-body">
                      <div className="message-entry-meta">
                        <strong>{who.name}</strong>
                        {m.id?.startsWith("pending-") ? null : <time>{formatTime(m.time)}</time>}
                        {tick ? (
                          <span className={"message-status" + (tick === "seen" ? " is-seen" : "")} aria-label={tickLabel(tick)}>
                            <Icon name={tick === "clock" ? "clock" : tick === "sent" ? "check" : "ticks"} />
                          </span>
                        ) : null}
                      </div>
                      {m.text ? <p>{m.text}</p> : null}
                      {(m.attachments || []).map((a) => (
                        <ChatAttachment a={a} key={a.id} real={real} />
                      ))}
                    </div>
                  </article>
                </Fragment>
              );
            })
          ) : (
            !historyPage.isError && <div className="message-start-hint">Say hello to start the conversation.</div>
          )}
        </div>

        {selected?.canSend === false && !blocked ? (
          <p role="status" className="floating-chat-status">
            Messaging is currently unavailable for this contact. Your previous messages remain available.
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="floating-chat-error" id={errorId}>
            {error}
          </p>
        ) : null}

        <form
          className="message-composer floating-chat-composer"
          data-no-floating-label
          inert={blocked || !canSend || undefined}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor={textId}>
            Write a message
          </label>
          <textarea
            id={textId}
            ref={textRef}
            name="text"
            rows={2}
            maxLength={real ? 4000 : 2000}
            placeholder={blocked ? "Unblock this conversation to reply" : "Write a message..."}
            aria-label="Write a message"
            disabled={blocked || !canSend || draft.busy}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            defaultValue={draft.text}
            key={chat.conversationId}
            onInput={(e) => patchDraft(draftKey, { text: e.currentTarget.value })}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
              e.preventDefault();
              void send();
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
              {/* Recruiters do not attach resumes from Applications chat. */}
              <div className="message-emoji-wrap">
                <button
                  type="button"
                  className="iconbtn"
                  aria-label="Choose emoji"
                  aria-expanded={emojiOpen}
                  disabled={blocked || !canSend || draft.busy}
                  onClick={() => setEmojiOpen((v) => !v)}
                >
                  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M8 14s1 3 4 3 4-3 4-3M8 9h.01M16 9h.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
                <div className="message-emoji-picker" aria-label="Emoji picker" hidden={!emojiOpen}>
                  {EMOJIS.map((emoji) => (
                    <button type="button" key={emoji} aria-label={"Insert " + emoji} onClick={() => insertEmoji(emoji)}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              className="btn primary sm"
              type="submit"
              disabled={(!draft.text.trim() && !draft.files.length) || draft.busy || blocked || !canSend}
            >
              Send <Icon name="send" />
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}
