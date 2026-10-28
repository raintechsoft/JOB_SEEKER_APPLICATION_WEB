"use client";
import { ContentSkeleton } from "@/components/ui/skeleton";

import {useState} from "react";
import {useServiceQuery} from "@/hooks/use-services";
import {useJobActions} from "@/features/feed/job-dialogs";
import {Button,EmptyState,LinkButton,PageHeading,Tags} from "@/components/ui/primitives";
import {TextField,SelectField} from "@/components/ui/field";
import {jobSearchSchema,type JobSearchInput} from "@/lib/validation/search";
import {validationFields} from "@/lib/validation/profile";
import {useOpenJob} from "@/hooks/use-open-job";
import searchRules from "../../../../../contracts/validation/search.json";
import {InfoBadge} from "@/components/ui/info-badge";

export function PublicJobScreen({id}:{id:string}){
  const {data,isPending,isError}=useServiceQuery(["job",id,"professional"],(s)=>s.jobs.getJob(id,"professional"),{keepPreviousData:false});
  const actions=useJobActions();
  const open=useOpenJob(data?.job);
  if(isPending)return <main id="main" className="stack"><ContentSkeleton layout="profile" label="Loading opportunity" /></main>;
  if(isError||!data)return <main id="main"><EmptyState title="Opportunity unavailable" description="This job is no longer available. Please try again or browse other opportunities." action={<LinkButton href="/app/jobs">Browse jobs</LinkButton>}/></main>;
  const {job,company}=data;
  return <main id="main" className="stack" style={{maxWidth:900,margin:"40px auto",padding:24}}><PageHeading title={job.title} subtitle={`${company.name} · ${job.location} · ${job.arrangement} · ${job.employment}`}/><section className="card stack" style={{padding:24}}><p>{job.salary}</p><Tags items={job.skills}/><p style={{whiteSpace:"pre-line"}}>{job.description}</p><h2>Responsibilities</h2><ul>{job.responsibilities.map((r,i)=><li key={i}>{r}</li>)}</ul><h2>Requirements</h2><p style={{whiteSpace:"pre-line"}}>{job.requirements}</p>{job.benefits&&<p style={{whiteSpace:"pre-line"}}>{job.benefits}</p>}<div className="row"><Button variant="primary" disabled={!open||!!data.application} onClick={()=>actions.apply(id)}>{data.application?"Already applied":open?"Apply for this job":"Applications closed"}</Button><Button icon="bookmark" onClick={()=>actions.toggleSave("professional",id,"job")}>{data.saved?"Unsave job":"Save job"}</Button></div></section><LinkButton href="/app/applications">Track applications</LinkButton></main>;
}

export function OpportunitiesScreen(){
  const [filters,setFilters]=useState<JobSearchInput>({q:"",page:1}),[errors,setErrors]=useState<Record<string,string>>({});
  const {data,isPending,isError,refetch}=useServiceQuery(["job-opportunities",filters],(s)=>s.jobs.listOpportunities(filters),{keepPreviousData:false});
  const submit=(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();const form=e.currentTarget,values=new FormData(form);const input:Record<string,unknown>={q:String(values.get("q")??""),page:1};
    for(const key of ["location","skill","arrangement","employment","education","currency","compensationPeriod","sort"]){const value=String(values.get(key)??"").trim();if(value)input[key]=value;}
    for(const key of ["experience","salaryMin","salaryMax"]){const value=String(values.get(key)??"").trim();const control=form.elements.namedItem(key);if(control instanceof HTMLInputElement&&control.validity.badInput)input[key]=NaN;else if(value)input[key]=Number(value);}
    const checked=jobSearchSchema.safeParse(input);if(!checked.success){const fields=validationFields(checked.error);setErrors(fields);const field=form.elements.namedItem(Object.keys(fields)[0]);if(field instanceof HTMLElement)field.focus();return;}setErrors({});setFilters(checked.data);
  };
  return <><PageHeading title="Find your next opportunity" subtitle="Explore open roles from hiring teams."/>
    <form className="card stack" style={{padding:24,marginBottom:24}} noValidate onSubmit={submit}>
      <div className="row wrap"><TextField label="Job title" name="q" maxLength={200} error={errors.q}/><Button type="submit" loading={isPending} disabled={isPending}>{isPending?"Searching…":"Search"}</Button></div>
      <p className="small muted">Search words in the title, role, description and requirements.</p>
      <details><summary>More filters</summary><div className="grid cols2" style={{marginTop:16}}>
        <TextField label="Location" name="location" maxLength={200} error={errors.location}/><TextField label="Skill" name="skill" maxLength={100} error={errors.skill}/>
        <SelectField label="Work arrangement" name="arrangement" options={["",...searchRules.arrangements]} error={errors.arrangement}/><SelectField label="Employment type" name="employment" options={["",...searchRules.employment]} error={errors.employment}/>
        <SelectField label="Qualification" name="education" options={["",...searchRules.education]} error={errors.education}/>
        <TextField label="Years of experience" name="experience" type="number" min={0} max={60} step="0.1" error={errors.experience}/>
        <SelectField label="Currency" name="currency" options={["",...searchRules.currencies]} error={errors.currency}/>
        <SelectField label="Payment period" name="compensationPeriod" defaultValue="year" options={searchRules.compensationPeriods.map(value=>({value,label:`Per ${value}`}))} error={errors.compensationPeriod}/>
        <TextField label="Minimum pay" name="salaryMin" type="number" min={0} max={1e12} step="0.01" error={errors.salaryMin}/><TextField label="Maximum pay" name="salaryMax" type="number" min={0} max={1e12} step="0.01" error={errors.salaryMax}/>
        <SelectField label="Sort by" name="sort" defaultValue="newest" options={[{value:"newest",label:"Latest"},{value:"oldest",label:"Oldest"},{value:"salary_asc",label:"Compensation: low to high"},{value:"salary_desc",label:"Compensation: high to low"}]} error={errors.sort}/>
      </div><div className="row"><p className="small muted">Use full currency amounts for the selected payment period.</p><InfoBadge label="How compensation comparisons work">Numeric filters exclude private or unspecified compensation, pay scales and progression schedules. Sorting uses a fixed amount, the lower end of a range or an up-to ceiling, with unavailable comparisons last. An up-to ceiling is not a guaranteed starting amount.</InfoBadge></div></details>
      {Object.keys(errors).length>0&&<p role="alert">Correct the highlighted filters before searching.</p>}
    </form>
    {isPending?<ContentSkeleton layout="cards" label="Loading jobs" />:isError?<p role="alert">Jobs could not be loaded. <Button onClick={()=>void refetch()}>Try again</Button></p>:<div className="stack">{data?.items.map(({job,company})=><article className="card stack" key={job.id} style={{padding:24}}><h2>{job.title}</h2><p>{company.name} · {job.location} · {job.arrangement}</p><p>{job.salary}</p><Tags items={job.skills}/><LinkButton href={"/jobs/"+job.id} variant="primary">View opportunity</LinkButton></article>)}{!data?.items.length&&<EmptyState title="No open roles found" description="Try other words or filters, or check back later."/>}<div className="row"><Button disabled={filters.page===1} onClick={()=>setFilters({...filters,page:filters.page-1})}>Previous</Button><span>Page {filters.page}</span><Button disabled={filters.page*20>=(data?.total??0)||filters.page>=10000} onClick={()=>setFilters({...filters,page:filters.page+1})}>Next</Button></div></div>}
    <LinkButton href="/app/applications">Your applications</LinkButton></>;
}
