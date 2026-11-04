import type { Signal } from "./signal";

export type SignalNotice = Signal | { type: "resume" | "context-ended" };
/** Per-service instance, shared by the one socket provider and background tasks. */
export function createSignalHub() {
  const listeners=new Set<(event:SignalNotice)=>void>();
  const seen=new Set<string>();
  const portfolioListeners=new Set<()=>void>();
  let portfolioToken:string|undefined;
  return {
    portfolioSnapshot:()=>portfolioToken,
    subscribePortfolio(listener:()=>void){portfolioListeners.add(listener);return()=>{portfolioListeners.delete(listener);};},
    watchPortfolio(token:string|undefined){portfolioToken=token;for(const listener of portfolioListeners)listener();return()=>{if(portfolioToken===token){portfolioToken=undefined;for(const listener of portfolioListeners)listener();}};},
    subscribe(listener:(event:SignalNotice)=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
    emit(event:SignalNotice){if("eventId" in event){if(seen.has(event.eventId))return;seen.add(event.eventId);if(seen.size>1024)seen.delete(seen.values().next().value!);}if(event.type==="context-ended")seen.clear();for(const listener of [...listeners])listener(event);},
  };
}
export type SignalHub=ReturnType<typeof createSignalHub>;

/** Subscribe before starting completion, then reconcile once even when the first event was missed. */
export function processingWaiter<T>(options:{hub:SignalHub;type:string;id:string;field:string;signal:AbortSignal;read:()=>Promise<T>;terminal:(value:T)=>boolean;timeoutMs?:number}) {
  let disposed=false, active=false, dirty=false, running=false;
  let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;
  const result=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
  // A completion request may fail before the caller awaits this promise.
  void result.catch(()=>{});
  const stop=()=>{disposed=true;clearTimeout(timer);unsubscribe();options.signal.removeEventListener("abort",abort);};
  const fail=(error:unknown)=>{if(!disposed){stop();reject(error);}};
  const abort=()=>fail(options.signal.reason??new DOMException("Cancelled","AbortError"));
  const check=async()=>{
    if(disposed||!active)return;
    if(running){dirty=true;return;}
    running=true;dirty=false;
    try{const state=await options.read();if(!disposed&&options.terminal(state)){stop();resolve(state);}}
    catch(error){fail(error);}
    finally{running=false;if(dirty&&!disposed)void check();}
  };
  const unsubscribe=options.hub.subscribe(event=>{
    if(event.type==="context-ended")return fail(new Error("Your account changed. Reopen the upload to check its status."));
    if(event.type==="resume"||("data" in event&&event.type===options.type&&event.data[options.field]===options.id)){dirty=true;if(active)void check();}
  });
  const timer=setTimeout(()=>fail(new Error("Processing is taking longer than expected. Retry to check this upload; it may still finish in the background.")),options.timeoutMs??120_000);
  options.signal.addEventListener("abort",abort,{once:true});
  if(options.signal.aborted)abort();
  return {result,start(){active=true;void check();},dispose(){fail(new Error("Processing check ended."));}};
}
