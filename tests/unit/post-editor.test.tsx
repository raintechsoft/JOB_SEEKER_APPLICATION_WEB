import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServicesContext } from "@/hooks/use-services";
import type { Services } from "@/services";
import type { PostDraft, Role } from "@/types/domain";
import { PostEditorScreen } from "@/features/posts/post-editor-screen";
import { uploadManager } from "@/services/media/upload-manager";
import { UploadTray } from "@/features/workspace/upload-tray";

const navigation = vi.hoisted(() => ({ push: vi.fn(), params: "" }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation, useSearchParams: () => new URLSearchParams(navigation.params) }));
vi.mock("@/services/api/config", async importOriginal => ({ ...await importOriginal<object>(), apiConfig: { dataSource: "http" } }));
vi.mock("@/features/feed/feed-card", async () => {const {PostCarousel}=await import("@/components/feed/post-carousel");return {FeedCard:({entry,localPreview}:{entry:{id:string;attachments:[]};localPreview:boolean})=><PostCarousel items={entry.attachments} id={entry.id} localPreview={localPreview}/>};});

const id = "00000000-0000-4000-8000-000000000001";
const source = (index: number) => `http://localhost:8000/api/v1/media/00000000-0000-4000-8000-${String(index).padStart(12, "0")}/download`;
const draft: PostDraft = { id, title: "A thoughtful post", body: "A story about our work", project: "", media: [], videoUrl: "", step: 1, reached: 1, version: 1, editorToken: "editor" };
beforeEach(() => {
  navigation.push.mockReset();
  navigation.params = "";
  class PreviewURL extends URL {
    static createObjectURL = vi.fn((file: Blob) => `blob:${(file as File).name}`);
    static revokeObjectURL = vi.fn();
  }
  vi.stubGlobal("URL", PreviewURL);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => { uploadManager.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function setup(role: Role = "professional", initial = draft) {
  const upload = vi.fn().mockImplementation(async (file: File) => ({ url: source({ "first.png": 1, "second.png": 2, "brief.pdf": 3, "clip.mp4": 4 }[file.name] ?? 9) }));
  const storePostDraft = vi.fn().mockResolvedValue(true);
  const createPost = vi.fn().mockResolvedValue({ id: "published" });
  const person = { id, name: "Post author", headline: "Designer", picture: "" };
  const services = { jobPosts: { getPostDraft: vi.fn().mockResolvedValue(structuredClone(initial)), storePostDraft }, workspace: { getProfessionalShell: vi.fn().mockResolvedValue({ person }), getRecruiterShell: vi.fn().mockResolvedValue({ identity: person }) }, work: { listProjects: vi.fn().mockResolvedValue([]) }, media: { upload }, feed: { createPost } } as unknown as Services;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<ServicesContext.Provider value={services}><QueryClientProvider client={client}><PostEditorScreen role={role} /><UploadTray/></QueryClientProvider></ServicesContext.Provider>);
  return { ...view, upload, storePostDraft, createPost };
}
const file = (name: string, type = "image/png") => new File(["synthetic image bytes"], name, { type });
async function addFiles(files: File[], expectCount = files.length) {
  await screen.findByRole("button", { name: "Add files from your computer" });
  await act(async () => {
    fireEvent.change(document.querySelector<HTMLInputElement>("#post-editor-files")!, {
      target: { files },
    });
  });
  if (expectCount > 0) {
    await waitFor(() =>
      expect(document.querySelectorAll(".post-media-tile")).toHaveLength(
        expectCount,
      ),
    );
  }
}


async function publish(){fireEvent.click(screen.getByRole("button",{name:"Next"}));fireEvent.click(await screen.findByRole("button",{name:/^Publish (demo )?post$/}));}
it.each(["professional","recruiter"] as const)("previews local %s files and publishes them with the post in order",async role=>{
  const {upload,createPost}=setup(role);
  await addFiles([file("first.png"),file("second.png")]);
  expect(upload).not.toHaveBeenCalled();
  expect(screen.queryByRole("button",{name:"Upload selected files"})).not.toBeInTheDocument();
  expect(document.querySelectorAll('.post-carousel-slide')).toHaveLength(1);
  expect(document.querySelector('.post-carousel-slide:not([hidden]) img')).toHaveAttribute('src','blob:first.png');
  fireEvent.click(screen.getByRole('button',{name:'Next media'}));
  expect(document.querySelector('.post-carousel-slide:not([hidden]) img')).toHaveAttribute('src','blob:second.png');
  await publish();
  await waitFor(()=>expect(createPost).toHaveBeenCalledOnce());
  expect(createPost.mock.calls[0][1].attachments.map((item:{src:string})=>item.src)).toEqual([source(1),source(2)]);
  expect(navigation.push).toHaveBeenCalledWith((role==='professional'?'/app':'/recruiter')+'/dashboard');
  expect(await screen.findByText('Post uploaded')).toBeInTheDocument();
});
it("rejects invalid files without starting an upload",async()=>{
  const {upload}=setup();await addFiles([file('script.svg','image/svg+xml')],0);
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a supported file type.');
  expect(upload).not.toHaveBeenCalled();
});
it("keeps failure state and retries the whole publication without publishing incomplete media",async()=>{
  const {upload,createPost}=setup();upload.mockRejectedValueOnce(new Error('Storage unavailable'));
  await addFiles([file('first.png')]);await publish();
  expect(await screen.findByText('Post upload failed')).toBeInTheDocument();
  expect(createPost).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Try again'}));
  await waitFor(()=>expect(createPost).toHaveBeenCalledOnce());
  expect(createPost.mock.calls[0][1].body).toBe(draft.body);
  expect(await screen.findByText('Post uploaded')).toBeInTheDocument();
});
it("uploads documents and videos only after Publish",async()=>{
  const {upload,createPost}=setup();await addFiles([file('brief.pdf','application/pdf'),file('clip.mp4','video/mp4')]);
  expect(upload).not.toHaveBeenCalled();
  expect(document.querySelector('.post-carousel-slide .post-doc-viewer .post-doc-title')).toHaveTextContent('brief');
  await publish();await waitFor(()=>expect(createPost).toHaveBeenCalledOnce());
  expect(upload.mock.calls.map(call=>call[1])).toEqual(['post_image','post_image']);
  expect(createPost.mock.calls[0][1].attachments.map((item:{type:string})=>item.type)).toEqual(['document','video']);
});
it("finishes after the editor unmounts and releases previews only when the post is confirmed",async()=>{
  const {upload,createPost,unmount}=setup();let finish!:(asset:{url:string})=>void;
  upload.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  await addFiles([file('first.png')]);await publish();await waitFor(()=>expect(upload).toHaveBeenCalled());
  expect(document.querySelectorAll('progress')).toHaveLength(1);expect(screen.getByRole('progressbar',{name:'Uploading post'})).toBeInTheDocument();
  unmount();expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  await act(async()=>{finish({url:source(1)});});
  await waitFor(()=>expect(createPost).toHaveBeenCalledOnce());
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:first.png');
});
it("retries an uncertain publication using the same key and already uploaded media",async()=>{
  const {upload,createPost}=setup();createPost.mockRejectedValueOnce(new Error('Response lost'));
  await addFiles([file('first.png')]);await publish();await screen.findByText('Post upload failed');
  const key=createPost.mock.calls[0][1].creationKey;
  fireEvent.click(screen.getByRole('button',{name:'Try again'}));
  await screen.findByText('Post uploaded');
  expect(upload).toHaveBeenCalledOnce();expect(createPost.mock.calls[1][1].creationKey).toBe(key);
});
it("previews more than five files and never saves blob references",async()=>{
  const {upload,storePostDraft}=setup();await addFiles(Array.from({length:6},(_,n)=>file('image-'+n+'.png')));
  expect(document.querySelectorAll('.post-media-tile')).toHaveLength(6);expect(upload).not.toHaveBeenCalled();
  await waitFor(()=>expect(storePostDraft).toHaveBeenCalled());expect(JSON.stringify(storePostDraft.mock.calls)).not.toContain('blob:');
});
it("loads an existing post for edit and saves via updatePost without createPost",async()=>{
  navigation.params = "id=" + id;
  const updatePost = vi.fn().mockResolvedValue(true);
  const createPost = vi.fn();
  const getPostDraft = vi.fn();
  const entry = {
    id,
    type: "post",
    ownerId: id,
    title: "",
    body: "Existing caption",
    kind: "Media post",
    createdAt: new Date().toISOString(),
    skills: [],
    media: "",
    image: source(1),
    attachments: [{ type: "image", src: source(1), alt: "", name: "kept.png", bytes: 12 }],
    likes: 0,
    commentCount: 0,
    comments: [],
    commentsEnabled: true,
    version: 3,
    viewer: { liked: false, saved: false, following: false, own: true, canRepost: false, reposted: false },
  };
  const person = { id, name: "Post author", headline: "Designer", picture: "" };
  const services = {
    jobPosts: { getPostDraft, storePostDraft: vi.fn() },
    workspace: { getProfessionalShell: vi.fn().mockResolvedValue({ person }), getRecruiterShell: vi.fn().mockResolvedValue({ identity: person }) },
    work: { listProjects: vi.fn().mockResolvedValue([]) },
    media: { upload: vi.fn() },
    feed: { createPost, updatePost, getEntry: vi.fn().mockResolvedValue(entry) },
  } as unknown as Services;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<ServicesContext.Provider value={services}><QueryClientProvider client={client}><PostEditorScreen role="professional" /><UploadTray/></QueryClientProvider></ServicesContext.Provider>);
  expect(await screen.findByRole("heading", { level: 1, name: "Edit post" })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Caption" })).toHaveValue("Existing caption");
  expect(getPostDraft).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(document.querySelectorAll(".post-media-tile")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Remove kept.png" }));
  expect(document.querySelectorAll(".post-media-tile")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(await screen.findByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(updatePost).toHaveBeenCalledOnce());
  expect(createPost).not.toHaveBeenCalled();
  expect(updatePost.mock.calls[0][1]).toBe(id);
  expect(updatePost.mock.calls[0][2]).toMatchObject({ body: "Existing caption", version: 3, attachments: [] });
  expect(navigation.push).toHaveBeenCalledWith("/app/dashboard");
});
