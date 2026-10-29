import { beforeEach, describe, expect, it, vi } from "vitest";
import { forgetRecentSearch, readRecentSearches, rememberSearch } from "@/features/search/recent-searches";
import { createHttpSearchService } from "@/services/search/search.http";
import type { HttpClient } from "@/services/api/client";
import type { AuthService } from "@/services/auth/auth.service";

const SCOPE = "11111111-1111-4111-8111-111111111111";
const ENTRY = "22222222-2222-4222-8222-222222222222";

describe("recent searches can be removed (F4b)", () => {
  beforeEach(() => sessionStorage.clear());

  it("removes one search regardless of case, or all of them, in this tab", () => {
    let list = rememberSearch(SCOPE, "React", []);
    list = rememberSearch(SCOPE, "Figma", list);
    expect(list).toEqual(["Figma", "React"]);
    expect(forgetRecentSearch(SCOPE, "react")).toEqual(["Figma"]);
    expect(readRecentSearches(SCOPE)).toEqual(["Figma"]);
    expect(forgetRecentSearch(SCOPE)).toEqual([]);
    expect(readRecentSearches(SCOPE)).toEqual([]);
  });

  it("deletes server history entries of the selected workspace", async () => {
    const del = vi.fn(async () => undefined);
    const auth = { me: async () => ({ selected_identity_id: SCOPE, workspaces: [{ id: SCOPE, kind: "professional" }] }) } as unknown as AuthService;
    const search = createHttpSearchService({ delete: del } as unknown as HttpClient, auth);
    await search.forgetSearch("professional", ENTRY);
    expect(del).toHaveBeenCalledWith(`me/search-history/${SCOPE}/${ENTRY}`);
    await search.clearSearches("professional");
    expect(del).toHaveBeenLastCalledWith(`me/search-history/${SCOPE}`);
    await expect(search.forgetSearch("professional", "not-a-uuid")).rejects.toThrow();
    await expect(search.clearSearches("recruiter")).rejects.toThrow();
  });

  it("reports the result opened from a search, skipping ids the server cannot keep and never failing", async () => {
    const post = vi.fn(async () => undefined);
    const auth = { me: async () => ({ selected_identity_id: SCOPE, workspaces: [{ id: SCOPE, kind: "professional" }] }) } as unknown as AuthService;
    const search = createHttpSearchService({ post } as unknown as HttpClient, auth);
    await search.resultOpened("professional", "  Laravel ", { kind: "job", id: ENTRY });
    expect(post).toHaveBeenCalledWith(`me/search-history/${SCOPE}/opened`, { query: "Laravel", kind: "job", id: ENTRY });
    await search.resultOpened("professional", "Laravel", { kind: "person", id: "demo-person" });
    await search.resultOpened("professional", "  ", { kind: "job", id: ENTRY });
    expect(post).toHaveBeenCalledTimes(1);
    post.mockRejectedValueOnce(new Error("offline"));
    await expect(search.resultOpened("professional", "Laravel", { kind: "job", id: ENTRY })).resolves.toBeUndefined();
  });
});
