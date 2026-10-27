import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  JOURNEY_RULES,
  colleagueSchema,
  memorySchema,
  validateMemory,
} from "@/lib/validation/journey";
import type {
  JourneyChapter,
  MemoryInput,
} from "@/services/journey/journey.service";
import { mockJourneyService } from "@/services/journey/journey.mock";
import { mockProfileService } from "@/services/profile/profile.mock";
import { demoDbStore, getDb, commit } from "@/mocks/store/demo-db";

const chapter: JourneyChapter = {
  id: "work-1",
  company: "Example",
  title: "Designer",
  start: "2022-01",
  end: "2024-12",
  current: false,
  public: true,
  years: [],
  colleagues: [],
};
const memory = (): MemoryInput => ({
  employmentId: chapter.id,
  title: "Launch day",
  type: "Moment",
  story: "We shipped together.",
  date: "2023-04-20",
  public: false,
  photos: [],
  colleagueIds: [],
});
class MemoryStorage {
  values = new Map<string, string>();
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
  removeItem(k: string) {
    this.values.delete(k);
  }
  clear() {
    this.values.clear();
  }
}
beforeEach(() => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", new MemoryStorage());
  demoDbStore.setState({ db: null });
  getDb();
  commit((db) => {
    db.professionals[1].experience = "Frontend Engineer at Example";
    db.professionals[3].experience = "Designer at Example";
    const p = db.professionals[0];
    p.public = true;
    p.professionalDetails!.revision = 1;
    p.professionalDetails!.employment = [
      {
        id: chapter.id,
        title: chapter.title,
        company: chapter.company,
        start: chapter.start,
        end: chapter.end,
        current: false,
        public: true,
      },
    ];
  });
});
describe("career memory validation", () => {
  it("matches the backend contract exactly", () => {
    expect(JOURNEY_RULES).toEqual(
      JSON.parse(
        readFileSync(
          resolve(
            process.cwd(),
            "../JOB_SEEKER_APPLICATION_BACKEND/resources/contracts/career-journey.json",
          ),
          "utf8",
        ),
      ),
    );
  });
  it("accepts text-only private memories", () =>
    expect(validateMemory(memory(), [chapter], true).public).toBe(false));
  it.each(["2023-02-30", "2099-01-01", "1799-12-31"])(
    "rejects invalid or future date %s",
    (date) =>
      expect(memorySchema.safeParse({ ...memory(), date }).success).toBe(false),
  );
  it("rejects dates outside employment", () =>
    expect(() =>
      validateMemory({ ...memory(), date: "2021-12-31" }, [chapter], true),
    ).toThrow("employment period"));
  it("requires employment dates", () =>
    expect(() =>
      validateMemory(memory(), [{ ...chapter, start: "" }], true),
    ).toThrow("employment dates"));
  it.each([false, true])(
    "requires public profile and employment (profilePublic=%s)",
    (profilePublic) =>
      expect(() =>
        validateMemory(
          { ...memory(), public: true },
          [{ ...chapter, public: false }],
          profilePublic,
        ),
      ).toThrow("public"),
  );
  it("requires descriptions for public photos", () =>
    expect(
      memorySchema.safeParse({
        ...memory(),
        public: true,
        photos: [{ id: "a", url: "/photo", name: "a.png", bytes: 10, alt: "" }],
      }).success,
    ).toBe(false));
  it("rejects long titles, large photos, and more than four photos", () => {
    expect(
      memorySchema.safeParse({ ...memory(), title: "x".repeat(121) }).success,
    ).toBe(false);
    expect(
      memorySchema.safeParse({
        ...memory(),
        photos: [
          { id: "a", url: "/a", name: "a.png", bytes: 1048577, alt: "a" },
        ],
      }).success,
    ).toBe(false);
    expect(
      memorySchema.safeParse({
        ...memory(),
        photos: Array.from({ length: 5 }, (_, i) => ({
          id: String(i),
          url: "/a",
          name: "a.png",
          bytes: 10,
          alt: "a",
        })),
      }).success,
    ).toBe(false);
  });
  it("rejects colleagues from another workplace", () =>
    expect(() =>
      validateMemory(
        { ...memory(), colleagueIds: ["someone"] },
        [chapter],
        true,
      ),
    ).toThrow("this workplace"));
  it("requires a following selection instead of manual name or URL", () => {
    expect(
      colleagueSchema.safeParse({
        employmentId: "x",
        personId: "",
        name: " ",
        role: "",
        profileSlug: "",
      }).success,
    ).toBe(false);
    expect(
      colleagueSchema.safeParse({
        employmentId: "x",
        name: "Pat",
        role: "",
        profileSlug: "https://other.test",
      }).success,
    ).toBe(false);
  });
});
describe("persisted demo journey", () => {
  it("excludes followed people from a different company", async () => {
    const ids = (await mockJourneyService.following(chapter.id)).map(
      (p) => p.id,
    );
    expect(ids).toContain("p1");
    expect(ids).not.toContain("p6");
    await expect(
      mockJourneyService.saveColleague(
        { employmentId: chapter.id, personId: "p6", role: "" },
        1,
      ),
    ).rejects.toThrow("same company");
  });
  it("matches company case and whitespace without fuzzy name guessing", async () => {
    commit((db) => {
      db.professionals[1].experience = "Engineer at   eXaMpLe   ";
    });
    expect(
      (await mockJourneyService.following(chapter.id)).some(
        (p) => p.id === "p1",
      ),
    ).toBe(true);
    commit((db) => {
      db.professionals[1].experience = "Engineer at Example Labs";
    });
    expect(
      (await mockJourneyService.following(chapter.id)).some(
        (p) => p.id === "p1",
      ),
    ).toBe(false);
  });
  it("does not use private work history to expose a company connection", async () => {
    commit((db) => {
      db.professionals[1].professionalDetails = {
        ...db.professionals[0].professionalDetails!,
        employment: [
          {
            id: "private-job",
            company: "Example",
            title: "Engineer",
            public: false,
          },
        ],
      };
    });
    expect(
      (await mockJourneyService.following(chapter.id)).some(
        (p) => p.id === "p1",
      ),
    ).toBe(false);
    await expect(
      mockJourneyService.saveColleague(
        { employmentId: chapter.id, personId: "p1", role: "" },
        1,
      ),
    ).rejects.toThrow("same company");
  });
  it("fetches Following only, not people who only follow the job seeker", async () => {
    const people = await mockJourneyService.following(chapter.id);
    expect(people.map((p) => p.id)).toContain("p1");
    expect(people.map((p) => p.id)).not.toContain("p2");
    await expect(
      mockJourneyService.saveColleague(
        { employmentId: chapter.id, personId: "p2", role: "" },
        1,
      ),
    ).rejects.toThrow("currently follow");
  });
  it("fills colleague details from the followed profile and prevents duplicates", async () => {
    await mockJourneyService.saveColleague(
      { employmentId: chapter.id, personId: "p1", role: "Teammate" },
      1,
    );
    const colleague = (await mockJourneyService.get()).chapters[0]
      .colleagues![0];
    expect(colleague.name).toBe("Priya Sharma");
    expect(colleague.profileSlug).toBe(getDb().professionals[1].slug);
    await expect(
      mockJourneyService.saveColleague(
        { employmentId: chapter.id, personId: "p1", role: "" },
        2,
      ),
    ).rejects.toThrow("already in this workplace");
  });
  it("rejects an unfollow made while the picker was open", async () => {
    await mockJourneyService.following(chapter.id);
    commit((db) => {
      db.social.following = db.social.following.filter((id) => id !== "p1");
    });
    await expect(
      mockJourneyService.saveColleague(
        { employmentId: chapter.id, personId: "p1", role: "" },
        1,
      ),
    ).rejects.toThrow("currently follow");
  });
  it("excludes blocked and private profiles from following choices", async () => {
    commit((db) => {
      db.social.blocked = ["p1"];
      db.professionals[3].public = false;
    });
    const ids = (await mockJourneyService.following(chapter.id)).map(
      (p) => p.id,
    );
    expect(ids).not.toContain("p1");
    expect(ids).not.toContain("p3");
  });
  it("saves a private memory and restores it after reload", async () => {
    await mockJourneyService.saveMemory(memory(), 1);
    demoDbStore.setState({ db: null });
    expect((await mockJourneyService.memories()).items[0].title).toBe(
      "Launch day",
    );
    expect((await mockJourneyService.get()).profileVersion).toBe(2);
  });
  it("does not invent memories or colleagues", async () => {
    const view = await mockJourneyService.get();
    expect(view.chapters[0].memoryCount).toBe(0);
    expect(view.chapters[0].colleagues).toEqual([]);
  });
  it("rejects stale edits", async () => {
    await mockJourneyService.saveMemory(memory(), 1);
    await expect(mockJourneyService.saveMemory(memory(), 1)).rejects.toThrow(
      "changed",
    );
  });
  it("never includes private counts or colleagues in public data", async () => {
    await mockJourneyService.saveColleague(
      {
        employmentId: chapter.id,
        personId: "p1",
        role: "Mentor",
      },
      1,
    );
    const colleague = (await mockJourneyService.get()).chapters[0]
      .colleagues![0];
    await mockJourneyService.saveMemory(
      { ...memory(), public: true, colleagueIds: [colleague.id] },
      2,
    );
    const slug = getDb().professionals[0].slug;
    const view = await mockJourneyService.get(slug);
    expect(view).not.toHaveProperty("profileVersion");
    expect(view.chapters[0]).not.toHaveProperty("colleagues");
    expect(view.chapters[0]).not.toHaveProperty("memoryCount");
    expect(
      (await mockJourneyService.memories({}, slug)).items[0],
    ).not.toHaveProperty("colleagueIds");
  });
  it("hides private memories and honors unpublishing", async () => {
    const slug = getDb().professionals[0].slug;
    await mockJourneyService.saveMemory(memory(), 1);
    expect((await mockJourneyService.memories({}, slug)).items).toHaveLength(0);
    const m = (await mockJourneyService.memories()).items[0];
    await mockJourneyService.saveMemory({ ...m, public: true }, 2, m.id);
    expect((await mockJourneyService.memories({}, slug)).items).toHaveLength(1);
    await mockJourneyService.saveMemory({ ...m, public: false }, 3, m.id);
    expect((await mockJourneyService.memories({}, slug)).items).toHaveLength(0);
  });
  it("hides memories when employment or profile becomes private", async () => {
    await mockJourneyService.saveMemory({ ...memory(), public: true }, 1);
    const slug = getDb().professionals[0].slug;
    commit((db) => {
      db.professionals[0].professionalDetails!.employment[0].public = false;
    });
    expect((await mockJourneyService.memories({}, slug)).items).toHaveLength(0);
    commit((db) => {
      db.professionals[0].public = false;
    });
    await expect(mockJourneyService.get(slug)).rejects.toThrow("unavailable");
  });
  it("filters years and paginates 20 at a time with stable ordering", async () => {
    for (let i = 0; i < 22; i++)
      await mockJourneyService.saveMemory(
        {
          ...memory(),
          date: i === 21 ? "2024-01-01" : "2023-04-20",
          title: `Memory ${i}`,
        },
        i + 1,
      );
    const first = await mockJourneyService.memories();
    expect(first.items).toHaveLength(20);
    expect(first.nextPage).toBe(2);
    expect(first.items[0].date).toBe("2024-01-01");
    expect((await mockJourneyService.memories({ page: 2 })).items).toHaveLength(
      2,
    );
    expect(
      (await mockJourneyService.memories({ year: 2024 })).items,
    ).toHaveLength(1);
  });
  it("guards employment dates and requires explicit cascade confirmation", async () => {
    await mockJourneyService.saveMemory(memory(), 1);
    const edited = await mockProfileService.saveRecord("employment", {
      ...getDb().professionals[0].professionalDetails!.employment[0],
      start: "2024-01",
    });
    expect(edited.ok).toBe(false);
    await expect(
      mockProfileService.deleteRecord("employment", chapter.id, 2),
    ).rejects.toThrow("Confirm deletion");
    await mockProfileService.deleteRecord("employment", chapter.id, 2, true);
    expect((await mockJourneyService.memories()).items).toHaveLength(0);
  });
  it("rolls back when browser storage is full", async () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    await expect(mockJourneyService.saveMemory(memory(), 1)).rejects.toThrow(
      "storage",
    );
    expect((await mockJourneyService.memories()).items).toHaveLength(0);
  });
});
