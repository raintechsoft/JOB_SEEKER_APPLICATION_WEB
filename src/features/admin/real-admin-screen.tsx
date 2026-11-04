"use client";
import { QueryFeedback } from "@/components/ui/query-view";
import {useRef,useState} from "react";
import {EditorUpdateNotice} from "@/components/ui/editor-update-notice";
import type {components} from "@/types/generated/api";
import type {AdminPage} from "./admin-screen";
import {useServiceQuery,useServices} from "@/hooks/use-services";
import {useFormAction} from "@/hooks/use-form-action";
import {administrativeActionSchema,verificationReviewSchema} from "@/lib/validation/communication";
import {deliveryRetrySchema,reportDecisionSchema} from "@/services/admin/admin.http";
import {Button,EmptyState,PageHeading} from "@/components/ui/primitives";
import {TextAreaField,SelectField} from "@/components/ui/field";
import {downloadBlob} from "@/lib/utils/files";
import {RecommendationQuality} from "./recommendation-quality";
import type {AdminOverview} from "@/services/admin/admin.service";

/** People-facing labels for reviewed actions and delivery states; unknown codes fall back to sentence case. */
const LABELS:Record<string,string>={
 hide_profile:"Hide profile",restore_profile:"Restore profile",suspend:"Suspend account",restore:"Restore account",
 verified:"Mark as verified",action_required:"Ask for more information",
 review:"Mark as reviewed",dismiss:"Dismiss report",remove_content:"Remove content",retry:"Retry delivery",
 pending:"Pending",processing:"Processing",accepted:"Accepted",delivered:"Delivered",failed:"Failed",skipped:"Skipped",waiting_configuration:"Waiting for configuration",
 active:"Active",suspended:"Suspended",email:"Email",sms:"SMS",
};
/** Sentence case for an internal code such as "last_error_code" or "registrationNumber". */
export function humanize(code:string){const words=code.replace(/([a-z0-9])([A-Z])/g,"$1 $2").replace(/[_.-]+/g," ").trim().toLowerCase();return words.charAt(0).toUpperCase()+words.slice(1);}
const label=(code:string)=>LABELS[code]??humanize(code);
const OVERVIEW:[keyof AdminOverview,string][]=[["professionals","Professionals"],["companies","Companies"],["pendingVerification","Pending verification"],["reportedContent","Reported content"]];

function EvidenceDownload({id,name}:{id:string;name:string}){const services=useServices();const [errors,setErrors]=useState<Record<string,string>>({});const {execute,pending}=useFormAction(setErrors);return <div><Button loading={pending} disabled={pending} onClick={async()=>{let file:Blob|undefined;if(!await execute(async()=>{file=await services.admin.downloadEvidence!(id);}))return;if(file)downloadBlob(name,file);}}>Download {name} to review</Button>{errors._form&&<p role="alert" className="error">{errors._form}</p>}</div>;}

function ReviewForm({id,version,type,accountVersion}:{id:string;version:number;type:"professional"|"verification"|"report"|"delivery";accountVersion?:number}){
 const [base,setBase]=useState({version,accountVersion});const ref=useRef<HTMLFormElement>(null);const changed=base.version!==version||base.accountVersion!==accountVersion;
 const [errors,setErrors]=useState<Record<string,string>>({});const {execute,pending}=useFormAction(setErrors);
 const actions=type==="professional"?["hide_profile","restore_profile","suspend","restore"]:type==="verification"?["verified","action_required"]:type==="report"?["review","dismiss","remove_content"]:["retry"];
 return <form ref={ref} className="stack" noValidate onSubmit={async(e)=>{e.preventDefault();if(changed)return;const data=new FormData(e.currentTarget),action=String(data.get("action")||""),reason=String(data.get("reason")||"");const payload={id,version:type==="professional"&&["suspend","restore"].includes(action)?accountVersion:version,action,reason,decision:action,expectedAttempts:version};const parsed=(type==="professional"?administrativeActionSchema:type==="verification"?verificationReviewSchema:type==="report"?reportDecisionSchema:deliveryRetrySchema).safeParse(payload);if(!parsed.success){setErrors(Object.fromEntries(parsed.error.issues.map((i)=>[String(i.path[0]),i.message])));return;}setErrors({});await execute(async(s)=>{if(type==="professional"){const v=administrativeActionSchema.parse(payload);await s.admin.profileAction!(id,{version:v.version,action:v.action,reason:v.reason});}else if(type==="verification"){const v=verificationReviewSchema.parse(payload);await s.admin.reviewVerification!(id,{version:v.version,decision:v.decision,reason:v.reason});}else if(type==="report"){const v=reportDecisionSchema.parse(payload);await s.admin.reviewReport!(id,{version:v.version,action:v.action,reason:v.reason});}else await s.admin.retryDelivery!(id,version,reason);});}}>
  <EditorUpdateNotice changed={changed} reload={()=>{setBase({version,accountVersion});ref.current?.reset();setErrors({});}} />
  {errors._form&&<p role="alert" className="error">{errors._form}</p>}
  <SelectField required label="Reviewed action" name="action" options={actions.map((value)=>({value,label:label(value)}))} disabled={pending}/>
  <TextAreaField label="Review reason" name="reason" required minLength={10} maxLength={1500} error={errors.reason} disabled={pending}/>
  <Button type="submit" loading={pending} disabled={pending||changed}>Record reviewed action</Button>
 </form>;
}
function UserReviews(){const q=useServiceQuery(["admin","professionals"],(s)=>s.admin.getProfessionals!());return <div className="stack"><QueryFeedback data={q.data} error={q.isError} cause={q.error} retry={q.refetch} label="Loading accounts" />{q.data&&!q.data.length&&<EmptyState icon="users" title="No accounts to review" description="Professional accounts appear here once people sign up." />}{q.data?.map((p)=><article className="card stack" key={p.id}><h2>{p.name}</h2><p>{p.headline} · {p.public?"Public":"Hidden"} · {label(p.status)}</p><ReviewForm key={p.id} id={p.id} version={p.version} accountVersion={p.accountVersion} type="professional"/></article>)}</div>;}
function VerificationReviews(){const q=useServiceQuery(["admin","verifications"],(s)=>s.admin.verifications!());return <div className="stack"><QueryFeedback data={q.data} error={q.isError} cause={q.error} retry={q.refetch} label="Loading verification submissions" />{q.data&&!q.data.length&&<EmptyState icon="building" title="No pending submissions" description="Company verification requests appear here when organizations submit them." />}{q.data?.map((v)=><article className="card stack" key={v.id}><h2>{v.name}</h2><dl>{Object.entries(v.details).map(([key,value])=><div key={key}><dt>{humanize(key)}</dt><dd>{String(value??"")}</dd></div>)}</dl>{v.documents.map((d)=><EvidenceDownload id={d.id} name={d.name} key={d.id}/>)}<ReviewForm id={v.id} version={v.version} type="verification"/></article>)}</div>;}
function ReportReviews(){const q=useServiceQuery(["admin","reports"],(s)=>s.admin.reports!());return <div className="stack"><QueryFeedback data={q.data} error={q.isError} cause={q.error} retry={q.refetch} label="Loading reports" />{q.data&&!q.data.length&&<EmptyState icon="flag" title="No open reports" description="Reported content appears here for review." />}{q.data?.map((r)=><article className="card stack" key={r.id}><h2>{r.reason}</h2><p>{r.details}</p><p className="small muted">Reported {humanize(r.targetKind).toLowerCase()}</p>{r.evidence&&<p>{String(r.evidence.body??r.evidence.title??"")}</p>}{Array.isArray(r.evidence?.attachments)&&r.evidence.attachments.map((item:unknown)=>{if(!item||typeof item!=="object"||!("id" in item)||!("name" in item)||typeof item.id!=="string"||typeof item.name!=="string")return null;return <EvidenceDownload id={item.id} name={item.name} key={item.id}/>;})}<ReviewForm id={r.id} version={r.version} type="report"/></article>)}</div>;}
function DeliveryOperations(){const q=useServiceQuery(["admin","deliveries"],(s)=>s.admin.deliveries!());return <div className="stack"><h2>Delivery operations</h2><QueryFeedback data={q.data} error={q.isError} cause={q.error} retry={q.refetch} compact label="Loading delivery state" />{q.data&&!q.data.length&&<EmptyState compact icon="send" title="No deliveries yet" description="Email and SMS deliveries appear here once they are queued." />}{q.data?.map((d)=><article className="card stack" key={d.id}><strong>{humanize(d.kind)} · {label(d.channel)}</strong><p>{label(d.state)} · {d.attempts} {d.attempts===1?"attempt":"attempts"}{d.last_error_code?" · Last error: "+humanize(d.last_error_code):""}</p>{["failed","waiting_configuration"].includes(d.state)&&<ReviewForm key={d.id} id={d.id} version={d.attempts} type="delivery"/>}</article>)}</div>;}
function Overview(){const q=useServiceQuery(["admin","overview"],(s)=>s.admin.getOverview());return <div className="card"><QueryFeedback data={q.data} error={q.isError} cause={q.error} retry={q.refetch} compact layout="stats" label="Loading platform overview" />{q.data&&<dl className="stack">{OVERVIEW.map(([key,name])=><div key={key} className="row between"><dt>{name}</dt><dd><strong>{q.data[key]}</strong></dd></div>)}</dl>}</div>;}
export function RealAdminScreen({page}:{page:AdminPage}){return <><PageHeading title="Platform administration" subtitle="Review submitted evidence, reports and delivery state. Actions require a recorded reason."/>{page==="quality"?<RecommendationQuality/>:page==="users"?<UserReviews/>:page==="companies"?<VerificationReviews/>:page==="moderation"?<ReportReviews/>:<><Overview/><DeliveryOperations/></>}</>;}
export type VerificationReviewItem=components["schemas"]["VerificationReviewItem"];
