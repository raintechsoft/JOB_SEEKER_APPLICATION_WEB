import { afterEach, expect, it, vi } from "vitest";
import { ApiError } from "@/services/api/client";

const instances = vi.hoisted(() => [] as FakePusher[]);
class Emitter {
  handlers = new Map<string, ((value?: unknown) => void)[]>();
  bind(name: string, fn: (value?: unknown) => void) { this.handlers.set(name,[...this.handlers.get(name)??[],fn]); }
  unbind_all() { this.handlers.clear(); }
  emit(name: string,value?:unknown) { this.handlers.get(name)?.forEach(fn=>fn(value)); }
}
class FakePusher extends Emitter {
  connection=new Emitter(); channel=new Emitter(); channels=new Map<string,Emitter>(); disconnect=vi.fn(); subscribe=vi.fn((name:string)=>{const next=this.channels.size?new Emitter():this.channel;this.channels.set(name,next);return next;});
  constructor(readonly key:string, readonly options: Record<string, unknown>) { super();instances.push(this); }
}
vi.mock("pusher-js",()=>({default:function(key:string,options:Record<string,unknown>){return new FakePusher(key,options);}}));
import { connectRealtime } from "@/services/realtime/transport";
const config={enabled:true,key:"test",host:"127.0.0.1",port:8089,scheme:"http"};
const options=()=>({identityId:crypto.randomUUID(),authorize:vi.fn().mockResolvedValue("signed"),changed:vi.fn(),ready:vi.fn(),denied:vi.fn(),state:vi.fn()});
afterEach(()=>{vi.useRealTimers();instances.length=0;});

it("joins public and private channels on the same socket and waits for both; guests never authorize",()=>{
  vi.useFakeTimers();const o={...options(),publicFeed:true},connection=connectRealtime(o,config),p=instances[0];
  expect(instances).toHaveLength(1);expect(p.subscribe).toHaveBeenCalledTimes(2);
  p.channels.get('public-feed.v1')!.emit('pusher:subscription_succeeded');expect(o.ready).not.toHaveBeenCalled();
  p.channel.emit('pusher:subscription_succeeded');expect(o.ready).toHaveBeenCalledOnce();
  const signal={schemaVersion:1,eventId:crypto.randomUUID(),type:'public.changed',audience:'public',occurredAt:new Date().toISOString(),data:{surface:'feed',change:'refresh'}};
  p.channels.get('public-feed.v1')!.emit('skillora.changed.v1',signal);expect(o.changed).toHaveBeenCalledExactlyOnceWith(signal);connection.close();
  const guest={...options(),identityId:undefined,publicFeed:true};const second=connectRealtime(guest,config);expect(instances[1].subscribe).toHaveBeenCalledExactlyOnceWith('public-feed.v1');expect(guest.authorize).not.toHaveBeenCalled();second.close();
});

it("uses only one WebSocket transport, accepts only valid private signals and reconciles subscription",()=>{
  vi.useFakeTimers();const o=options(),connection=connectRealtime(o,config),p=instances[0];
  expect(p.options).toMatchObject({enabledTransports:["ws"],disableStats:true});expect(p.subscribe).toHaveBeenCalledWith(`private-identity.${o.identityId}`);
  p.channel.emit("pusher:subscription_succeeded");expect(o.ready).toHaveBeenCalledOnce();
  p.channel.emit("skillora.changed.v1",{schemaVersion:1,eventId:crypto.randomUUID(),type:"notifications.changed",audience:"identity",occurredAt:new Date().toISOString(),data:{}});
  p.channel.emit("skillora.changed.v1",{message:"private"});expect(o.changed).toHaveBeenCalledOnce();connection.close();expect(p.disconnect).toHaveBeenCalledOnce();
});
it("bounds failed attempts, pauses and permits an explicit retry without polling",async()=>{
  vi.useFakeTimers();const o=options(),connection=connectRealtime(o,config);
  await vi.advanceTimersByTimeAsync(240000);expect(instances).toHaveLength(7);expect(o.state).toHaveBeenLastCalledWith("paused");
  await vi.advanceTimersByTimeAsync(240000);expect(instances).toHaveLength(7);expect(o.authorize).not.toHaveBeenCalled();
  connection.retry();expect(instances).toHaveLength(8);connection.close();await vi.advanceTimersByTimeAsync(240000);expect(instances).toHaveLength(8);
});
it("rejects access changes and ignores delayed authorization after disposal",async()=>{
  vi.useFakeTimers();const o=options();o.authorize.mockRejectedValueOnce(new ApiError("Changed",412));const connection=connectRealtime(o,config),p=instances[0];
  const authorize=(p.options.channelAuthorization as {customHandler: (data:{socketId:string;channelName:string},cb:ReturnType<typeof vi.fn>)=>void}).customHandler;
  const callback=vi.fn();authorize({socketId:"1.2",channelName:`private-identity.${o.identityId}`},callback);await Promise.resolve();await Promise.resolve();
  expect(o.denied).toHaveBeenCalledOnce();expect(callback).not.toHaveBeenCalled();connection.close();
  const later=options();let resolve!:(value:string)=>void;later.authorize.mockImplementation(()=>new Promise(r=>{resolve=r;}));const next=connectRealtime(later,config),second=instances.at(-1)!;
  (second.options.channelAuthorization as {customHandler:typeof authorize}).customHandler({socketId:"1.3",channelName:`private-identity.${later.identityId}`},callback);next.close();resolve("stale-signature");await Promise.resolve();expect(callback).not.toHaveBeenCalled();
});
