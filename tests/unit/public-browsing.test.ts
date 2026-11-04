import {describe,expect,it,vi} from "vitest";
import examples from "../../contracts/examples/public-browsing.json";
import policy from "../../contracts/validation/public-browsing.json";
import {publicCommentsQuerySchema,publicEntrySchema,publicFeedQuerySchema,publicSearchQuerySchema,publicExternalVideoSchema} from "@/lib/validation/public-browsing";
import {GUEST_ACTIONS,guestActionDecision,guestPrompt,readGuestIntent,safeGuestReturnPath,type GuestAction,type GuestViewer} from "@/lib/domain/guest-access";
import {createPublicBrowsingQueries} from "@/services/public-browsing/public-browsing.service";

const id=examples.entry.id,viewer:GuestViewer={state:"authenticated",emailVerified:true,workspace:"professional",availableWorkspaces:["professional"],permissions:[]};
const schemas={feed:publicFeedQuerySchema,comments:publicCommentsQuerySchema,search:publicSearchQuerySchema};
describe("G1 public read contracts",()=>{
  it.each(examples.externalVideoUrls)("G2 legacy video URL $url",example=>expect(publicExternalVideoSchema.safeParse({position:0,url:example.url,name:"video",alt:""}).success).toBe(example.valid));
  it.each(examples.queries)("$name",example=>expect(schemas[example.operation as keyof typeof schemas].safeParse(example.input).success).toBe(example.valid));
  it("accepts only the public entry projection and masks confidential companies",()=>{
    expect(publicEntrySchema.safeParse(examples.entry).success).toBe(true);
    for(const extra of [{viewer:{own:false}},{analyticsContext:{}},{email:"private@example.test"},{resume:{}},{conversationId:id}])expect(publicEntrySchema.safeParse({...examples.entry,...extra}).success).toBe(false);
    expect(publicEntrySchema.safeParse({...examples.entry,author:{...examples.entry.author,phone:"private"}}).success).toBe(false);
    expect(publicEntrySchema.safeParse({...examples.entry,path:"/app/dashboard"}).success).toBe(false);
    expect(publicEntrySchema.safeParse({...examples.entry,company:{id,name:"Confidential company",profilePath:null,logo:null,confidential:true,verified:false}}).success).toBe(false);
    expect(publicEntrySchema.safeParse({...examples.entry,kind:"job",author:null,job:{id,title:"Frontend Developer",location:"Remote",arrangement:"Remote",employment:"Full-time",compensationLabel:"Competitive",acceptingApplications:true,closesAt:null,publicPath:`/jobs/${id}`},company:{id,name:"Synthetic Labs",profilePath:"/organizations/synthetic-labs",logo:null,confidential:false,verified:true}}).success).toBe(true);
  });
  it("rejects raw storage URLs and cross-resource media paths",()=>{
    const file={id,kind:"image",mime:"image/png",name:"public.png",alt:"",downloadPath:`/api/v1/media/${id}/download`};
    expect(publicEntrySchema.safeParse({...examples.entry,media:[file]}).success).toBe(true);
    for(const downloadPath of ["https://bucket.example/object?signature=secret","javascript:alert(1)",`/api/v1/media/${examples.comment.id}/download`])expect(publicEntrySchema.safeParse({...examples.entry,media:[{...file,downloadPath}]}).success).toBe(false);
  });
  it("validates before transport and rejects private fields in an API response",async()=>{
    const transport={feed:vi.fn(async()=>({items:[examples.entry],nextCursor:null,total:1})),entry:vi.fn(async()=>examples.entry),comments:vi.fn(async()=>({items:[examples.comment],nextCursor:null,total:1})),search:vi.fn(async()=>({items:[],nextCursor:null,total:0,scope:"all"}))};
    const api=createPublicBrowsingQueries(transport);
    await expect(api.feed({identity:id})).rejects.toThrow();await expect(api.search({q:"a"})).rejects.toThrow();await expect(api.entry("../admin")).rejects.toThrow();
    expect(transport.feed).not.toHaveBeenCalled();expect(transport.entry).not.toHaveBeenCalled();expect(transport.search).not.toHaveBeenCalled();
    await expect(api.feed()).resolves.toMatchObject({total:1});
    transport.feed.mockResolvedValueOnce({items:[{...examples.entry,viewer:{saved:true}}],nextCursor:null,total:1} as unknown as Awaited<ReturnType<typeof transport.feed>>);
    await expect(api.feed()).rejects.toThrow();
    transport.entry.mockResolvedValueOnce({...examples.entry,id:examples.comment.id,path:`/feed/${examples.comment.id}`});await expect(api.entry(id)).rejects.toThrow(/does not match/);
    transport.comments.mockResolvedValueOnce({items:[{...examples.comment,entryId:examples.comment.id}],nextCursor:null,total:1});await expect(api.comments(id)).rejects.toThrow(/do not belong/);
    transport.search.mockResolvedValueOnce({items:[],nextCursor:null,total:0,scope:"jobs"});await expect(api.search({q:"Engineer"})).rejects.toThrow(/does not match/);
    transport.search.mockResolvedValueOnce({items:[{id,kind:"company",title:"Synthetic team",subtitle:"",path:"/organizations/synthetic-team",picture:null}],nextCursor:null,total:1,scope:"people"} as unknown as Awaited<ReturnType<typeof transport.search>>);await expect(api.search({q:"Engineer",scope:"people"})).rejects.toThrow(/does not match/);
  });
});
describe("G1 action decisions",()=>{
  it.each([...policy.accountActions,...policy.professionalActions,...policy.recruiterActions] as GuestAction[])("requires sign-in for guest %s",action=>expect(guestActionDecision(action,{state:"guest"})).toBe("sign_in"));
  it.each(policy.publicActions as GuestAction[])("keeps public %s available without a session",action=>{expect(guestActionDecision(action,{state:"guest"})).toBe("allow");expect(guestActionDecision(action,{state:"loading"})).toBe("allow");});
  it.each(Object.keys(policy.permissionActions) as GuestAction[])("hides unauthorized %s instead of promising access after login",action=>{expect(guestActionDecision(action,{state:"guest"})).toBe("hidden");expect(guestActionDecision(action,viewer)).toBe("hidden");});
  it("separates email verification, role selection, outages and restrictions",()=>{
    expect(guestActionDecision("like",{state:"loading"})).toBe("pending");expect(guestActionDecision("like",{state:"unavailable"})).toBe("unavailable");expect(guestActionDecision("like",{state:"restricted"})).toBe("denied");
    expect(guestActionDecision("apply",{...viewer,emailVerified:false})).toBe("verify_email");
    expect(guestActionDecision("shortlist",viewer)).toBe("workspace_required");
    expect(guestActionDecision("shortlist",{...viewer,availableWorkspaces:["professional","recruiter"]})).toBe("switch_workspace");
    expect(guestActionDecision("like",{...viewer,workspace:null})).toBe("choose_workspace");
    expect(guestActionDecision("like",viewer)).toBe("allow");
    expect(guestActionDecision("edit_post",{...viewer,permissions:["edit_post"]})).toBe("allow");
    expect(guestActionDecision("change_application_status",{...viewer,permissions:["change_application_status"]})).toBe("workspace_required");
    expect(guestActionDecision("change_application_status",{...viewer,permissions:["change_application_status"],availableWorkspaces:["professional","recruiter"]})).toBe("switch_workspace");
    expect(()=>guestActionDecision("__proto__" as GuestAction,viewer)).toThrow();
  });
  it("uses contextual copy and matching registration portals without duplicating actions",()=>{
    expect(guestPrompt("like")?.title).toBe("Like this post?");expect(guestPrompt("apply")?.signInPath).toBe("/login");expect(guestPrompt("shortlist")?.signInPath).toBe("/employer/login");
    expect(guestPrompt("copy_link")).toMatchObject({title:"Share this post"});expect(guestPrompt("delete_post")).toBeNull();
    expect(new Set(GUEST_ACTIONS).size).toBe(GUEST_ACTIONS.length);expect(policy.live).toBe(false);
  });
});
describe("G1 bounded authentication returns",()=>{
  it.each(["/","/talent","/talent?q=Engineer","/how-it-works","/feed",`/feed/${id}`,`/feed/${id}?comment=${examples.comment.id}#comment-${examples.comment.id}`,"/search?q=Engineer&scope=people","/jobs","/jobs?q=Engineer&page=2",`/jobs/${id}`,"/professionals/synthetic-author","/organizations/synthetic-team","/portfolio/synthetic-author","/app/messages","/app/settings","/app/settings/privacy","/app/settings/notifications","/recruiter/settings/notifications",`/app/jobs/${id}/apply?returnTo=${encodeURIComponent(`/jobs/${id}`)}`])("accepts the allowlisted return %s",path=>expect(safeGuestReturnPath(path)).not.toBeNull());
  it.each(["https://evil.test","//evil.test","/\\evil.test","/feed/../admin","/%2f%2fevil.test","/admin","/feed?identity=private","/search?q=Engineer&scope=talent","/search?q=a&q=Engineer","/portfolio/synthetic-author?share=secret","/app/messages?conversation=private","/login?next=/feed",`/feed/${id}?token=secret`,`/feed/${id}#secret`,`/app/jobs/${id}/apply?returnTo=https%3A%2F%2Fevil.test`,"/app/settings/billing"])("rejects unsafe or private return %s",path=>expect(safeGuestReturnPath(path)).toBeNull());
  it("expires a continuation without persisting sensitive state or replaying an action",()=>{
    const now=1_000_000,intent={action:"like",returnTo:`/feed/${id}`,createdAt:now,expiresAt:now+policy.intentTtlSeconds*1000};
    expect(readGuestIntent(intent,now)).toMatchObject({action:"like"});expect(readGuestIntent(intent,intent.expiresAt)).toBeNull();expect(readGuestIntent(intent,now-1)).toBeNull();
    expect(readGuestIntent({...intent,comment:"Private draft"},now)).toBeNull();expect(readGuestIntent({...intent,expiresAt:intent.expiresAt+1},now)).toBeNull();
  });
});
