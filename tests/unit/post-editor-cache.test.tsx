import {expect,it,vi} from "vitest";
import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {ServicesContext} from "@/hooks/use-services";
import type {Services} from "@/services";
import type {FeedEntry} from "@/services/feed/feed.service";
import {EditPost} from "@/features/feed/post-dialogs";

it("replaces both list and permalink snapshots with the server-confirmed edit revision",async()=>{
  const original={id:"post-one",title:"Original",body:"Story",version:1} as FeedEntry;
  const fresh={...original,title:"Updated",body:"Edited story",version:2};
  const cache=new QueryClient({defaultOptions:{queries:{retry:false}}});
  cache.setQueryData(["feed","recruiter","all"],{items:[original]});
  cache.setQueryData(["feed-entry","recruiter",original.id],original);
  cache.setQueryData(["feed","professional","all"],{items:[original]});
  const updatePost=vi.fn().mockResolvedValue(true),getEntry=vi.fn().mockResolvedValue(fresh);
  const services={feed:{updatePost,getEntry}} as unknown as Services;
  render(<ServicesContext.Provider value={services}><QueryClientProvider client={cache}><EditPost entry={original} role="recruiter"/></QueryClientProvider></ServicesContext.Provider>);
  fireEvent.change(screen.getByRole("textbox",{name:"Title"}),{target:{value:"Updated"}});
  fireEvent.change(screen.getByRole("textbox",{name:"Your post"}),{target:{value:"Edited story"}});
  fireEvent.click(screen.getByRole("button",{name:"Save changes"}));
  await waitFor(()=>expect(cache.getQueryData(["feed-entry","recruiter",original.id])).toEqual(fresh));
  expect(cache.getQueryData(["feed","recruiter","all"])).toEqual({items:[fresh]});
  expect(cache.getQueryData(["feed","professional","all"])).toEqual({items:[original]});
  expect(updatePost).toHaveBeenCalledWith("recruiter",original.id,expect.objectContaining({version:1,title:"Updated"}));
});
