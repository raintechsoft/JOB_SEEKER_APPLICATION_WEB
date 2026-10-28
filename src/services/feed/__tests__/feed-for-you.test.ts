import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, resetDb } from "@/mocks/store/demo-db";
import { me } from "@/mocks/store/selectors";
import { mockFeedService } from "@/services/feed/feed.mock";
import { createHttpFeedService } from "@/services/feed/feed.http";
import type { HttpClient } from "@/services/api/client";
import type { AuthService } from "@/services/auth/auth.service";
import type { FeedQuery } from "@/services/feed/feed.service";

const query = (patch: Partial<FeedQuery> = {}): FeedQuery => ({ role: "professional", filter: "all", sort: "recommended", q: "", limit: 1000, ...patch });

describe("demo feed: For you and Not interested", () => {
  beforeEach(() => resetDb());

  it("ranks items about the viewer's skills first and says why", async () => {
    const skills = new Set(me(getDb()).skills.map((s) => s.toLowerCase()));
    const page = await mockFeedService.getFeed(query());
    expect(page.items.length).toBeGreaterThan(3);
    expect(page.items.every((e) => typeof e.recommendationReason === "string" && e.recommendationReason.length > 0)).toBe(true);
    const shares = page.items.map((e) => e.skills.filter((s) => skills.has(s.toLowerCase())).length);
    expect(shares[0]).toBeGreaterThan(0);
    expect(page.items[0].recommendationReason).toMatch(/^Matches your skills: /);
    const recent = await mockFeedService.getFeed(query({ sort: "recent" }));
    expect(recent.items.some((e) => e.recommendationReason)).toBe(false);
  });

  it("hides an item from the main feeds but not from searches, and undo brings it back", async () => {
    const first = (await mockFeedService.getFeed(query())).items[0];
    await expect(mockFeedService.setHidden("professional", first.id, first.type, true)).resolves.toBe(true);
    await mockFeedService.setHidden("professional", first.id, first.type, true);
    expect(getDb().social.hidden).toEqual([first.id]);
    expect((await mockFeedService.getFeed(query())).items.map((e) => e.id)).not.toContain(first.id);
    expect((await mockFeedService.getFeed(query({ sort: "recent" }))).items.map((e) => e.id)).not.toContain(first.id);
    expect((await mockFeedService.getFeed(query({ q: first.title.split(" ")[0] }))).items.map((e) => e.id)).toContain(first.id);
    await mockFeedService.setHidden("professional", first.id, first.type, false);
    expect((await mockFeedService.getFeed(query())).items.map((e) => e.id)).toContain(first.id);
  });
});

describe("http feed: Not interested", () => {
  it("posts to and deletes from the hidden items of the selected workspace", async () => {
    const identity = "11111111-1111-4111-8111-111111111111";
    const item = "00000000-0000-4000-8000-000000000009";
    const post = vi.fn(async () => ({ data: { itemKind: "post", itemId: item, hidden: true } }));
    const del = vi.fn(async () => undefined);
    const auth = { me: async () => ({ selected_identity_id: identity, workspaces: [{ id: identity, kind: "professional" }] }) } as unknown as AuthService;
    const { feed } = createHttpFeedService({ post, delete: del } as unknown as HttpClient, auth);
    await expect(feed.setHidden("professional", item, "post", true)).resolves.toBe(true);
    expect(post).toHaveBeenCalledWith(`me/hidden-items/${identity}`, { itemKind: "post", itemId: item });
    await expect(feed.setHidden("professional", item, "post", false)).resolves.toBe(false);
    expect(del).toHaveBeenCalledWith(`me/hidden-items/${identity}/post/${item}`);
    await expect(feed.setHidden("recruiter", item, "post", true)).rejects.toThrow();
    await expect(feed.setHidden("professional", "not-a-uuid", "post", true)).rejects.toThrow();
  });
});
