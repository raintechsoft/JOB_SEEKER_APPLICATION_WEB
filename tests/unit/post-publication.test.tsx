import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {act,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {postPublications} from "@/services/media/post-publication-manager";
import {uploadManager} from "@/services/media/upload-manager";
import {UploadTray} from "@/features/workspace/upload-tray";

beforeEach(()=>{
  class PreviewURL extends URL {static createObjectURL=vi.fn(()=>"blob:test");static revokeObjectURL=vi.fn();}
  vi.stubGlobal("URL",PreviewURL);
});
afterEach(()=>{uploadManager.clear();vi.unstubAllGlobals();});
const asset={id:"asset",url:"https://api.example/asset",name:"photo.png",bytes:20};
it("groups child transfers into one progress bar, retries failed children and waits for post acknowledgement",async()=>{
  let attempts=0,confirm!:()=>void;
  const acknowledged=new Promise<void>(resolve=>{confirm=resolve;});
  const release=vi.fn();
  const run=vi.fn(async(groupId:string,signal:AbortSignal,publishing:()=>void)=>{
    await uploadManager.add(new File(["fixture"],"photo.png",{type:"image/png"}),async(_signal,progress)=>{
      progress(50);
      if(++attempts===1)throw new Error("Synthetic interruption");
      return asset;
    },false,undefined,groupId);
    signal.throwIfAborted();publishing();await acknowledged;return "/app/dashboard?post=one";
  });
  let id="";act(()=>{id=postPublications.start("draft-one","A post",run,release);});
  render(<UploadTray/>);
  await screen.findByText("Post upload failed");
  // One bar for the post's grouped files, plus the panel's overall bar.
  expect(screen.getAllByRole("progressbar").filter(bar=>bar.getAttribute("aria-label")!=="Overall upload progress")).toHaveLength(1);
  expect(screen.queryByText("photo.png")).not.toBeInTheDocument();
  act(()=>postPublications.retry(id));
  await waitFor(()=>expect(postPublications.getSnapshot()[0].state).toBe("publishing"));
  expect(postPublications.getSnapshot()[0].progress).toBe(95);
  expect(run).toHaveBeenCalledOnce();expect(attempts).toBe(2);expect(release).not.toHaveBeenCalled();
  await act(async()=>{confirm();});
  await screen.findByText("Post uploaded");
  expect(postPublications.getSnapshot()[0]).toMatchObject({progress:100,href:"/app/dashboard?post=one"});
  expect(uploadManager.getSnapshot()).toHaveLength(0);expect(release).toHaveBeenCalledOnce();
});
it("deduplicates a publication and cancels it when identity state is cleared",async()=>{
  let finish!:()=>void;const pending=new Promise<void>(resolve=>{finish=resolve;});
  let signal!:AbortSignal;const release=vi.fn();
  const run=vi.fn(async(_id:string,current:AbortSignal)=>{signal=current;await pending;current.throwIfAborted();return "/app/dashboard?post=one";});
  const first=postPublications.start("same-draft","Post",run,release);
  expect(postPublications.start("same-draft","Post",run,release)).toBe(first);
  await waitFor(()=>expect(run).toHaveBeenCalledOnce());
  uploadManager.clear();expect(signal.aborted).toBe(true);expect(release).toHaveBeenCalledOnce();
  finish();await Promise.resolve();expect(postPublications.getSnapshot()).toEqual([]);
});

it("minimises to a docked bar that keeps only the title, overall progress and percentage",async()=>{
  sessionStorage.clear();
  let finish!:()=>void;const pending=new Promise<void>(resolve=>{finish=resolve;});
  act(()=>{void uploadManager.add(new File(["fixture"],"photo.png",{type:"image/png"}),async(_signal,progress)=>{progress(40);await pending;return asset;},false);});
  render(<UploadTray/>);
  const toggle=await screen.findByRole("button",{name:/Minimise uploads/});
  expect(screen.getByText("photo.png")).toBeVisible();
  fireEvent.click(toggle);
  expect(screen.getByRole("button",{name:/Expand uploads/})).toHaveAttribute("aria-expanded","false");
  expect(screen.queryByText("photo.png")).not.toBeVisible();
  expect(screen.getByRole("progressbar",{name:"Overall upload progress"})).toBeVisible();
  expect(screen.getByText(/%$/)).toBeVisible();
  await act(async()=>{finish();});
});
