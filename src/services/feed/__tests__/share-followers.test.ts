import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, resetDb } from "@/mocks/store/demo-db";
import { mockFeedService } from "@/services/feed/feed.mock";
import { createHttpFeedService } from "@/services/feed/feed.http";
import { ApiError, type HttpClient } from "@/services/api/client";
import type { AuthService } from "@/services/auth/auth.service";

describe("share a post with followers", () => {
  beforeEach(() => resetDb());

  it("demo: delivers the post link as a direct message to each selected follower and reuses the thread", async () => {
    const post = getDb().social.posts[0];
    const before = getDb().conversations.length;
    await expect(mockFeedService.shareWithFollowers("professional", post.id, ["p1", "p2"])).resolves.toEqual({ shared: ["p1", "p2"], failed: [] });
    const db = getDb();
    expect(db.conversations.length).toBe(before + 2);
    const thread = db.conversations.find((c) => c.peerIds?.includes("p1") && c.peerIds?.includes("p0"));
    expect(thread?.messages.at(-1)?.sharedEntryId).toBe(post.id);
    expect(thread?.messages.at(-1)?.text).not.toContain("http");
    expect(thread?.messages.at(-1)?.text).toContain(post.title.trim());
    expect(thread?.messages.at(-1)?.senderId).toBe("p0");
    await mockFeedService.shareWithFollowers("professional", post.id, ["p1"]);
    expect(getDb().conversations.length).toBe(before + 2);
    expect(getDb().conversations.find((c) => c.id === thread?.id)?.messages.length).toBe(2);
  });

  it("demo: refuses people who do not follow the sender and sends nothing", async () => {
    const post = getDb().social.posts[0];
    const before = JSON.stringify(getDb().conversations);
    await expect(mockFeedService.shareWithFollowers("professional", post.id, ["p3"])).rejects.toThrow("Choose followers from your current list.");
    await expect(mockFeedService.shareWithFollowers("professional", post.id, [])).rejects.toThrow();
    expect(JSON.stringify(getDb().conversations)).toBe(before);
  });

  it("http: posts the selection with a retry key that survives a failed attempt", async () => {
    const identity = crypto.randomUUID(), item = crypto.randomUUID(), follower = crypto.randomUUID();
    const post = vi.fn().mockRejectedValueOnce(new ApiError("offline", 0)).mockResolvedValue({ data: { shared: [follower], failed: [] } });
    const auth = { me: async () => ({ selected_identity_id: identity, workspaces: [{ id: identity, kind: "professional" }] }) } as unknown as AuthService;
    const { feed } = createHttpFeedService({ post } as unknown as HttpClient, auth);
    await expect(feed.shareWithFollowers("professional", item, [follower])).rejects.toBeInstanceOf(ApiError);
    await expect(feed.shareWithFollowers("professional", item, [follower])).resolves.toEqual({ shared: [follower], failed: [] });
    expect(post).toHaveBeenCalledTimes(2);
    const [path, first] = post.mock.calls[0] as [string, { recipientIds: string[]; shareKey: string }];
    const [, second] = post.mock.calls[1] as [string, { recipientIds: string[]; shareKey: string }];
    expect(path).toBe(`me/social/${identity}/entries/${item}/shares`);
    expect(first.recipientIds).toEqual([follower]);
    expect(first.shareKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.shareKey).toBe(first.shareKey);
    // A new selection after success gets a fresh key.
    await feed.shareWithFollowers("professional", item, [follower]);
    expect((post.mock.calls[2][1] as { shareKey: string }).shareKey).not.toBe(first.shareKey);
    await expect(feed.shareWithFollowers("professional", item, [])).rejects.toThrow();
    await expect(feed.shareWithFollowers("professional", "not-a-uuid", [follower])).rejects.toThrow();
    expect(post).toHaveBeenCalledTimes(3);
  });
});
