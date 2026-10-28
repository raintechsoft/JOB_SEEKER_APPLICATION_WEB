import type { Conversation, DemoDatabase, Role } from "@/types/domain";
import { commit, getDb, resetDb } from "@/mocks/store/demo-db";
import { clearProfileFiles } from "@/mocks/store/file-store";
import { personSummary } from "@/mocks/store/presenters";
import { currentRecruiter, homeCompany, me, ME_ID, recruiterIdentity, updatesFor } from "@/mocks/store/selectors";
import type { WorkspaceService } from "./workspace.service";

const hiddenFor = (c: Conversation, role: Role) => (["deletedBy", "archivedBy", "mutedBy"] as const).some((key) => (c[key] || []).includes(role));

export function unreadConversations(db: DemoDatabase, role: Role) {
  return db.conversations.filter((c) => (role === "recruiter" || c.candidate === ME_ID) && c.unread && !hiddenFor(c, role)).length;
}

export const mockWorkspaceService: WorkspaceService = {
  async getSession() {
    return getDb().session;
  },

  async setRole(role) {
    if (getDb().session?.role === role) return;
    commit((db) => {
      db.session = { role };
    });
  },

  async signIn(role) {
    commit((db) => {
      db.session = { role };
    });
  },

  async signUp(role, name) {
    commit((db) => {
      db.session = { role };
      if (role === "professional") {
        db.professionals[0].name = name;
        db.portfolios[ME_ID].title = name;
      } else db.companies[0].recruiter = name;
    });
  },

  async signOut() {
    commit((db) => {
      db.session = null;
    });
  },

  async getProfessionalShell() {
    const db = getDb();
    const p = me(db);
    return { person: { ...personSummary(p), email: p.email, location: p.location, complete: p.complete }, unreadConversations: unreadConversations(db, "professional") };
  },

  async getRecruiterShell() {
    const db = getDb();
    const c = homeCompany(db);
    return { identity: recruiterIdentity(db), companyName: c.name, title: c.title ?? "", email: currentRecruiter(db)?.workEmail || c.email || "", unreadConversations: unreadConversations(db, "recruiter"), savedCount: db.recruiterSocial.saved.length };
  },

  async getProfessionalSummary() {
    const db = getDb();
    const p = me(db);
    return {
      person: { ...personSummary(p), location: p.location, complete: p.complete, cover: p.cover },
      pulseDays: new Set(updatesFor(db, ME_ID).map((u) => u.date)).size,
      followingCount: db.social.following.length + db.social.followingCompanies.length,
      savedCount: db.social.saved.length,
    };
  },

  async getHomeCompany() {
    return homeCompany(getDb());
  },

  async getSettings() {
    const db = getDb();
    const p = me(db);
    return { ...db.settings, profilePublic: p.public, portfolioPublic: db.portfolios[ME_ID].public, name: p.name, email: p.email };
  },

  async updateSetting(key, value) {
    return commit((db) => {
      if (key === "profile-public") db.professionals[0].public = value;
      if (key === "portfolio-public") db.portfolios[ME_ID].public = value;
      if (key === "updates-public") db.settings.updatesPublic = value;
      if (key === "notifications") db.settings.notifications = value;
    });
  },

  async resetDemo() {
    await clearProfileFiles().catch(() => undefined);
    resetDb();
  },
};
