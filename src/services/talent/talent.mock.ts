import type { DemoDatabase, Id, Professional } from "@/types/domain";
import { commit, getDb } from "@/mocks/store/demo-db";
import { projectSummary } from "@/mocks/store/presenters";
import { person, projectsFor, updatesFor } from "@/mocks/store/selectors";
import { DAY_MS, today } from "@/lib/utils/date";
import { uid } from "@/lib/utils/id";
import { buildPulse } from "@/services/work/work.mock";
import { publicProjects, toPublicProfessional } from "./public-profile";
import type { CandidateView, TalentCardData, TalentService } from "./talent.service";

const isSaved = (db: DemoDatabase, id: Id) => db.shortlists.some((s) => s.candidates.includes(id));

export function talentCard(db: DemoDatabase, p: Professional): TalentCardData {
  const proj = projectsFor(db, p.id)[0];
  return { ...toPublicProfessional(p), featuredProject: proj ? projectSummary(proj) : undefined, saved: isSaved(db, p.id), recentDays: buildPulse(db, p.id, 7).recentDays };
}

function candidate(db: DemoDatabase, p: Professional): CandidateView {
  return {
    person: toPublicProfessional(p),
    projects: publicProjects(db, p.id),
    updates: updatesFor(db, p.id)
      .filter((u) => u.visibility === "Public")
      .slice(0, 4),
    portfolioSlug: db.portfolios[p.id].slug,
    saved: isSaved(db, p.id),
  };
}

export const mockTalentService: TalentService = {
  async search(f) {
    const db = getDb();
    const query = f.q.toLowerCase().trim();
    const list = db.professionals
      .filter((p) => p.public)
      .filter((p) => {
        const text = [p.name, p.headline, ...p.skills, ...projectsFor(db, p.id).map((pr) => pr.title + " " + pr.description)].join(" ").toLowerCase();
        return (
          (!query || query.split(/\s+/).every((q) => text.includes(q))) &&
          (!f.category || p.category === f.category) &&
          (!f.skill || p.skills.includes(f.skill)) &&
          (!f.location || p.location === f.location) &&
          (!f.years || (f.years === "0-4" ? p.years < 5 : f.years === "5-7" ? p.years >= 5 && p.years <= 7 : p.years > 7)) &&
          (!f.availability || (f.availability === "available" ? p.available : p.arrangement === f.availability)) &&
          (!f.completeness || p.complete >= 90) &&
          (!f.recent || (new Date(today()).getTime() - new Date(p.lastActive).getTime()) / DAY_MS <= 2)
        );
      });
    if (f.sort === "experience") list.sort((a, b) => b.years - a.years);
    if (f.sort === "recent") list.sort((a, b) => b.lastActive.localeCompare(a.lastActive));
    if (f.sort === "relevance" && query) {
      const score = (p: Professional) => p.skills.filter((s) => s.toLowerCase().includes(query)).length * 2 + (p.headline.toLowerCase().includes(query) ? 3 : 0);
      list.sort((a, b) => score(b) - score(a));
    }
    return list.map((p) => talentCard(db, p));
  },

  async getFilterOptions() {
    const db = getDb();
    return { locations: [...new Set(db.professionals.map((p) => p.location))], skills: [...new Set(db.professionals.flatMap((p) => p.skills))].sort() };
  },

  async getCandidate(id) {
    const db = getDb();
    const p = db.professionals.find((x) => x.id === id);
    return p ? candidate(db, p) : null;
  },

  async getCandidateBySlug(slug) {
    const db = getDb();
    const p = db.professionals.find((x) => x.slug === slug);
    return p ? candidate(db, p) : null;
  },

  async listShortlists() {
    const db = getDb();
    return db.shortlists.map((s) => ({ ...s, people: s.candidates.map((id) => talentCard(db, person(db, id))) }));
  },

  async createShortlist(name) {
    const id = uid();
    commit((db) => {
      db.shortlists.push({ id, name, candidates: [] });
    });
    return id;
  },

  async renameShortlist(id, name) {
    commit((db) => {
      const s = db.shortlists.find((x) => x.id === id);
      if (s) s.name = name;
    });
  },

  async deleteShortlist(id) {
    commit((db) => {
      db.shortlists = db.shortlists.filter((s) => s.id !== id);
    });
  },

  async removeFromShortlist(shortlistId, candidateId) {
    return commit((db) => {
      const s = db.shortlists.find((x) => x.id === shortlistId);
      if (s) s.candidates = s.candidates.filter((v) => v !== candidateId);
    });
  },

  async setCandidateShortlists(candidateId, shortlistIds) {
    return commit((db) => {
      for (const s of db.shortlists) {
        s.candidates = s.candidates.filter((c) => c !== candidateId);
        if (shortlistIds.includes(s.id)) s.candidates.push(candidateId);
      }
    });
  },

  async compare(ids) {
    const db = getDb();
    return ids.map((id) => {
      const p = person(db, id);
      return {
        ...toPublicProfessional(p),
        featuredWork: projectsFor(db, p.id)
          .filter((pr) => pr.featured && pr.visibility === "Public")
          .map((pr) => ({ id: pr.id, title: pr.title })),
        portfolioSlug: db.portfolios[p.id].slug,
        publicUpdates: updatesFor(db, p.id).filter((u) => u.visibility === "Public").length,
      };
    });
  },

  async listPublicPeople() {
    return getDb()
      .professionals.filter((p) => p.public)
      .map(toPublicProfessional);
  },

  async getRecommendedTalent() {
    const db = getDb();
    return [...db.professionals].filter(p => p.public).sort((a, b) => b.lastActive.localeCompare(a.lastActive)).slice(0, 3).map(p => talentCard(db, p));
  },

  async getOverview() {
    const db = getDb();
    return {
      talentCount: db.professionals.filter((p) => p.public).length,
      savedCandidates: db.shortlists.reduce((n, s) => n + s.candidates.length, 0),
      shortlists: db.shortlists,
      conversationCount: db.conversations.length,
      recentTalent: [...db.professionals]
        .filter((p) => p.public)
        .sort((a, b) => b.lastActive.localeCompare(a.lastActive))
        .slice(0, 3)
        .map((p) => talentCard(db, p)),
      conversations: db.conversations.slice(0, 3).map((c) => ({ id: c.id, person: toPublicProfessional(person(db, c.candidate)), lastMessage: c.messages.at(-1)?.text ?? "" })),
    };
  },
};
