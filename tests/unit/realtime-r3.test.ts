import { afterEach, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { parseSignal, type Signal } from "@/services/realtime/signal";
import { createReconciler } from "@/services/realtime/reconcile";
import catalog from "@/services/realtime/contracts/events.v1.json";
import { createHttpMessagingService } from "@/services/messaging/messaging.http";
import type { HttpClient } from "@/services/api/client";
import type { AuthService } from "@/services/auth/auth.service";

const id = "00000000-0000-4000-8000-000000000001";
const signal = (type = "notifications.changed", data = {}): Signal => ({ schemaVersion: 1, eventId: crypto.randomUUID(), type, audience: "identity", occurredAt: new Date().toISOString(), data });
afterEach(() => vi.useRealTimers());

it("validates every shared event and rejects private content, unknown data, foreign audiences and oversized signals", () => {
  for (const event of catalog.events) {
    const data = Object.fromEntries(Object.entries(event.data).map(([k,v]) => [k, Array.isArray(v) ? v[0] : v === "sequence" ? 1 : id]));
    const value = {...signal(event.type,data), audience: event.audience as Signal["audience"]};
    expect(parseSignal(value,value.audience),event.type).toEqual(value);
    expect(parseSignal({...value,data:{...data,text:"private message"}},value.audience)).toBeNull();
  }
  expect(parseSignal(signal(),"public")).toBeNull();
  expect(parseSignal({...signal(), extra:"secret"},"identity")).toBeNull();
  expect(parseSignal({...signal(),eventId:"bad"},"identity")).toBeNull();
  expect(parseSignal({...signal(),occurredAt:"tomorrow"},"identity")).toBeNull();
  expect(parseSignal({...signal(),data:{text:"a".repeat(3000)}},"identity")).toBeNull();
});

function setup() {
  vi.useFakeTimers();
  const cache = new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity,gcTime:Infinity}}});
  const stops: (()=>void)[]=[];
  const watch = (key: unknown[], fn = vi.fn().mockResolvedValue(1)) => {
    cache.setQueryData(key,0);
    const observer = new QueryObserver(cache,{queryKey:key,queryFn:fn,staleTime:Infinity});
    stops.push(observer.subscribe(()=>{})); return fn;
  };
  let visible = true;
  const reconcile = createReconciler(cache,"u","i",()=>visible);
  return {cache,watch,reconcile,hide:()=>{visible=false;},show:()=>{visible=true;},close:()=>{reconcile.dispose();stops.forEach(stop=>stop());cache.clear();}};
}
it("coalesces bursts, deduplicates IDs and refreshes only the current identity's active affected queries",async()=>{
  const s=setup();
  const count=s.watch(["notification-counts","u","i","professional"]), inbox=s.watch(["messaging","u","i","professional"]), foreign=s.watch(["notification-counts","u","other"]);
  s.cache.setQueryData(["notifications","u","i"],[]);
  const hint=signal(); s.reconcile.receive(hint); s.reconcile.receive(hint); s.reconcile.receive(signal());
  await vi.advanceTimersByTimeAsync(101);
  expect(count).toHaveBeenCalledTimes(1); expect(inbox).not.toHaveBeenCalled(); expect(foreign).not.toHaveBeenCalled();
  expect(s.cache.getQueryState(["notifications","u","i"])?.isInvalidated).toBe(true);
  s.reconcile.receive(hint); await vi.advanceTimersByTimeAsync(60000); expect(count).toHaveBeenCalledTimes(1); s.close();
});
it("preserves history depth and ignores hints for other conversations",async()=>{
  const s=setup(); const active=s.watch(["message-history","u","i","professional",id,150]),other=s.watch(["message-history","u","i","professional","other",50]);
  s.reconcile.receive(signal("conversation.updated",{conversationId:id})); await vi.advanceTimersByTimeAsync(101);
  expect(active).toHaveBeenCalledOnce();expect(other).not.toHaveBeenCalled();s.close();
});
it("upgrades own ticks from a receipt hint without refetching history or rolling back",async()=>{
  const s=setup(); const history=["message-history","u","i","professional",id,50] as const;
  const read=s.watch([...history]);
  s.cache.setQueryData(history,{id,messages:[
    {id:"own",own:true,sequence:1,status:"sent",text:"Hi",sender:"professional",time:"2026-01-01T00:00:00Z",attachments:[]},
    {id:"peer",own:false,sequence:2,status:null,text:"Hello",sender:"recruiter",time:"2026-01-01T00:00:01Z",attachments:[]},
  ]});
  s.reconcile.receive(signal("conversation.receipt",{conversationId:id,kind:"delivered",throughSequence:1}));
  await vi.advanceTimersByTimeAsync(101);
  expect(read).not.toHaveBeenCalled();
  const afterDeliver=s.cache.getQueryData(history) as {messages:{status:string|null}[]};
  expect(afterDeliver.messages[0].status).toBe("delivered");
  expect(afterDeliver.messages[1].status).toBeNull();
  s.reconcile.receive(signal("conversation.receipt",{conversationId:id,kind:"seen",throughSequence:1}));
  expect((s.cache.getQueryData(history) as {messages:{status:string}[]}).messages[0].status).toBe("seen");
  s.reconcile.receive(signal("conversation.receipt",{conversationId:id,kind:"delivered",throughSequence:1}));
  expect((s.cache.getQueryData(history) as {messages:{status:string}[]}).messages[0].status).toBe("seen");
  s.close();
});
it("performs a trailing read when a signal arrives during an older snapshot request",async()=>{
  const s=setup(); let resolve!:(value:number)=>void;
  const read=vi.fn().mockImplementationOnce(()=>new Promise<number>(r=>{resolve=r;})).mockResolvedValue(2);
  const key=["notification-counts","u","i"];s.watch(key,read);
  const before=s.cache.refetchQueries({queryKey:key}); s.reconcile.receive(signal());await vi.advanceTimersByTimeAsync(101);
  resolve(1);await before;await vi.advanceTimersByTimeAsync(101);
  expect(read).toHaveBeenCalledTimes(2);expect(s.cache.getQueryData(key)).toBe(2);s.close();
});
it("holds hidden-page hints, reconciles once on resume and stops after disposal",async()=>{
  const s=setup();const read=s.watch(["notification-counts","u","i"]);s.hide();s.reconcile.receive(signal());await vi.advanceTimersByTimeAsync(2000);expect(read).not.toHaveBeenCalled();
  s.show();s.reconcile.resume();s.reconcile.resume();await vi.advanceTimersByTimeAsync(101);expect(read).toHaveBeenCalledOnce();
  s.reconcile.dispose();s.reconcile.receive(signal());s.reconcile.resume();await vi.advanceTimersByTimeAsync(60000);expect(read).toHaveBeenCalledOnce();s.close();
});
it("rejects a response from an old workspace and rejects mismatched query scopes before fetching",async()=>{
  let resolve!:(value:unknown)=>void;
  const auth={me:vi.fn().mockResolvedValue({user:{id},selected_identity_id:id,workspaces:[{id,kind:"professional"}]})} as unknown as AuthService;
  const http={get:vi.fn().mockImplementation(()=>new Promise(r=>{resolve=r;}))} as unknown as HttpClient;
  const service=createHttpMessagingService(http,auth);
  await expect(service.getUnreadCount!("professional",{identityId:crypto.randomUUID()})).rejects.toMatchObject({status:412});expect(http.get).not.toHaveBeenCalled();
  const pending=service.getUnreadCount!("professional",{identityId:id,userId:id});await Promise.resolve();await Promise.resolve();
  service.reset();resolve({data:{unreadCount:8}});await expect(pending).rejects.toMatchObject({status:412});
});
