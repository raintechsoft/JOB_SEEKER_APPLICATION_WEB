import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, resetDb } from "@/mocks/store/demo-db";
import { me } from "@/mocks/store/selectors";
import { mockSearchService } from "@/services/search/search.mock";
import { createHttpSearchService } from "@/services/search/search.http";
import type { HttpClient } from "@/services/api/client";
import type { AuthService } from "@/services/auth/auth.service";

const IDENTITY = "11111111-1111-4111-8111-111111111111";
const auth = { me: async () => ({ selected_identity_id: IDENTITY, workspaces: [{ id: IDENTITY, kind: "professional" }] }) } as unknown as AuthService;

describe("search suggestions", () => {
  beforeEach(() => resetDb());

  it("reads the selected workspace's suggestions and refuses another workspace kind", async () => {
    const data = { recent: [], skills: [{ name: "React", reason: "Trending" }], companies: [], people: [] };
    const get = vi.fn(async () => ({ data }));
    const search = createHttpSearchService({ get } as unknown as HttpClient, auth);
    await expect(search.suggestions("professional")).resolves.toEqual(data);
    expect(get).toHaveBeenCalledWith(`me/social/${IDENTITY}/search-suggestions`, undefined, undefined);
    await expect(search.suggestions("recruiter")).rejects.toThrow();
  });

  it("demo mode lists your own skills first, then companies hiring for them and people sharing them", async () => {
    const own = new Set(me(getDb()).skills.map((s) => s.toLowerCase()));
    const s = await mockSearchService.suggestions("professional");
    expect(s.skills.length).toBeGreaterThan(0);
    const firstTrending = s.skills.findIndex((k) => k.reason === "Trending");
    expect(s.skills.slice(0, firstTrending < 0 ? undefined : firstTrending).every((k) => own.has(k.name.toLowerCase()) && k.reason === "In your skills")).toBe(true);
    expect(s.companies.every((c) => c.reason.startsWith("Hiring for "))).toBe(true);
    expect(s.people.length).toBeLessThanOrEqual(4);
    expect(s.people.every((p) => p.reason.length > 0)).toBe(true);
  });
});
