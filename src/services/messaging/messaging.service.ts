import type { PersonSummary } from "@/types/api";
import type { Id, Message, MessageAttachment, Role } from "@/types/domain";

export type MessageFilter = "all" | "jobs" | "unread" | "starred" | "archived";
export type ConversationFlag = "jobLabelBy" | "mutedBy" | "archivedBy" | "blockedBy" | "starredBy" | "deletedBy";

export interface ThreadSummary {
  id: Id;
  contact: PersonSummary;
  company: string;
  unread: boolean;
  lastMessage?: Message;
}

export interface ConversationView {
  canSend?: boolean;
  readSequence?: number;
  nextBefore?: number | null;
  id: Id;
  contact: PersonSummary;
  company: string;
  self: PersonSummary;
  messages: Message[];
  flags: { starred: boolean; muted: boolean; blocked: boolean; archived: boolean; jobLabel: boolean };
}

export interface Inbox {
  threads: ThreadSummary[];
  /** Unread count across the current (non-archived or archived) inbox, before search filtering. */
  unreadCount: number;
  /** The conversation to show: the requested one if available, otherwise the first in the inbox. */
  selected: ConversationView | null;
}

export interface MessagingService {
  getUnreadCount?(role:Role):Promise<number>;
  getEarlier?(role: Role, id: Id, before: number): Promise<ConversationView>;
  getHistory?(role:Role,id:Id,limit:number):Promise<ConversationView>;
  getInbox(role: Role, query: { q: string; filter: MessageFilter; selectedId: Id | null }): Promise<Inbox>;
  markRead(role: Role, id: Id, sequence?:number): Promise<void>;
  markUnread(role: Role, id: Id): Promise<void>;
  toggleFlag(role: Role, id: Id, flag: ConversationFlag): Promise<boolean>;
  send(role: Role, id: Id, text: string, attachments: MessageAttachment[]): Promise<boolean>;
  report(role: Role, id: Id, reason: string, details: string): Promise<void>;
  listRecipients(role: Role): Promise<PersonSummary[]>;
  /**
   * Opens (or creates) a conversation with a professional (recruiter) or a company (professional).
   * `anyCompany` reuses an existing thread with the candidate regardless of company ("Contact").
   */
  start(role: Role, targetId: Id, options?: { anyCompany?: boolean }): Promise<Id | null>;
}
