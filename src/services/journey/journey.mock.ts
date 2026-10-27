import type {
  JourneyChapter,
  JourneyService,
  JourneyStore,
} from "./journey.service";
import type { Draft } from "immer";
import type { DemoDatabase } from "@/types/domain";
import { commit, getDb, reloadDb } from "@/mocks/store/demo-db";
import {
  validateMemory,
  colleagueSchema,
  JOURNEY_RULES,
} from "@/lib/validation/journey";
import { validateMedia } from "@/lib/validation/profile";
import { mockFeedService, blockedInMock } from "../feed/feed.mock";
import { buildProfessionalDetails } from "@/mocks/data/profile";
import type { Professional } from "@/types/domain";

const normalizeCompany = (name: string) =>
  name.replace(/\s+/gu, " ").trim().toLowerCase();
function sameCompany(person: Professional, company: string) {
  const normalized = normalizeCompany(company);
  return (
    !!normalized &&
    (
      person.professionalDetails ?? buildProfessionalDetails(person)
    ).employment.some(
      (e) =>
        e.public && normalizeCompany(String(e.company ?? "")) === normalized,
    )
  );
}

const empty = (): JourneyStore => ({ memories: [], colleagues: [] });
function context(slug?: string) {
  const db = getDb(),
    person = slug
      ? db.professionals.find((p) => p.slug === slug && p.public)
      : db.professionals[0];
  if (!person) throw new Error("This career journey is unavailable.");
  const store = db.careerJourneys?.[person.id] ?? empty();
  const chapters: JourneyChapter[] = (
    person.professionalDetails?.employment ?? []
  )
    .filter((e) => !slug || e.public)
    .map((e) => {
      const memories = store.memories.filter(
        (m) => m.employmentId === e.id && (!slug || m.public),
      );
      return {
        id: e.id,
        company: String(e.company ?? ""),
        title: String(e.title ?? ""),
        start: String(e.start ?? ""),
        end: String(e.end ?? ""),
        current: !!e.current,
        public: !!e.public,
        years: [
          ...new Set(memories.map((m) => Number(m.date.slice(0, 4)))),
        ].sort((a, b) => b - a),
        ...(!slug
          ? {
              memoryCount: memories.length,
              colleagues: store.colleagues.filter(
                (c) => c.employmentId === e.id,
              ),
            }
          : {}),
      };
    })
    .sort(
      (a, b) =>
        Number(b.current) - Number(a.current) ||
        b.start.localeCompare(a.start) ||
        a.id.localeCompare(b.id),
    );
  return { person, store, chapters };
}
function mutate(
  version: number,
  action: (store: Draft<JourneyStore>, db: Draft<DemoDatabase>) => void,
) {
  reloadDb();
  const db = getDb(),
    p = db.professionals[0];
  if ((p.professionalDetails?.revision ?? 1) !== version)
    throw new Error("Your profile changed. Reload before saving.");
  if (
    !commit(
      (draft) => {
        draft.careerJourneys ??= {};
        const store = (draft.careerJourneys[p.id] ??= empty());
        action(store, draft);
        draft.professionals[0].professionalDetails!.revision = version + 1;
      },
      { rollbackOnFailure: true },
    )
  )
    throw new Error(
      "Browser storage is full or unavailable. Your changes were not saved.",
    );
}
export const mockJourneyService: JourneyService = {
  async following(employmentId) {
    const chapter = context().chapters.find((c) => c.id === employmentId);
    if (!chapter) throw new Error("Workplace unavailable.");
    const db = getDb();
    return (await mockFeedService.getNetwork("professional")).following.filter(
      (p) => {
        const person = db.professionals.find(
          (candidate) => candidate.id === p.id,
        );
        return !!person && sameCompany(person, chapter.company);
      },
    );
  },
  async get(slug) {
    const { person, chapters } = context(slug);
    return {
      chapters,
      ...(!slug
        ? {
            profileVersion: person.professionalDetails?.revision ?? 1,
            profilePublic: person.public,
          }
        : {}),
    };
  },
  async memories(filters = {}, slug) {
    const { store, chapters } = context(slug),
      visible = new Set(chapters.map((c) => c.id));
    const rows = store.memories
      .filter(
        (m) =>
          visible.has(m.employmentId) &&
          (!slug || m.public) &&
          (!filters.employmentId || m.employmentId === filters.employmentId) &&
          (!filters.year || Number(m.date.slice(0, 4)) === filters.year),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
    const page = filters.page ?? 1,
      start = (page - 1) * JOURNEY_RULES.pageSize;
    return {
      items: rows.slice(start, start + JOURNEY_RULES.pageSize).map((m) =>
        slug
          ? {
              id: m.id,
              employmentId: m.employmentId,
              type: m.type,
              title: m.title,
              date: m.date,
              story: m.story,
              public: true,
              photos: m.photos,
            }
          : m,
      ),
      nextPage: rows.length > start + JOURNEY_RULES.pageSize ? page + 1 : null,
    };
  },
  async saveMemory(input, version, id) {
    mutate(version, (store) => {
      const { person, chapters } = context();
      const value = validateMemory(input, chapters, person.public);
      if (id && !store.memories.some((m) => m.id === id))
        throw new Error("Memory unavailable.");
      store.memories = store.memories.filter((m) => m.id !== id);
      store.memories.push({ ...value, id: id ?? crypto.randomUUID() });
    });
  },
  async deleteMemory(id, version) {
    mutate(version, (store) => {
      if (!store.memories.some((m) => m.id === id))
        throw new Error("Memory unavailable.");
      store.memories = store.memories.filter((m) => m.id !== id);
    });
  },
  async saveColleague(input, version, id) {
    mutate(version, (store) => {
      const value = colleagueSchema.parse(input),
        { chapters } = context();
      const chapter = chapters.find((c) => c.id === value.employmentId);
      if (!chapter) throw new Error("Workplace unavailable.");
      if (
        id &&
        !store.colleagues.some(
          (c) => c.id === id && c.employmentId === value.employmentId,
        )
      )
        throw new Error("Colleague unavailable.");
      const db = getDb();
      const person = db.professionals.find(
        (p) =>
          p.id === value.personId &&
          p.id !== db.professionals[0].id &&
          p.public &&
          sameCompany(p, chapter.company) &&
          db.social.following.includes(p.id) &&
          !blockedInMock(db, "professional", p.id),
      );
      if (!person)
        throw new Error(
          "Choose someone you currently follow on Skillora with the same company in their public work history.",
        );
      if (
        store.colleagues.some(
          (c) =>
            c.id !== id &&
            c.employmentId === value.employmentId &&
            (c.personId === person.id || c.profileSlug === person.slug),
        )
      )
        throw new Error("This person is already in this workplace chapter.");
      store.colleagues = store.colleagues.filter((c) => c.id !== id);
      store.colleagues.push({
        ...value,
        name: person.name,
        profileSlug: person.slug,
        profileHref: `/professionals/${person.slug}`,
        picture: person.picture,
        id: id ?? crypto.randomUUID(),
      });
    });
  },
  async deleteColleague(id, version) {
    mutate(version, (store) => {
      store.colleagues = store.colleagues.filter((c) => c.id !== id);
      for (const m of store.memories)
        m.colleagueIds = m.colleagueIds?.filter((c) => c !== id);
    });
  },
  async upload(file) {
    const error = validateMedia(file, "career_memory");
    if (error) throw new Error(error);
    const url = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("Photo could not be read."));
      r.readAsDataURL(file);
    });
    return {
      id: crypto.randomUUID(),
      url,
      alt: "",
      name: file.name,
      bytes: file.size,
    };
  },
  async discardPhoto() {},
};
