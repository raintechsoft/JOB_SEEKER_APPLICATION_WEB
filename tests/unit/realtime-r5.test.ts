import { afterEach, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { createHiringReconciler } from "@/services/realtime/hiring-reconcile";
import type { Signal } from "@/services/realtime/signal";

const signal = (type = "application.changed", data = {}): Signal => ({ schemaVersion: 1, eventId: crypto.randomUUID(), type, audience: "identity", occurredAt: new Date().toISOString(), data });
afterEach(() => vi.useRealTimers());
function setup() {
  vi.useFakeTimers();
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } });
  const stops: (()=>void)[]=[];
  const watch = (key: unknown[], fn = vi.fn().mockResolvedValue(1)) => {
    cache.setQueryData(key,0);
    const observer = new QueryObserver(cache,{queryKey:key,queryFn:fn,staleTime:Infinity});
    stops.push(observer.subscribe(()=>{})); return fn;
  };
  let visible=true;
  const reconcile=createHiringReconciler(cache,"u","i",()=>visible);
  return {cache,watch,reconcile,hide:()=>{visible=false;},show:()=>{visible=true;},close:()=>{reconcile.dispose();stops.forEach(stop=>stop());cache.clear();}};
}
it("refreshes filtered rows and counts together, coalesces duplicates and performs no idle reads",async()=>{
  const s=setup(), rows=s.watch(["applications","u","i","results","Interview"]), totals=s.watch(["applications","u","i","overview"]);
  const foreign=s.watch(["applications","u","other"]), review=s.watch(["review","u","i","a"]);
  s.cache.setQueryData(["application-drafts","u","i"],[]);
  const hint=signal();s.reconcile.receive(hint);s.reconcile.receive(hint);s.reconcile.receive(signal());await vi.advanceTimersByTimeAsync(151);
  expect(rows).toHaveBeenCalledOnce();expect(totals).toHaveBeenCalledOnce();expect(foreign).not.toHaveBeenCalled();expect(review).not.toHaveBeenCalled();
  expect(s.cache.getQueryState(["application-drafts","u","i"])?.isInvalidated).toBe(true);
  await vi.advanceTimersByTimeAsync(65000);expect(rows).toHaveBeenCalledOnce();s.close();
});
it("rechecks reviewer edits without disclosing or refetching private applicant views",async()=>{
  const s=setup(), review=s.watch(["review","u","i","a"]), editor=s.watch(["job-editor-live","u","i","draft"]), application=s.watch(["applications","u","i"]);
  s.reconcile.receive(signal("hiring.changed"));await vi.advanceTimersByTimeAsync(151);
  expect(review).toHaveBeenCalledOnce();expect(editor).toHaveBeenCalledOnce();expect(application).not.toHaveBeenCalled();s.close();
});
it("rechecks application requirements and job availability but ignores public feed hints",async()=>{
  const s=setup(), editor=s.watch(["application-live","u","i","job"]), job=s.watch(["job","u","i","job"]);
  s.reconcile.receive(signal("public.changed",{surface:"feed",change:"refresh"}));await vi.advanceTimersByTimeAsync(151);expect(editor).not.toHaveBeenCalled();
  s.reconcile.receive(signal("public.changed",{surface:"jobs",change:"availability"}));await vi.advanceTimersByTimeAsync(151);expect(editor).toHaveBeenCalledOnce();expect(job).toHaveBeenCalledOnce();s.close();
});
it("reads again after a snapshot already in flight so a remote change cannot be lost",async()=>{
  const s=setup();let resolve!:(value:number)=>void;
  const read=vi.fn().mockImplementationOnce(()=>new Promise<number>(r=>{resolve=r;})).mockResolvedValue(2),key=["applications","u","i"];
  s.watch(key,read);const pending=s.cache.refetchQueries({queryKey:key});s.reconcile.receive(signal());await vi.advanceTimersByTimeAsync(151);
  resolve(1);await pending;await vi.advanceTimersByTimeAsync(151);expect(read).toHaveBeenCalledTimes(2);expect(s.cache.getQueryData(key)).toBe(2);s.close();
});
it("defers hidden reads, resumes once and cancels old-account consumers on disposal",async()=>{
  const s=setup(), read=s.watch(["applications","u","i"]);s.hide();s.reconcile.receive(signal("job-tracker.changed"));await vi.advanceTimersByTimeAsync(10000);expect(read).not.toHaveBeenCalled();
  s.show();s.reconcile.resume();s.reconcile.resume();await vi.advanceTimersByTimeAsync(151);expect(read).toHaveBeenCalledOnce();
  s.reconcile.dispose();s.reconcile.receive(signal());s.reconcile.resume();await vi.advanceTimersByTimeAsync(65000);expect(read).toHaveBeenCalledOnce();s.close();
});
