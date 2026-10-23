import type {AuthSession} from "../auth/auth.service";
import type {HttpClient} from "../api/client";
import {analyticsBatchSchema,analyticsConsentSchema,analyticsEventSchema} from "@/lib/validation/analytics";
import {setAnalyticsAdapter} from "@/lib/analytics";

export interface AnalyticsSettings {available:boolean;granted:boolean;hasStoredConsent:boolean;policyVersion:string;policyUrl?:string;retentionDays:number;version:number}
export function createHttpAnalyticsService(http:HttpClient){
 let identity:string|null=null,epoch=0,timer:ReturnType<typeof setTimeout>|undefined;
 let pending:unknown[]=[];let flushing=false;let consent=false;
 const enabled=process.env.NEXT_PUBLIC_ANALYTICS_ENABLED==="true";
 const reset=()=>{epoch++;identity=null;consent=false;pending=[];if(timer)clearTimeout(timer);timer=undefined;setAnalyticsAdapter({track(){}});};
 async function flush(){
   if(flushing||!consent||!identity||!pending.length)return;
   const generation=epoch,actor=identity,events=pending.splice(0,20);const input=analyticsBatchSchema.safeParse({identityId:actor,events});if(!input.success)return;
   flushing=true;try{if(epoch===generation)await http.post("me/analytics/events",input.data);}catch{/* Optional telemetry never retries into a different account or interrupts a business action. */}finally{flushing=false;if(consent&&identity&&pending.length)schedule();}
 }
 function schedule(){if(timer)clearTimeout(timer);timer=setTimeout(()=>{timer=undefined;void flush();},500);}
 function install(){
  setAnalyticsAdapter({track(name,properties){if(!enabled||!consent||!identity)return;const value=analyticsEventSchema.safeParse({id:crypto.randomUUID(),name,schemaVersion:1,occurredAt:new Date().toISOString(),properties});if(!value.success)return;if(pending.length>=40)pending.shift();pending.push(value.data);schedule();}});
 }
 const getSettings=async()=> (await http.get<{data:AnalyticsSettings}>("me/analytics/settings")).data;
 return {
  reset,getSettings,
  async attach(session:AuthSession){reset();if(!enabled||!session.selected_identity_id)return;const generation=epoch;identity=session.selected_identity_id;try{const settings=await getSettings();if(generation!==epoch)return;consent=settings.available&&settings.granted;install();}catch{if(generation===epoch)reset();}},
  async setConsent(input:Parameters<typeof analyticsConsentSchema.parse>[0]){const value=analyticsConsentSchema.parse(input);const generation=epoch;const result=(await http.patch<{data:AnalyticsSettings}>("me/analytics/consent",value)).data;if(generation!==epoch)throw new Error("Account changed while saving analytics preference.");epoch++;pending=[];if(timer)clearTimeout(timer);consent=enabled&&result.available&&result.granted;install();return result;},
 };
}
