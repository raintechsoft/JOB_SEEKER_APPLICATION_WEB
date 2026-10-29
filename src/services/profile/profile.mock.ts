import type { Draft } from "immer";
import type { DemoDatabase, ProfileRecord } from "@/types/domain";
import { commit, getDb } from "@/mocks/store/demo-db";
import { deleteProfileFile, getProfileFile, putProfileFile } from "@/mocks/store/file-store";
import { me, ME_ID, projectsFor } from "@/mocks/store/selectors";
import { profileCompletion, skillKey } from "@/lib/domain/profile";
import { today } from "@/lib/utils/date";
import { IMAGE_TYPES, MB, readAsDataUrl } from "@/lib/utils/files";
import { uid } from "@/lib/utils/id";
import { safeUrl } from "@/lib/utils/url";
import { hasEmploymentDates, memoryInEmployment } from "@/lib/validation/journey";
import type { JourneyChapter } from "../journey/journey.service";
import type { ProfileService, SaveResult } from "./profile.service";

const STORAGE_ERROR: SaveResult = { ok: false, error: "Browser storage is full or unavailable. Your changes are kept for this page only." };

/** Keeps the flat professional record consistent with the structured profile (prototype `syncProfile`). */
function syncProfile(db: Draft<DemoDatabase>) {
  const p = db.professionals[0];
  const d = p.professionalDetails!;
  p.skills = d.skills.map((s) => s.name);
  p.experience = d.employment
    .filter((e) => e.public)
    .map((e) => `${e.title}${e.company ? " at " + e.company : ""}${e.start ? " · " + e.start : ""}${e.current ? "–Present" : e.end ? "–" + e.end : ""}`)
    .join("\n");
  p.education = d.education
    .filter((e) => e.public)
    .map((e) => [e.degree, e.institution, e.end].filter(Boolean).join(" · "))
    .join("\n");
  const current = d.employment.find((e) => e.current);
  if (current) {
    d.currentTitle = String(current.title ?? "");
    d.currentCompany = String(current.company ?? "");
  }
  p.website = String(d.onlineProfiles.find((r) => r.public && safeUrl(String(r.url ?? "")))?.url ?? "");
  p.interests = d.career.interests;
  p.complete = profileCompletion(p, d, db.projects.filter((x) => x.owner === ME_ID).length).percent;
  d.updatedAt = new Date().toISOString();
  d.revision = (d.revision ?? 1) + 1;
  db.portfolios[p.id].title = p.name;
  db.portfolios[p.id].headline = p.headline;
}

const save = (recipe: (db: Draft<DemoDatabase>) => void, rollbackOnFailure=false): SaveResult =>
  commit((db) => {
    recipe(db);
    syncProfile(db);
  },{rollbackOnFailure})
    ? { ok: true }
    : STORAGE_ERROR;

const DATE_PAIRS = [
  ["start", "end"],
  ["issue", "expiry"],
  ["filing", "grant"],
] as const;

export const mockProfileService: ProfileService = {
  async getProfile() {
    const db = getDb();
    const p = me(db);
    return { version:p.professionalDetails?.revision??1, person: p, details: p.professionalDetails!, completion: profileCompletion(p, p.professionalDetails, projectsFor(db, ME_ID).length), projects: projectsFor(db, ME_ID) };
  },

  async saveRecord(collection, input) {
    const r: ProfileRecord = { ...input, id: input.id || uid() };
    const url = typeof r.url === "string" ? r.url.trim() : "";
    if (url && !safeUrl(url)) return { ok: false, error: "Use a complete HTTP or HTTPS URL." };
    if (url) r.url = safeUrl(url);
    if (r.current) r.end = "";
    if (r.neverExpires) r.expiry = "";
    for (const [start, end] of DATE_PAIRS) {
      if (r[start] && r[end] && String(r[end]) < String(r[start])) return { ok: false, error: "The end or completion date must be on or after the start date." };
    }
    const d = me(getDb()).professionalDetails!;
    if (collection === "employment") {
      const chapter = {start:String(r.start??""),end:String(r.end??""),current:!!r.current} as JourneyChapter;
      const memories = getDb().careerJourneys?.[ME_ID]?.memories.filter(m=>m.employmentId===r.id)??[];
      if (memories.some(m=>!hasEmploymentDates(chapter)||!memoryInEmployment(m.date,chapter))) return {ok:false,error:"These dates would exclude existing career memories. Update or move those memories first."};
    }
    if (collection === "skills" || collection === "technicalSkills" || collection === "languages") {
      const list = d[collection] as { id: string; name?: unknown }[];
      if (list.some((x) => x.id !== r.id && skillKey(String(x.name ?? "")) === skillKey(String(r.name ?? "")))) {
        return { ok: false, error: "That " + (collection === "languages" ? "language" : "skill") + " is already in your profile. Edit the existing entry." };
      }
    }
    return save((db) => {
      const details = db.professionals[0].professionalDetails!;
      if (collection === "technicalSkills") {
        let skill = details.skills.find((s) => skillKey(s.name) === skillKey(String(r.name)));
        if (!skill) {
          skill = { id: uid(), name: String(r.name), category: "Technical", level: "", years: "", featured: false };
          details.skills.push(skill);
        }
        r.name = skill.name;
        r.skillId = skill.id;
      }
      if (collection === "skills") {
        const skill = { id: r.id, name: String(r.name ?? ""), category: String(r.category ?? "Other"), level: String(r.level ?? ""), years: String(r.years ?? ""), featured: !!r.featured };
        const index = details.skills.findIndex((s) => s.id === r.id);
        if (index >= 0) {
          const old = details.skills[index];
          for (const t of details.technicalSkills) if (t.skillId === old.id) t.name = skill.name;
          details.skills[index] = skill;
        } else details.skills.unshift(skill);
        return;
      }
      const list = details[collection] as ProfileRecord[];
      const index = list.findIndex((x) => x.id === r.id);
      if (index < 0) {
        list.unshift(r);
        if (collection === "employment" || collection === "education") list.sort((a, b) => String(b.start || "").localeCompare(String(a.start || "")));
      } else list[index] = r;
    });
  },

  async deleteRecord(collection, id, revision, confirmJourneyDelete = false) {
    if (revision !== undefined && revision !== (me(getDb()).professionalDetails?.revision ?? 1)) throw new Error("Your profile changed. Reload before saving.");
    const result = save((db) => {
      if (collection === "employment") {
        const journey = db.careerJourneys?.[ME_ID];
        if (journey) {
          if (!confirmJourneyDelete && (journey.memories.some(m=>m.employmentId===id)||journey.colleagues.some(c=>c.employmentId===id))) throw new Error("Confirm deletion of this workplace and its career memories and colleagues.");
          journey.memories=journey.memories.filter(m=>m.employmentId!==id);
          journey.colleagues=journey.colleagues.filter(c=>c.employmentId!==id);
        }
      }
      const d = db.professionals[0].professionalDetails!;
      if (collection === "skills") {
        const skill = d.skills.find((s) => s.id === id);
        d.technicalSkills = d.technicalSkills.filter((t) => t.skillId !== id && skillKey(String(t.name ?? "")) !== skillKey(skill?.name || ""));
        d.skills = d.skills.filter((s) => s.id !== id);
        return;
      }
      const list = d[collection] as ProfileRecord[];
      const index = list.findIndex((r) => r.id === id);
      if (index >= 0) list.splice(index, 1);
    },true);
    if (!result.ok) throw new Error("Browser storage is full or unavailable. Your changes were not saved.");
  },

  async moveRecord(collection, id, offset) {
    save((db) => {
      const d = db.professionals[0].professionalDetails!;
      const list: { id: string; owner?: string }[] = collection === "projects" ? db.projects : (d[collection] as { id: string }[]);
      const indexes = list.map((r, i) => ({ r, i })).filter(({ r }) => collection !== "projects" || r.owner === ME_ID);
      const at = indexes.findIndex(({ r }) => r.id === id);
      const next = at + offset;
      if (at < 0 || next < 0 || next >= indexes.length) return;
      const a = indexes[at].i;
      const b = indexes[next].i;
      [list[a], list[b]] = [list[b], list[a]];
    });
  },

  async toggleFeaturedSkill(id) {
    save((db) => {
      const s = db.professionals[0].professionalDetails!.skills.find((x) => x.id === id);
      if (s) s.featured = !s.featured;
    });
  },

  async saveSection(section, values) {
    const text = (k: string) => String(values[k] ?? "").trim();
    if (section === "career" && text("salary") && !text("currency")) return { ok: false, error: "Choose a currency when entering expected compensation." };
    if (section === "personal" && text("dob") > today()) return { ok: false, error: "Date of birth cannot be in the future." };
    return save((db) => {
      const p = db.professionals[0];
      const d = p.professionalDetails!;
      const strings = Object.fromEntries(Object.entries(values).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, String(v).trim()]));
      if (section === "identity") {
        for (const k of ["name", "headline", "location", "email"] as const) p[k] = text(k);
        p.years = Number(text("years"));
        p.available = !!values.available;
        p.public = !!values.public;
        for (const k of ["phone", "currentTitle", "currentCompany", "employmentStatus"] as const) d[k] = text(k);
        const current = d.employment.find((e) => e.current);
        if (current) {
          current.title = d.currentTitle;
          current.company = d.currentCompany;
        }
        d.privacy.email = !!values.publicEmail;
        d.privacy.phone = !!values.publicPhone;
      }
      if (section === "headline") {
        p.headline = text("headline");
        d.focus = text("focus");
      }
      if (section === "summary") {
        p.summary = text("summary");
        d.strengths = text("strengths");
        d.career.interests = text("interests");
      }
      if (section === "career") Object.assign(d.career, strings);
      if (section === "personal") Object.assign(d.personal, strings);
      if (section === "diversity") Object.assign(d.diversity, strings);
    });
  },

  async setPhoto(file) {
    if (!file?.size || file.size > MB || !IMAGE_TYPES.includes(file.type)) return { ok: false, error: "Choose a PNG, JPEG, or WebP photo smaller than 1 MB." };
    const picture = await readAsDataUrl(file);
    const ok = commit(
      (db) => {
        db.professionals[0].picture = picture;
        db.professionals[0].professionalDetails!.photoRemoved = false;
        syncProfile(db);
      },
      { rollbackOnFailure: true },
    );
    return ok ? { ok: true } : { ok: false, error: "Browser storage is full. Try a smaller photo." };
  },

  async useDefaultPhoto() {
    const persisted = commit((db) => {
      db.professionals[0].picture = "";
      db.professionals[0].professionalDetails!.photoRemoved = true;
      syncProfile(db);
    }, { rollbackOnFailure: true });
    if (!persisted) throw new Error("Your photo could not be removed. Please try again.");
  },

  async setCover(file) {
    if (!file?.size || file.size > MB || !IMAGE_TYPES.includes(file.type)) return { ok: false, error: "Choose a PNG, JPEG, or WebP image smaller than 1 MB." };
    const cover = await readAsDataUrl(file);
    const ok = commit((db) => { db.professionals[0].cover = cover; syncProfile(db); }, { rollbackOnFailure: true });
    return ok ? { ok: true } : { ok: false, error: "Browser storage is full. Try a smaller image." };
  },

  async removeCover() {
    const persisted = commit((db) => { db.professionals[0].cover = ""; syncProfile(db); }, { rollbackOnFailure: true });
    if (!persisted) throw new Error("Your cover image could not be removed. Please try again.");
  },

  async uploadResume(file) {
    if (file.size > 2 * MB || !/^.+\.(pdf|docx?|rtf)$/i.test(file.name)) return { ok: false, error: "Choose a PDF, DOC, DOCX, or RTF file up to 2 MB." };
    const old = me(getDb()).professionalDetails?.resume;
    const id = uid();
    try {
      await putProfileFile(id, file);
      const ok = commit(
        (db) => {
          db.professionals[0].professionalDetails!.resume = { id, name: file.name, size: file.size, format: file.name.split(".").at(-1)!.toUpperCase(), uploadedAt: new Date().toISOString() };
          syncProfile(db);
        },
        { rollbackOnFailure: true },
      );
      if (!ok) {
        await deleteProfileFile(id);
        throw new Error("storage");
      }
      if (old) await deleteProfileFile(old.id);
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not save the file. Browser storage may be unavailable." };
    }
  },

  async downloadResume() {
    const r = me(getDb()).professionalDetails?.resume;
    if (!r) return null;
    const blob = await getProfileFile(r.id);
    return blob ? { name: r.name, blob } : null;
  },

  async removeResume() {
    const r = me(getDb()).professionalDetails?.resume;
    try {
      if (r) await deleteProfileFile(r.id);
      save((db) => {
        db.professionals[0].professionalDetails!.resume = null;
      });
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not remove the local file. Try again." };
    }
  },
};
