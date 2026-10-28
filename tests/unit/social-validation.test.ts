import { describe, expect, it } from "vitest";
import { commentSchema, directVideoSchema, postDraftValuesSchema, postPublishSchema, postSelectionSchema, postTextSchema, validatePostFiles } from "@/lib/validation/social";
const image={type:"image" as const,src:`http://localhost:8000/api/v1/media/${crypto.randomUUID()}/download`,alt:"",name:"work.png",bytes:500};
const draft={title:"",body:"",project:"",media:[],videoUrl:"",step:0,reached:0};
describe("social input boundaries",()=>{
  it("accepts incomplete draft text without accepting incomplete publish requests",()=>{expect(postDraftValuesSchema.safeParse(draft).success).toBe(true);expect(postPublishSchema.safeParse({...draft,attachments:[]}).success).toBe(false);expect(postTextSchema.safeParse({title:" ",body:"Story"}).success).toBe(true);expect(postPublishSchema.safeParse({title:"",body:"Story only",project:"",attachments:[]}).success).toBe(true);expect(postPublishSchema.safeParse({title:"Title only",body:"",project:"",attachments:[]}).success).toBe(true);expect(postDraftValuesSchema.safeParse({...draft,step:2}).success).toBe(false);});
  it("accepts published media without descriptions and requires managed image URLs",()=>{const input={title:"Work",body:"A story",project:"",attachments:[image]};expect(postPublishSchema.safeParse(input).success).toBe(true);expect(postDraftValuesSchema.safeParse({...draft,media:[{...image,src:"data:image/png;base64,AAAA"}]}).success).toBe(false);expect(postPublishSchema.safeParse({...input,attachments:[{...image,alt:"A"},{...image,alt:"B"}]}).success).toBe(false);});
  it("accepts uploaded documents, uploaded videos, and direct video URLs",()=>{
    const document={type:"document" as const,src:`http://localhost:8000/api/v1/media/${crypto.randomUUID()}/download`,alt:"",name:"brief.pdf",bytes:400};
    const uploadedVideo={type:"video" as const,src:`http://localhost:8000/api/v1/media/${crypto.randomUUID()}/download`,alt:"",name:"clip.mp4",bytes:800};
    const linkedVideo={type:"video" as const,src:"https://example.test/movie.mp4",alt:"",name:"Video 1"};
    expect(postPublishSchema.safeParse({title:"Work",body:"A story",project:"",attachments:[document,uploadedVideo]}).success).toBe(true);
    expect(postPublishSchema.safeParse({title:"Work",body:"A story",project:"",attachments:[linkedVideo]}).success).toBe(true);
    expect(postPublishSchema.safeParse({title:"Work",body:"A story",project:"",attachments:[{...document,src:"https://example.test/brief.pdf"}]}).success).toBe(false);
  });
  it("bounds comments, videos and configurable file budgets without a five-item product limit",()=>{
    expect(commentSchema.safeParse(" ").success).toBe(false);
    expect(directVideoSchema.safeParse("javascript:alert(1)").success).toBe(false);
    const file=(name:string,bytes=1)=>{const f=new File(["x"],name,{type:"image/png"});Object.defineProperty(f,"size",{value:bytes});return f;};
    expect(validatePostFiles(Array.from({length:6},(_,n)=>file(n+".png")),[])).toBeNull();
    expect(validatePostFiles(Array.from({length:201},(_,n)=>file(n+".png")),[])).toBeTruthy();
    expect(validatePostFiles(Array.from({length:5},(_,n)=>file(n+".png",500*1048576)),[])).toBeTruthy();
    expect(validatePostFiles([new File(["bad"],"script.svg",{type:"image/svg+xml"})],[])).toBeTruthy();
  });
});
it("permits local selection previews but never permits them in a publish request",()=>{
  const value={title:"",body:"",project:"",attachments:[{type:"image",src:"blob:local-file",alt:"",name:"photo.png",bytes:100}]};
  expect(postSelectionSchema.safeParse(value).success).toBe(true);
  expect(postPublishSchema.safeParse(value).success).toBe(false);
});
