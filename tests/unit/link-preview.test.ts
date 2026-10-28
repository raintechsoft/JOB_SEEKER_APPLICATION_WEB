import { expect, it, vi } from "vitest";
import { findLinks, isCompleteLink, linkPreviewSchema, linkSafeCut, linkSegments, normalizeLinkUrl, previewUrlInBody, trimTrailing } from "@/lib/validation/link-preview";
import { postPublishSchema } from "@/lib/validation/social";
import { createHttpFeedService } from "@/services/feed/feed.http";
import type { HttpClient } from "@/services/api/client";
import type { AuthService } from "@/services/auth/auth.service";

it("normalizes public http(s) URLs the same way Laravel does", () => {
  expect(normalizeLinkUrl("https://GitHub.com")).toBe("https://github.com/");
  expect(normalizeLinkUrl("https://example.com/blog/article?id=123#details")).toBe("https://example.com/blog/article?id=123");
  expect(normalizeLinkUrl("https://www.example.com/products/item#details")).toBe("https://www.example.com/products/item");
  expect(normalizeLinkUrl("https://bücher.de/")).toBe("https://xn--bcher-kva.de/");
  for (const unsafe of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "ftp://example.com", "https://user:pw@example.com", "https://example.com@evil.com", "http://localhost:3000", "http://127.0.0.1", "http://10.0.0.1", "http://169.254.169.254/latest", "http://192.168.0.1", "http://[::1]/", "http://[fe80::1]/", "http://intranet/", "http://app.internal", "https://github", "http://0x7f.1", "https://exa mple.com"])
    expect(normalizeLinkUrl(unsafe), unsafe).toBeNull();
});

it("finds links in prose without trailing punctuation and de-duplicates destinations", () => {
  const text = "Check out this website: https://example.com. Also (https://en.wikipedia.org/wiki/Foo_(bar)), https://EXAMPLE.com/ and javascript:alert(1).";
  expect(findLinks(text).map((l) => [l.raw, l.key])).toEqual([
    ["https://example.com", "https://example.com/"],
    ["https://en.wikipedia.org/wiki/Foo_(bar)", "https://en.wikipedia.org/wiki/Foo_(bar)"],
  ]);
  expect(trimTrailing("https://example.com/a?b=1!)")).toBe("https://example.com/a?b=1");
  expect(findLinks("Two: https://a-site.com/x?y=1&z=2 https://b-site.com/#top").map((l) => l.key)).toEqual(["https://a-site.com/x?y=1&z=2", "https://b-site.com/"]);
});

it("treats a link as complete only once a delimiter follows it", () => {
  const typing = "See https://github.co";
  expect(isCompleteLink(typing, findLinks(typing)[0])).toBe(false);
  expect(isCompleteLink(typing + " ", findLinks(typing + " ")[0])).toBe(true);
  expect(isCompleteLink("https://github.com.", findLinks("https://github.com.")[0])).toBe(true);
  expect(findLinks("https://git")).toEqual([]);
});

it("linkifies only safe URLs and never splits one when truncating", () => {
  expect(linkSegments("Go to https://example.com/a. Or javascript:alert(1) or http://localhost/x")).toEqual([
    { text: "Go to " },
    { text: "https://example.com/a", href: "https://example.com/a" },
    { text: ". Or javascript:alert(1) or http://localhost/x" },
  ]);
  const body = "x".repeat(410) + " https://example.com/a/long/path";
  expect(linkSafeCut(body, 420)).toBe(body.length);
  expect(linkSafeCut("y".repeat(500), 420)).toBe(420);
});

it("validates preview responses strictly and degrades unsafe fields", () => {
  const base = { url: "https://github.com/", canonicalUrl: "https://github.com/home", title: "GitHub", description: null, imageUrl: "https://github.com/i.png", siteName: "GitHub", domain: "github.com" };
  expect(linkPreviewSchema.parse(base)).toEqual(base);
  expect(linkPreviewSchema.parse({ ...base, imageUrl: "javascript:alert(1)", canonicalUrl: "http://10.0.0.1/" })).toMatchObject({ imageUrl: null, canonicalUrl: null });
  expect(linkPreviewSchema.safeParse({ ...base, url: "javascript:alert(1)" }).success).toBe(false);
  expect(linkPreviewSchema.parse({ ...base, title: "t".repeat(301) }).title).toBeNull();
});

it("requires a submitted preview link to appear in the post body", () => {
  expect(previewUrlInBody("", "anything")).toBe(true);
  expect(previewUrlInBody("https://github.com", "Repo: https://github.com/.")).toBe(true);
  expect(previewUrlInBody("https://github.com", "No link")).toBe(false);
  const post = { title: "T", body: "Repo https://github.com", project: "", attachments: [] };
  expect(postPublishSchema.safeParse({ ...post, previewUrl: "https://github.com" }).success).toBe(true);
  expect(postPublishSchema.safeParse({ ...post, previewUrl: "https://other.com" }).success).toBe(false);
});

it("requests previews through Laravel only for safe links and validates the response", async () => {
  const identity = crypto.randomUUID();
  const auth = { me: vi.fn().mockResolvedValue({ selected_identity_id: identity, workspaces: [{ id: identity, kind: "professional" }] }) } as unknown as AuthService;
  const post = vi.fn().mockResolvedValueOnce({ data: { url: "https://github.com/", canonicalUrl: null, title: "GitHub", description: null, imageUrl: "data:image/png;base64,AA", siteName: null, domain: "github.com" } }).mockResolvedValueOnce({ data: null }).mockResolvedValueOnce({ data: { url: "javascript:alert(1)", domain: "x" } });
  const feed = createHttpFeedService({ post } as unknown as HttpClient, auth).feed;
  await expect(feed.getLinkPreview("professional", "http://127.0.0.1/")).rejects.toThrow();
  await expect(feed.getLinkPreview("professional", "javascript:alert(1)")).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
  const signal = new AbortController().signal;
  expect(await feed.getLinkPreview("professional", "https://github.com", signal)).toMatchObject({ title: "GitHub", imageUrl: null });
  expect(post).toHaveBeenCalledWith(`me/social/${identity}/link-previews`, { url: "https://github.com" }, { signal });
  expect(await feed.getLinkPreview("professional", "https://github.com")).toBeNull();
  expect(await feed.getLinkPreview("professional", "https://github.com")).toBeNull();
});

it("sends previewUrl on post edits only when it appears in the body", async () => {
  const identity = crypto.randomUUID(), id = crypto.randomUUID();
  const auth = { me: vi.fn().mockResolvedValue({ selected_identity_id: identity, workspaces: [{ id: identity, kind: "professional" }] }) } as unknown as AuthService;
  const patch = vi.fn().mockResolvedValue(undefined);
  const feed = createHttpFeedService({ patch } as unknown as HttpClient, auth).feed;
  await expect(feed.updatePost("professional", id, { title: "T", body: "No link", version: 1, previewUrl: "https://github.com" })).rejects.toThrow();
  expect(patch).not.toHaveBeenCalled();
  await feed.updatePost("professional", id, { title: "T", body: "https://github.com", version: 1, previewUrl: "" });
  await feed.updatePost("professional", id, { title: "T", body: "https://github.com", version: 2 });
  expect(patch.mock.calls.map((c) => c[1])).toEqual([{ title: "T", body: "https://github.com", version: 1, previewUrl: "" }, { title: "T", body: "https://github.com", version: 2 }]);
});
