import type { PersonSummary } from "@/types/api";
import type { Conversation, DemoDatabase, Role } from "@/types/domain";
import { commit, getDb } from "@/mocks/store/demo-db";
import { personSummary } from "@/mocks/store/presenters";
import { me, ME_ID, person } from "@/mocks/store/selectors";
import { uid } from "@/lib/utils/id";
import type { ConversationFlag, ConversationView, MessagingService } from "./messaging.service";

const flag = (c: Conversation, key: ConversationFlag, role: Role) => (c[key] || []).includes(role);
const available = (db: DemoDatabase, role: Role) => db.conversations.filter((c) => (role === "recruiter" || c.candidate === ME_ID) && !flag(c, "deletedBy", role));

const contact = (db: DemoDatabase, c: Conversation, role: Role): PersonSummary =>
  role === "recruiter" ? personSummary(person(db, c.candidate)) : { id: "company-" + c.company, name: c.name, headline: c.company, color: "#E4E9EF" };

const self = (db: DemoDatabase, role: Role): PersonSummary => (role === "recruiter" ? { id: "r0", name: db.companies[0].recruiter, color: "#E4E9EF" } : personSummary(me(db)));

function conversationView(db: DemoDatabase, c: Conversation, role: Role): ConversationView {
  return {
    id: c.id,
    contact: contact(db, c, role),
    company: c.company,
    self: self(db, role),
    messages: c.messages,
    flags: { starred: flag(c, "starredBy", role), muted: flag(c, "mutedBy", role), blocked: flag(c, "blockedBy", role), archived: flag(c, "archivedBy", role), jobLabel: flag(c, "jobLabelBy", role) },
  };
}

export const mockMessagingService: MessagingService = {
  async getInbox(role, { q, filter, selectedId }) {
    const db = getDb();
    const inbox = available(db, role).filter((c) => (filter === "archived" ? flag(c, "archivedBy", role) : !flag(c, "archivedBy", role)));
    const query = q.toLowerCase().trim();
    const threads = inbox
      .filter((c) => {
        const p = contact(db, c, role);
        return (
          (!query || [p.name, c.company, ...c.messages.map((m) => m.text)].join(" ").toLowerCase().includes(query)) &&
          (filter !== "unread" || c.unread) &&
          (filter !== "starred" || flag(c, "starredBy", role)) &&
          (filter !== "jobs" || flag(c, "jobLabelBy", role))
        );
      })
      .map((c) => ({ id: c.id, contact: contact(db, c, role), company: c.company, unread: c.unread, lastMessage: c.messages.at(-1) }));
    const selected = inbox.find((c) => c.id === selectedId) ?? inbox[0];
    return { threads, unreadCount: inbox.filter((c) => c.unread).length, selected: selected ? conversationView(db, selected, role) : null };
  },

  async markRead(role, id) {
    if (!available(getDb(), role).some((x) => x.id === id && x.unread)) return;
    commit((db) => {
      db.conversations.find((x) => x.id === id)!.unread = false;
    });
  },

  async markUnread(role, id) {
    if (!available(getDb(), role).some((x) => x.id === id)) return;
    commit((db) => {
      db.conversations.find((x) => x.id === id)!.unread = true;
    });
  },

  async toggleFlag(role, id, key) {
    let on = false;
    commit((db) => {
      const c = db.conversations.find((x) => x.id === id);
      if (!c) return;
      const list = c[key] ?? [];
      on = !list.includes(role);
      c[key] = on ? [...list, role] : list.filter((r) => r !== role);
    });
    return on;
  },

  async send(role, id, text, attachments) {
    return commit(
      (db) => {
        const c = db.conversations.find((x) => x.id === id);
        if (!c || (c.blockedBy || []).includes(role)) return;
        c.messages.push({ id: uid(), text, sender: role, time: new Date().toISOString(), attachments: attachments.map((a) => ({ ...a })) });
        c.unread = false;
      },
      { rollbackOnFailure: true },
    );
  },

  async report(role, id, reason, details) {
    commit((db) => {
      const c = db.conversations.find((x) => x.id === id);
      if (c) (c.reports ??= []).push({ role, reason, details, time: new Date().toISOString() });
    });
  },

  async listRecipients(role) {
    const db = getDb();
    return role === "recruiter" ? db.professionals.filter((p) => p.public).map(personSummary) : db.companies.map((c) => ({ id: c.id, name: c.recruiter, headline: c.name }));
  },

  async start(role, targetId, options = {}) {
    const db = getDb();
    const company = role === "recruiter" ? db.companies[0] : db.companies.find((c) => c.id === targetId);
    const candidate = role === "recruiter" ? targetId : ME_ID;
    if (!company || !db.professionals.some((p) => p.id === candidate)) return null;
    const existing = db.conversations.find((c) => c.candidate === candidate && (options.anyCompany || c.company === company.name));
    const id = existing?.id ?? uid();
    commit((d) => {
      let c = d.conversations.find((x) => x.id === id);
      if (!c) {
        d.conversations.unshift({ id, candidate, name: company.recruiter, company: company.name, unread: false, messages: [] });
        c = d.conversations[0];
      }
      for (const key of ["deletedBy", "archivedBy"] as const) c[key] = (c[key] || []).filter((r) => r !== role);
    });
    return id;
  },
};
