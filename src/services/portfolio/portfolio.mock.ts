import type { DemoDatabase, Id } from "@/types/domain";
import { commit, getDb } from "@/mocks/store/demo-db";
import { findProfessional, ME_ID, updatesFor } from "@/mocks/store/selectors";
import { publicProjects, toPublicProfessional } from "@/services/talent/public-profile";
import type { PortfolioService, PortfolioView } from "./portfolio.service";

function view(db: DemoDatabase, id: Id): PortfolioView | null {
  const p = findProfessional(db, id);
  const config = db.portfolios[id];
  if (!p || !config) return null;
  return {
    person: toPublicProfessional(p),
    config,
    projects: publicProjects(db, id).filter((x) => x.featured),
    updates: updatesFor(db, id)
      .filter((u) => u.visibility === "Public")
      .slice(0, 3),
  };
}

export const mockPortfolioService: PortfolioService = {
  async getPortfolio(ownerId) {
    return view(getDb(), ownerId === "me" ? ME_ID : ownerId);
  },

  async getPortfolioBySlug(slug) {
    const db = getDb();
    const id = Object.keys(db.portfolios).find((k) => db.portfolios[k].slug === slug);
    return id ? view(db, id) : null;
  },

  async saveSettings(input) {
    const db = getDb();
    if (Object.entries(db.portfolios).some(([id, c]) => id !== ME_ID && c.slug === input.slug)) return { ok: false, persisted: false };
    const persisted = commit((d) => {
      Object.assign(d.portfolios[ME_ID], input);
    });
    return { ok: true, persisted };
  },

  async setSectionVisible(index, visible) {
    commit((db) => {
      const s = db.portfolios[ME_ID].sections[index];
      if (s) s.visible = visible;
    });
  },

  async moveSection(index, offset) {
    commit((db) => {
      const s = db.portfolios[ME_ID].sections;
      const next = index + offset;
      if (next < 0 || next >= s.length) return;
      [s[index], s[next]] = [s[next], s[index]];
    });
  },

  async saveSharing(ownerId, input) {
    return commit((db) => {
      Object.assign(db.portfolios[ownerId === "me" ? ME_ID : ownerId], input);
    });
  },
};
