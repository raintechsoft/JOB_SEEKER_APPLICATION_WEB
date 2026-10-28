import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServicesContext } from "@/hooks/use-services";
import type { Services } from "@/services";
import type { PostDraft } from "@/types/domain";
import type { LinkPreview } from "@/lib/validation/link-preview";
import { useLinkPreview } from "@/features/posts/use-link-preview";
import { ComposerLinkPreview } from "@/features/posts/composer-link-preview";
import { LinkifiedText, LinkPreviewCard } from "@/components/feed/link-preview-card";
import { PostEditorScreen } from "@/features/posts/post-editor-screen";
import { postPublications } from "@/services/media/post-publication-manager";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation, useSearchParams: () => new URLSearchParams() }));
vi.mock("@/services/api/config", async (importOriginal) => ({ ...(await importOriginal<object>()), apiConfig: { dataSource: "http" } }));
vi.mock("@/features/feed/feed-card", () => ({ FeedCard: ({ entry }: { entry: { linkPreview?: LinkPreview } }) => <div data-testid="live-preview">{entry.linkPreview?.title ?? "no preview"}</div> }));

const preview = (url: string, title: string): LinkPreview => ({ url, canonicalUrl: null, title, description: `About ${title}`, imageUrl: `${url}card.png`, siteName: title, domain: new URL(url).hostname });

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  postPublications.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function Composer({ initial = "", seed }: { initial?: string; seed?: LinkPreview }) {
  const [text, setText] = useState(initial);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const link = useLinkPreview({ role: "professional", text, dismissed, onDismiss: (key) => setDismissed((d) => [...d, key]), initial: seed });
  return (
    <>
      <textarea aria-label="Story" value={text} onChange={(e) => setText(e.target.value)} onPaste={(e) => link.confirm(e.clipboardData.getData("text"))} onBlur={(e) => link.confirm(e.target.value)} />
      <ComposerLinkPreview state={link.state} onRemove={link.dismiss} />
      <span data-testid="status">{link.state.status}</span>
      <span data-testid="submit">{link.submitUrl}</span>
    </>
  );
}

function mount(getLinkPreview: ReturnType<typeof vi.fn>, props: Parameters<typeof Composer>[0] = {}) {
  const services = { feed: { getLinkPreview } } as unknown as Services;
  render(<ServicesContext.Provider value={services}><Composer {...props} /></ServicesContext.Provider>);
  return screen.getByLabelText("Story");
}
const type = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } });
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(500); });

it("waits for a complete link, debounces, and requests each URL once", async () => {
  const getLinkPreview = vi.fn().mockResolvedValue(preview("https://github.com/", "GitHub"));
  const field = mount(getLinkPreview);
  for (const partial of ["h", "https://gi", "https://github.co", "https://github.com"]) type(field, partial);
  await settle();
  expect(getLinkPreview).not.toHaveBeenCalled();
  expect(screen.getByTestId("status")).toHaveTextContent("idle");

  type(field, "https://github.com ");
  expect(await screen.findByRole("status")).toHaveTextContent("Loading link preview");
  expect(screen.getByTestId("submit")).toHaveTextContent("https://github.com");
  await settle();
  expect(await screen.findByText("GitHub")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /GitHub/ })).toHaveAttribute("href", "https://github.com/");
  type(field, "Look https://github.com/ and more text https://GITHUB.com");
  await settle();
  expect(getLinkPreview).toHaveBeenCalledOnce();
  expect(getLinkPreview.mock.calls[0][1]).toBe("https://github.com");
});

it("previews a pasted link immediately and on blur, with query strings and fragments", async () => {
  const getLinkPreview = vi.fn().mockResolvedValue(preview("https://example.com/", "Example"));
  const field = mount(getLinkPreview);
  fireEvent.paste(field, { clipboardData: { getData: () => "https://example.com/blog/article?id=123#details" } });
  type(field, "Check out this website: https://example.com/blog/article?id=123#details");
  await settle();
  expect(getLinkPreview).toHaveBeenCalledWith("professional", "https://example.com/blog/article?id=123#details", expect.any(AbortSignal));
  type(field, "Then https://www.example.com/products/item");
  fireEvent.blur(field);
  await settle();
  expect(getLinkPreview).toHaveBeenCalledTimes(2);
});

it("ignores a stale response after the link is replaced", async () => {
  let resolveFirst!: (value: LinkPreview) => void;
  const getLinkPreview = vi.fn()
    .mockImplementationOnce((_role, _url, signal: AbortSignal) => new Promise<LinkPreview>((resolve, reject) => { resolveFirst = resolve; signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))); }))
    .mockResolvedValueOnce(preview("https://second.com/", "Second"));
  const field = mount(getLinkPreview);
  type(field, "https://first.com ");
  await settle();
  expect(getLinkPreview).toHaveBeenCalledOnce();
  const firstSignal = getLinkPreview.mock.calls[0][2] as AbortSignal;
  type(field, "https://second.com ");
  expect(firstSignal.aborted).toBe(true);
  await settle();
  await act(async () => resolveFirst(preview("https://first.com/", "First")));
  expect(await screen.findByText("Second")).toBeInTheDocument();
  expect(screen.queryByText("First")).not.toBeInTheDocument();
});

it("removes only the preview, keeps the URL, and keeps that URL dismissed while editing", async () => {
  const getLinkPreview = vi.fn().mockImplementation(async (_r, url: string) => preview(new URL(url).origin + "/", new URL(url).hostname));
  const field = mount(getLinkPreview);
  type(field, "Repo https://github.com and text");
  await settle();
  fireEvent.click(await screen.findByRole("button", { name: "Remove link preview for github.com" }));
  expect(field).toHaveValue("Repo https://github.com and text");
  expect(screen.queryByText("github.com")).not.toBeInTheDocument();
  expect(screen.getByTestId("status")).toHaveTextContent("dismissed");
  expect(screen.getByTestId("submit")).toBeEmptyDOMElement();

  type(field, "Repo ");
  type(field, "Repo https://github.com/ again");
  await settle();
  expect(screen.getByTestId("status")).toHaveTextContent("dismissed");
  expect(getLinkPreview).toHaveBeenCalledOnce();

  type(field, "Docs https://nextjs.org now");
  await settle();
  expect(await screen.findByText("nextjs.org", { selector: "strong" })).toBeInTheDocument();
  expect(getLinkPreview).toHaveBeenCalledTimes(2);
});

it("fails quietly so the link stays plain text", async () => {
  const getLinkPreview = vi.fn().mockRejectedValueOnce(new Error("429")).mockResolvedValueOnce(null);
  const field = mount(getLinkPreview);
  type(field, "https://down.com ");
  await settle();
  await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unavailable"));
  type(field, "https://down.com https://empty.com ");
  await settle();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByTestId("submit")).toBeEmptyDOMElement();
});

it("initializes from the stored preview when editing a published post", async () => {
  const getLinkPreview = vi.fn();
  mount(getLinkPreview, { initial: "Repo https://github.com/", seed: preview("https://github.com/", "Stored GitHub") });
  expect(screen.getByText("Stored GitHub")).toBeInTheDocument();
  await settle();
  expect(getLinkPreview).not.toHaveBeenCalled();
});

it("renders partial metadata, falls back on a broken thumbnail and refuses unsafe links", () => {
  const { rerender } = render(<LinkPreviewCard preview={{ url: "https://example.com/", canonicalUrl: null, title: null, description: null, imageUrl: "https://example.com/missing.png", siteName: null, domain: "example.com" }} />);
  const link = screen.getByRole("link");
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow ugc");
  expect(screen.getByText("example.com", { selector: "strong" })).toBeInTheDocument();
  fireEvent.error(document.querySelector("img")!);
  expect(document.querySelector("img")).toBeNull();
  expect(document.querySelector(".link-preview-placeholder")).not.toBeNull();

  rerender(<LinkPreviewCard preview={{ url: "https://example.com/", canonicalUrl: null, title: "<script>alert(1)</script>", description: null, imageUrl: "javascript:alert(1)", siteName: null, domain: "example.com" }} />);
  expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
  expect(document.querySelector("script, img")).toBeNull();
  rerender(<LinkPreviewCard preview={{ url: "javascript:alert(1)", canonicalUrl: null, title: "Bad", description: null, imageUrl: null, siteName: null, domain: "x" }} />);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

it("linkifies safe URLs in post text and leaves unsafe ones as text", () => {
  render(<p><LinkifiedText text="Read https://example.com/a?b=1. Not javascript:alert(1)" /></p>);
  expect(screen.getByRole("link", { name: "https://example.com/a?b=1" })).toHaveAttribute("href", "https://example.com/a?b=1");
  expect(screen.getAllByRole("link")).toHaveLength(1);
});

function editor(getLinkPreview: ReturnType<typeof vi.fn>) {
  const id = "00000000-0000-4000-8000-000000000001";
  const draft: PostDraft = { id, title: "Links", body: "", project: "", media: [], videoUrl: "", step: 0, reached: 0, version: 1, editorToken: "editor" };
  const createPost = vi.fn().mockResolvedValue({ id: "published" });
  const storePostDraft = vi.fn().mockResolvedValue(true);
  const person = { id, name: "Post author", headline: "Designer", picture: "" };
  const services = { jobPosts: { getPostDraft: vi.fn().mockResolvedValue(draft), storePostDraft }, workspace: { getProfessionalShell: vi.fn().mockResolvedValue({ person }) }, work: { listProjects: vi.fn().mockResolvedValue([]) }, media: { upload: vi.fn() }, feed: { createPost, getLinkPreview } } as unknown as Services;
  render(<ServicesContext.Provider value={services}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PostEditorScreen role="professional" /></QueryClientProvider></ServicesContext.Provider>);
  return { createPost, storePostDraft };
}
async function publishFromStory() {
  for (let i = 0; i < 2; i++) fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(await screen.findByRole("button", { name: "Publish post" }));
}

it("publishes the previewed link and shows it in the live preview", async () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const { createPost } = editor(vi.fn().mockResolvedValue(preview("https://github.com/", "GitHub")));
  fireEvent.change(await screen.findByRole("textbox", { name: "Your story" }), { target: { value: "My repo: https://github.com today" } });
  await settle();
  expect(await screen.findByTestId("live-preview")).toHaveTextContent("GitHub");
  await publishFromStory();
  await waitFor(() => expect(createPost).toHaveBeenCalledOnce());
  expect(createPost.mock.calls[0][1]).toMatchObject({ body: "My repo: https://github.com today", previewUrl: "https://github.com" });
});

it("publishes text-only after dismissal or a failed preview and persists the dismissal", async () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const { createPost, storePostDraft } = editor(vi.fn().mockResolvedValue(preview("https://github.com/", "GitHub")));
  const story = await screen.findByRole("textbox", { name: "Your story" });
  fireEvent.change(story, { target: { value: "My repo: https://github.com today" } });
  await settle();
  fireEvent.click(await screen.findByRole("button", { name: "Remove link preview for github.com" }));
  expect(story).toHaveFocus();
  expect(story).toHaveValue("My repo: https://github.com today");
  await settle();
  await act(async () => { await vi.advanceTimersByTimeAsync(800); });
  await waitFor(() => expect(storePostDraft.mock.calls.at(-1)?.[1]).toMatchObject({ previewDismissedUrls: ["https://github.com/"] }));
  await publishFromStory();
  await waitFor(() => expect(createPost).toHaveBeenCalledOnce());
  expect(createPost.mock.calls[0][1].previewUrl).toBeUndefined();
  expect(createPost.mock.calls[0][1].body).toBe("My repo: https://github.com today");
});

it("never blocks publication on a failing preview service", async () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const { createPost } = editor(vi.fn().mockRejectedValue(new Error("Service unavailable")));
  fireEvent.change(await screen.findByRole("textbox", { name: "Your story" }), { target: { value: "See https://down.example.com/ now" } });
  await settle();
  await publishFromStory();
  await waitFor(() => expect(createPost).toHaveBeenCalledOnce());
  expect(createPost.mock.calls[0][1].previewUrl).toBeUndefined();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
