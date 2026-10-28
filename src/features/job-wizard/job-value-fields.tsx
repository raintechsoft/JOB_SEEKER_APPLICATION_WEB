"use client";

import { TextField, SelectField, TextAreaField } from "@/components/ui/field";
import { Button } from "@/components/ui/primitives";
import { EMPTY_NOTICE, JOB_V2_RULES, type CompensationV2, type DeadlineV2, type NoticeV2 } from "@/lib/validation/job-v2";

export function CompensationFields({ value: c, onChange, errors }: {value: CompensationV2; onChange: (c: CompensationV2) => void; errors: Record<string,string>}) {
  const set = (patch: Partial<CompensationV2>) => onChange({...c,...patch});
  const number = (label:string,key:"minAmount"|"maxAmount"|"variablePercent",required=true) => <TextField label={label} name={"compensation."+key} value={c[key] ?? ""} onChange={e=>set({[key]: e.target.value || null})} inputMode="decimal" required={required} maxLength={16} error={errors["compensation."+key]}/>;
  const numeric = ["fixed","range","up_to"].includes(c.format);
  return <div className="stack">
    <SelectField label="Compensation format" name="compensation.format" value={c.format} onChange={e=>{const format=e.target.value;set({format,minAmount:null,maxAmount:null,period:["fixed","range","up_to"].includes(format)?c.period:null,scaleLabel:null,schedule:[],...(format==="unspecified"?{allowances:[],variableEnabled:false}: {})});}} options={[
      {value:"unspecified",label:"Not specified"},{value:"fixed",label:"Fixed amount"},{value:"range",label:"Amount range"},{value:"up_to",label:"Up to an amount"},{value:"pay_scale",label:"Pay scale / level"},{value:"schedule",label:"Progression schedule"}
    ]} error={errors["compensation.format"]} required/>
    {c.format!=="unspecified" && <>
      <div className="grid cols2">
        <SelectField label="Compensation type" name="compensation.kind" value={c.kind??""} options={[{value:"",label:"Choose a type"},...JOB_V2_RULES.compensationKinds.map(value=>({value,label:value.charAt(0).toUpperCase()+value.slice(1)}))]} onChange={e=>set({kind:e.target.value||null})} error={errors["compensation.kind"]} required/>
        <SelectField label="Currency" name="compensation.currency" value={c.currency??""} options={[{value:"",label:"Choose a currency"},...JOB_V2_RULES.currencies]} onChange={e=>set({currency:e.target.value||null})} error={errors["compensation.currency"]} required/>
      </div>
      {numeric && <><SelectField label="Payment period" name="compensation.period" value={c.period??""} onChange={e=>set({period:e.target.value||null})} options={[{value:"",label:"Choose a period"},...JOB_V2_RULES.compensationPeriods.map(value=>({value,label:"Per "+value}))]} error={errors["compensation.period"]} required/><div className="grid cols2">
        {c.format!=="up_to"&&number(c.format==="fixed"?"Amount":"Minimum amount","minAmount")}
        {c.format!=="fixed"&&number("Maximum amount","maxAmount")}
      </div><p className="small muted">Enter full currency amounts for the selected period.</p></>}
      {c.format==="pay_scale"&&<TextField label="Pay scale / level" name="compensation.scaleLabel" value={c.scaleLabel??""} maxLength={200} required onChange={e=>set({scaleLabel:e.target.value||null})} error={errors["compensation.scaleLabel"]}/>}
      {c.format==="schedule"&&<div className="stack">{c.schedule.map((s,i)=>{const patch=(p:Partial<typeof s>)=>set({schedule:c.schedule.map((x,n)=>n===i?{...x,...p}:x)});return <fieldset className="wizard-question" key={i}><legend>Pay stage {i+1}</legend>
        <TextField label="Stage name" name={`compensation.schedule.${i}.label`} value={s.label} maxLength={100} required onChange={e=>patch({label:e.target.value})}/>
        <div className="grid cols2"><TextField label="Start month" type="number" min={1} max={600} value={s.startMonth} required onChange={e=>patch({startMonth:Number(e.target.value)})}/><TextField label="End month" type="number" min={1} max={600} value={s.endMonth??""} onChange={e=>patch({endMonth:e.target.value?Number(e.target.value):null})}/>
        <TextField label="Stage amount" inputMode="decimal" value={s.amount??""} required maxLength={16} onChange={e=>patch({amount:e.target.value||null})}/><SelectField label="Stage payment period" value={s.period??""} required options={[{value:"",label:"Choose a period"},...JOB_V2_RULES.compensationPeriods]} onChange={e=>patch({period:e.target.value||null})}/></div>
        <Button onClick={()=>set({schedule:c.schedule.filter((_,n)=>n!==i)})}>Remove stage</Button>
      </fieldset>;})}{c.schedule.length<10&&<Button onClick={()=>set({schedule:[...c.schedule,{label:"",startMonth:(c.schedule.at(-1)?.endMonth??0)+1,endMonth:null,amount:null,period:null}]})}>Add pay stage</Button>}</div>}
      <label className="wizard-check"><input type="checkbox" checked={c.variableEnabled} onChange={e=>set({variableEnabled:e.target.checked})}/>Include variable pay</label>
      {c.variableEnabled&&number("Variable component (%)","variablePercent")}
      <div className="stack">{c.allowances.map((a,i)=>{const patch=(p:Partial<typeof a>)=>set({allowances:c.allowances.map((x,n)=>n===i?{...x,...p}:x)});return <fieldset className="wizard-question" key={i}><legend>Allowance {i+1}</legend><TextField label="Allowance name" value={a.label} required maxLength={100} onChange={e=>patch({label:e.target.value})}/><SelectField label="Allowance basis" value={a.percent!==null?"percent":"amount"} options={[{value:"amount",label:"Amount"},{value:"percent",label:"Percentage"}]} onChange={e=>patch(e.target.value==="percent"?{amount:null,percent:""}:{amount:"",percent:null})}/><TextField label={a.percent!==null?"Percentage":"Allowance amount"} inputMode="decimal" maxLength={16} required value={a.percent??a.amount??""} onChange={e=>patch(a.percent!==null?{percent:e.target.value}:{amount:e.target.value})}/><Button onClick={()=>set({allowances:c.allowances.filter((_,n)=>n!==i)})}>Remove allowance</Button></fieldset>;})}
      {c.allowances.length<10&&<Button onClick={()=>set({allowances:[...c.allowances,{label:"",amount:null,percent:null}]})}>Add allowance</Button>}</div>
      <TextAreaField label="Compensation details" value={c.notes} maxLength={1000} onChange={e=>set({notes:e.target.value})} error={errors["compensation.notes"]}/>
    </>}
    <label className="wizard-check"><input name="compensation.hidden" type="checkbox" checked={c.hidden} onChange={e=>set({hidden:e.target.checked})}/>Keep compensation details private</label>
  </div>;
}

/** The shared allowlist, so a selected zone is always one Laravel and PostgreSQL accept. */
const TIMEZONE_OPTIONS = JOB_V2_RULES.timezones.map(zone => ({ value: zone, label: zone.replaceAll("_", " ") }));

export function DeadlineFields({value:d,onChange,errors}:{value:DeadlineV2;onChange:(d:DeadlineV2)=>void;errors:Record<string,string>}) {
  const set=(p:Partial<NonNullable<DeadlineV2>>)=>onChange({...{date:"",time:null,timezone:"Asia/Kolkata",offset:null},...d,...p});
  return <div className="grid cols2">
    <TextField label="Closing date" name="deadline.date" type="date" value={d?.date??""} onChange={e=>e.target.value?set({date:e.target.value,offset:null}):onChange(null)} error={errors.deadline||errors["deadline.date"]}/>
    <TextField label="Closing time" name="deadline.time" type="time" value={d?.time??""} disabled={!d} onChange={e=>set({time:e.target.value||null,offset:null})} error={errors["deadline.time"]}/>
    {d&&<><SelectField label="Closing timezone" name="deadline.timezone" value={d.timezone} required onChange={e=>set({timezone:e.target.value,offset:null})} options={TIMEZONE_OPTIONS} error={errors["deadline.timezone"]}/>
    {d.time&&<TextField label="UTC offset for ambiguous time" name="deadline.offset" placeholder="+05:30" value={d.offset??""} maxLength={6} onChange={e=>set({offset:e.target.value||null})} error={errors["deadline.offset"]}/>}</>}
  </div>;
}

/** Recruitment-notice details from the official advertisement. Shown to candidates as information only. */
export function NoticeFields({value,onChange,errors}:{value:NoticeV2|undefined;onChange:(n:NoticeV2)=>void;errors:Record<string,string>}) {
  const n=value??{...EMPTY_NOTICE};
  const set=(p:Partial<NoticeV2>)=>onChange({...n,...p});
  const L=JOB_V2_RULES.notice;
  return <div className="stack">
    <h3>Recruitment notice details</h3>
    <p className="wizard-help">Copy these from the official notification. Candidates see them as information; Skillora never uses them to accept or reject applications.</p>
    <div className="grid cols2">
      <TextField label="Applications open on" name="notice.opensOn" type="date" value={n.opensOn??""} onChange={e=>set({opensOn:e.target.value||null})} error={errors["notice.opensOn"]}/>
      <TextField label="Age limit" name="notice.ageLimit" value={n.ageLimit} onChange={e=>set({ageLimit:e.target.value})} maxLength={L.ageLimit} hint="For example: 18–32 years; relaxation as per rules" error={errors["notice.ageLimit"]}/>
      <TextField label="Application fee" name="notice.applicationFee" value={n.applicationFee} onChange={e=>set({applicationFee:e.target.value})} maxLength={L.applicationFee} hint="For example: ₹500 general; exempt for SC/ST" error={errors["notice.applicationFee"]}/>
      <TextField label="Official notification link" name="notice.noticeUrl" type="url" inputMode="url" value={n.noticeUrl} onChange={e=>set({noticeUrl:e.target.value})} maxLength={L.noticeUrl} error={errors["notice.noticeUrl"]}/>
    </div>
    <TextAreaField label="Selection process" name="notice.selectionProcess" value={n.selectionProcess} onChange={e=>set({selectionProcess:e.target.value})} maxLength={L.selectionProcess} error={errors["notice.selectionProcess"]}/>
    <TextAreaField label="Documents required" name="notice.documents" value={n.documents} onChange={e=>set({documents:e.target.value})} maxLength={L.documents} error={errors["notice.documents"]}/>
  </div>;
}