import type { Draft } from "immer";
import type { DemoDatabase, Id } from "@/types/domain";
import { commit, getDb } from "@/mocks/store/demo-db";
import { ME_ID, projectsFor, updatesFor } from "@/mocks/store/selectors";
import { profileCompletion } from "@/lib/domain/profile";
import { DAY_MS, today } from "@/lib/utils/date";
import { IMAGE_TYPES, MB, readAsDataUrl } from "@/lib/utils/files";
import { uid } from "@/lib/utils/id";
import { safeUrl } from "@/lib/utils/url";
import type { Pulse, WorkService } from "./work.service";

function refreshCompletion(db: Draft<DemoDatabase>) {
  const p = db.professionals[0];
  p.complete = profileCompletion(p, p.professionalDetails, db.projects.filter((x) => x.owner === ME_ID).length).percent;
}

export function buildPulse(db: DemoDatabase, ownerId: Id, days: number): Pulse {
  const updates = updatesFor(db, ownerId);
  const end = new Date(today() + "T12:00:00");
  const total = Math.ceil(days / 7) * 7;
  const counts: Record<string, number> = {};
  for (const u of updates) counts[u.date] = (counts[u.date] || 0) + 1;
  const start = new Date(end.getTime() - (total - 1) * DAY_MS);
  const months: string[] = [];
  for (let k = 0; k < total; k += 28) months.push(new Date(start.getTime() + k * DAY_MS).toLocaleDateString("en", { month: "short" }));
  const cells = Array.from({ length: total }, (_, i) => {
    const date = new Date(start.getTime() + i * DAY_MS).toISOString().slice(0, 10);
    return { date, count: counts[date] || 0 };
  });
  const inRange = updates.filter((u) => (new Date(today()).getTime() - new Date(u.date).getTime()) / DAY_MS < days);
  const recentDays = Array.from({ length: 22 }, (_, i) => i).filter((i) => updates.some((u) => Math.floor((new Date(today()).getTime() - new Date(u.date).getTime()) / DAY_MS) === i));
  return { cells, months, totalDays: total, updateCount: inRange.length, activeDays: new Set(inRange.map((u) => u.date)).size, projectCount: projectsFor(db, ownerId).length, recentDays };
}

export const mockWorkService: WorkService = {
  async listProjects({ ownerId, category, visibility, q }) {
    const query = (q || "").trim().toLowerCase();
    return projectsFor(getDb(), ownerId)
      .filter((p) => (!category || p.category === category) && (!visibility || p.visibility === visibility) && (!query || [p.title, p.description, ...p.skills].join(" ").toLowerCase().includes(query)))
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  async getProject(id) {
    return getDb().projects.find((p) => p.id === id) ?? null;
  },

  async getProjects(ids) {
    const db = getDb();
    return ids.map((id) => db.projects.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  },

  async saveProject(input) {
    if (input.start > input.date) return { ok: false, error: "Completion date must be on or after the start date." };
    const db = getDb();
    const id = input.id || uid();
    const old = db.projects.find((p) => p.id === id);
    let cover = old?.cover || "";
    const file = input.coverFile;
    if (file?.size) {
      if (file.size > MB || !IMAGE_TYPES.includes(file.type)) return { ok: false, error: "Choose a PNG, JPEG, or WebP cover smaller than 1 MB." };
      cover = await readAsDataUrl(file);
    }
    if (!input.skills.length) return { ok: false, error: "Add at least one skill." };
    const persisted = commit((d) => {
      const item = {
        id,
        owner: ME_ID,
        title: input.title,
        description: input.description,
        contribution: input.contribution,
        category: input.category,
        skills: input.skills,
        url: safeUrl(input.url),
        repository: safeUrl(input.repository),
        start: input.start,
        date: input.date,
        visibility: input.visibility,
        featured: input.featured,
        art: old?.art ?? d.projects.length % 5,
        cover,
      };
      const index = d.projects.findIndex((p) => p.id === id);
      if (index < 0) d.projects.unshift(item);
      else d.projects[index] = item;
      refreshCompletion(d);
    });
    return { ok: true, persisted };
  },

  async deleteProject(id) {
    commit((db) => {
      db.projects = db.projects.filter((p) => p.id !== id);
      db.updates.forEach((u) => {
        if (u.project === id) u.project = "";
      });
      for (const r of db.professionals[0].professionalDetails?.employment ?? []) if (r.projects) r.projects = r.projects.filter((p) => p !== id);
      refreshCompletion(db);
    });
  },

  async setProjectFeatured(id, featured) {
    commit((db) => {
      const p = db.projects.find((x) => x.id === id);
      if (p) p.featured = featured;
    });
  },

  async listUpdates(ownerId, options = {}) {
    let list = updatesFor(getDb(), ownerId);
    if (options.publicOnly) list = list.filter((u) => u.visibility === "Public");
    if (options.date) list = list.filter((u) => u.date === options.date);
    return options.limit ? list.slice(0, options.limit) : list;
  },

  async getUpdate(id) {
    return getDb().updates.find((u) => u.id === id) ?? null;
  },

  async saveUpdate(input) {
    return commit((db) => {
      const id = input.id || uid();
      const item = { ...input, id, owner: ME_ID };
      const index = db.updates.findIndex((u) => u.id === id);
      if (index < 0) db.updates.unshift(item);
      else db.updates[index] = item;
      db.professionals[0].lastActive = today();
    });
  },

  async deleteUpdate(id) {
    commit((db) => {
      db.updates = db.updates.filter((u) => u.id !== id);
    });
  },

  async getPulse(ownerId, days) {
    return buildPulse(getDb(), ownerId, days);
  },
};
