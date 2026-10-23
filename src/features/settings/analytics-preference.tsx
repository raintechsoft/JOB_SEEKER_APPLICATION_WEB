"use client";
import {useState} from "react";
import {useServiceQuery,useServices} from "@/hooks/use-services";
import {analyticsConsentSchema} from "@/lib/validation/analytics";
import {Button} from "@/components/ui/primitives";
import {QueryFeedback} from "@/components/ui/query-view";
import {errorMessage} from "@/services/api/client";

export function AnalyticsPreference(){
 const services=useServices(),query=useServiceQuery(["analytics-preference"],s=>s.analytics.getSettings(),{keepPreviousData:false});
 const [pending,setPending]=useState(false),[error,setError]=useState("");
 const settings=query.data;
 const save=async(granted:boolean)=>{if(pending||!settings)return;const input=analyticsConsentSchema.safeParse({granted,policyVersion:settings.policyVersion,version:settings.version});if(!input.success){setError(input.error.issues[0].message);return;}setPending(true);setError("");try{await services.analytics.setConsent(input.data);await query.refetch();}catch(e){setError(errorMessage(e));}finally{setPending(false);}};
 return <section className="card form-card"><h2>Optional product analytics</h2><p>Help improve Skillora with coarse interaction events. We exclude names, contact details, messages, application answers and search text.</p>{settings?.policyUrl?.startsWith("https://")&&<p><a href={settings.policyUrl}>Read the analytics privacy policy</a></p>}{!settings?<QueryFeedback data={settings} error={query.isError} retry={query.refetch} layout="form" label="Loading analytics preferences" />:<><p>{settings.granted?"You have opted in.":"You have not opted in."} {settings.available?`Local event retention: ${settings.retentionDays} days. Policy: ${settings.policyVersion}.`:"Collection is disabled or awaiting configuration."}</p>{settings.hasStoredConsent?<Button loading={pending} disabled={pending} onClick={()=>void save(false)}>Withdraw analytics consent and erase local events</Button>:settings.available?<form onSubmit={e=>{e.preventDefault();if(!new FormData(e.currentTarget).has("consent")){setError("Choose the consent checkbox before opting in.");return;}void save(true);}}><label className="check-row"><input type="checkbox" name="consent" required disabled={pending}/>I agree to optional product analytics under the displayed policy.</label><Button type="submit" loading={pending} disabled={pending}>Opt in to analytics</Button></form>:null}</>}{error&&<p role="alert">{error}</p>}</section>;
}
