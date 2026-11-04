import { afterEach, expect, it, vi } from "vitest";
import { createHttpClient, type HttpClient } from "@/services/api/client";
import { createHttpAuthService } from "@/services/auth/auth.http";
import type { AuthSession } from "@/services/auth/auth.service";

afterEach(()=>vi.unstubAllGlobals());
it("does not let a delayed socket session probe replace a more recent login",async()=>{
  const old={user:{id:"old"},selected_identity_id:"old-workspace"} as AuthSession;
  const current={user:{id:"current"},selected_identity_id:"current-workspace"} as AuthSession;
  let resolve!:(value:unknown)=>void;
  const reset=vi.fn(),bound=vi.fn();
  const http={setUserContext:vi.fn(),get:vi.fn().mockImplementationOnce(()=>new Promise(r=>{resolve=r;})).mockResolvedValue({data:current}),post:vi.fn().mockResolvedValue({data:current})} as unknown as HttpClient;
  const auth=createHttpAuthService(http,reset,bound);
  const pending=auth.refreshSession!();await auth.login({email:"synthetic@example.test",password:"Synthetic-only!42"});
  resolve({data:old});await expect(pending).rejects.toMatchObject({status:412});
  expect(await auth.me()).toEqual(current);expect(bound).toHaveBeenCalledExactlyOnceWith(current);expect(reset).toHaveBeenCalledOnce();
});
it("rejects an old private HTTP response after the bound context changes",async()=>{
  let resolve!:(value:Response)=>void;const fetch=vi.fn().mockImplementation(()=>new Promise<Response>(r=>{resolve=r;}));vi.stubGlobal("fetch",fetch);
  const http=createHttpClient("http://api.example.test/api/v1/");http.setUserContext("old");
  const pending=http.get("me/communications/old/notifications");http.setUserContext(null);http.setUserContext("new");
  resolve(new Response(JSON.stringify({data:{items:[{title:"Old private snapshot"}]}}),{status:200,headers:{"Content-Type":"application/json"}}));
  await expect(pending).rejects.toMatchObject({status:412});expect(fetch).toHaveBeenCalledOnce();
});
