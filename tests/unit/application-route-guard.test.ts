import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
import {proxy} from "@/proxy";

vi.mock("@/services/auth/recovery-navigation.server",()=>({recordRecoveryNavigation:vi.fn(async()=>[])}));
const id="10000000-0000-4000-8000-000000000001";
const destination=`/app/jobs/${id}/apply?returnTo=%2Fapp%2Fsearch%3Fq%3Dfrontend`;
let session: {user:{email_verified:boolean};workspaces:{id:string;kind:string}[];selected_identity_id:string};
beforeEach(()=>{
  vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE","http");
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL","http://localhost:8000/api/v1");
  vi.stubEnv("API_SESSION_COOKIE","skillora_test");
  session={user:{email_verified:true},workspaces:[{id,kind:"professional"}],selected_identity_id:id};
  vi.stubGlobal("fetch",vi.fn(async()=>Response.json({data:session})));
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
const request=(path:string)=>new NextRequest("http://localhost:3000"+path,{headers:{cookie:"skillora_test=synthetic"}});

it("returns an authenticated professional from login to the allowlisted application route",async()=>{
  const response=await proxy(request("/login?next="+encodeURIComponent(destination)));
  expect(response.headers.get("location")).toBe("http://localhost:3000"+destination);
  expect(response.headers.get("cache-control")).toBe("no-store, private");
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/auth/me"),expect.objectContaining({cache:"no-store"}));
});
it("preserves the intended application through email verification without accepting an external return",async()=>{
  session.user.email_verified=false;
  const unverified=await proxy(request(destination));
  expect(unverified.headers.get("location")).toBe("http://localhost:3000/verify-email?next="+encodeURIComponent(destination));
  session.user.email_verified=true;
  expect((await proxy(request("/verify-email?next="+encodeURIComponent(destination)))).headers.get("location")).toBe("http://localhost:3000"+destination);
  expect((await proxy(request("/login?next=https%3A%2F%2Fevil.test"))).headers.get("location")).toBe("http://localhost:3000/app/dashboard");
});
it("keeps a selected employer in its existing workspace even when the login URL has an application return",async()=>{
  session.workspaces[0].kind="recruiter";
  expect((await proxy(request("/employer/login?next="+encodeURIComponent(destination)))).headers.get("location")).toBe("http://localhost:3000/recruiter/dashboard");
});
it("redirects a guest to sign-in with the original application URL and leaves API authorization authoritative",async()=>{
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null,{status:401}));
  const response=await proxy(request(destination));
  expect(response.headers.get("location")).toBe("http://localhost:3000/login?next="+encodeURIComponent(destination));
});
