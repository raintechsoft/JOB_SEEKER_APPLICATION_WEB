import type { Message, MessageStatus } from "@/types/domain";
import type { ConversationView, Inbox } from "@/services/messaging/messaging.service";

export type MessageTick = "clock" | MessageStatus;

const rank: Record<MessageStatus, number> = { sent: 1, delivered: 2, seen: 3 };

function strongerStatus(current: Message["status"] | undefined, next: Message["status"] | undefined): Message["status"] | undefined {
  if (!current || !(current in rank)) return next;
  if (!next || !(next in rank)) return current;
  return rank[current] >= rank[next] ? current : next;
}

/** Own outgoing ticks only. Incoming bubbles never show a receipt. */
export function outgoingTick(message: Pick<Message, "id" | "own" | "status">): MessageTick | null {
  if (!(message.own ?? false)) return null;
  if (message.id?.startsWith("pending-")) return "clock";
  if (message.status === "sent" || message.status === "delivered" || message.status === "seen") return message.status;
  return null;
}

export function tickLabel(tick: MessageTick): string {
  return { clock: "Sending", sent: "Sent", delivered: "Delivered", seen: "Seen" }[tick];
}

export function nextReceiptStatus(current: Message["status"] | undefined, kind: "delivered" | "seen"): MessageStatus {
  const next: MessageStatus = kind === "seen" ? "seen" : "delivered";
  if (!current || !(current in rank)) return next;
  return rank[current] >= rank[next] ? current : next;
}

export function applyReceiptToMessages<T extends Pick<Message, "own" | "sequence" | "status">>(messages: T[], kind: "delivered" | "seen", throughSequence: number): T[] {
  return messages.map((message) => {
    if (!(message.own ?? false) || (message.sequence ?? 0) > throughSequence) return message;
    const status = nextReceiptStatus(message.status, kind);
    return status === message.status ? message : { ...message, status };
  });
}

/** Watermarks are authoritative through-sequence receipts; a stale snapshot must not roll ticks back. */
export function applyPeerReceipts<T extends Pick<Message, "own" | "sequence" | "status">>(messages: T[], deliveredSequence = 0, readSequence = 0): T[] {
  return applyReceiptToMessages(applyReceiptToMessages(messages, "delivered", deliveredSequence), "seen", readSequence);
}

export function keepConversationReceipts<T extends Pick<ConversationView, "messages" | "peerDeliveredSequence" | "peerReadSequence">>(previous: T | undefined, next: T): T {
  const byId = new Map((previous?.messages ?? []).map((message) => [message.id, message]));
  const delivered = Math.max(previous?.peerDeliveredSequence ?? 0, next.peerDeliveredSequence ?? 0);
  const seen = Math.max(previous?.peerReadSequence ?? 0, next.peerReadSequence ?? 0);
  const merged = next.messages.map((message) => {
    const prior = byId.get(message.id);
    if (!message.own) return message;
    const status = strongerStatus(prior?.status, message.status);
    return status === message.status ? message : { ...message, status };
  });
  return { ...next, peerDeliveredSequence: delivered, peerReadSequence: seen, messages: applyPeerReceipts(merged, delivered, seen) };
}

export function keepInboxReceipts(previous: Inbox | undefined, next: Inbox): Inbox {
  return {
    ...next,
    selected: next.selected ? keepConversationReceipts(previous?.selected?.id === next.selected.id ? previous.selected : undefined, next.selected) : next.selected,
    threads: next.threads.map((thread) => {
      const prior = previous?.threads.find((item) => item.id === thread.id)?.lastMessage;
      if (!thread.lastMessage) return thread;
      const lastMessage = keepConversationReceipts(
        prior ? { messages: [prior], peerDeliveredSequence: 0, peerReadSequence: 0 } : undefined,
        { messages: [thread.lastMessage], peerDeliveredSequence: 0, peerReadSequence: 0 },
      ).messages[0];
      return lastMessage === thread.lastMessage ? thread : { ...thread, lastMessage };
    }),
  };
}
