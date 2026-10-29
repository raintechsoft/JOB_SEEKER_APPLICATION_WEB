"use client";

import {useEffect,useRef,useState} from "react";
import {useForm,useWatch,type Path} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {useServices} from "@/hooks/use-services";
import {ApiError,errorMessage,fieldErrors} from "@/services/api/client";
import {APPLICATION_WIZARD_RULES,applicationWizardDraftValuesSchema,applicationWizardStageSchema,type ApplicationStep,type ApplicationWizardValues} from "@/lib/validation/application-wizard";
import {applicationSteps} from "@/lib/domain/application-wizard";
import {applicationStage,applicationValidationContext,type ApplicationContext,type ApplicationDraft,type DocumentContext,type ApplicationReview} from "./application-wizard-policy";
import type {ApplicationWizardSubmit} from "@/services/applications/application-wizard.service";
import {useQuery,useQueryClient} from "@tanstack/react-query";

const fingerprint = (values:unknown) => {
  const checked=applicationWizardDraftValuesSchema.safeParse(values);
  return JSON.stringify(checked.success?checked.data:values);
};
const copy = <T,>(value:T):T => structuredClone(value);

export function useApplicationEditor(initial:{context:ApplicationContext;draft:ApplicationDraft;documents:DocumentContext;accountEmail:string;requested:string|null}) {
  const {applicationWizard:api,applicationDocuments:files}=useServices();
  const cache=useQueryClient();
  const [context,setContext]=useState(initial.context);
  const [documents,setDocuments]=useState(initial.documents);
  const [draft,setDraft]=useState(initial.draft);
  const [step,setStep]=useState<ApplicationStep>(()=>applicationStage(initial.context,initial.draft,initial.requested));
  const defaultValues=copy(initial.draft.values);
  if(!defaultValues.contact.phone&&initial.context.profilePhone)defaultValues.contact.phone=copy(initial.context.profilePhone);
  const form=useForm<ApplicationWizardValues>({defaultValues,resolver:zodResolver(applicationWizardDraftValuesSchema),mode:"onBlur"});
  const watched=useWatch({control:form.control});
  const [acknowledged,setAcknowledged]=useState(()=>fingerprint(initial.draft.values));
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [saving,setSaving]=useState(false);
  const [working,setWorking]=useState(false);
  const [blocked,setBlocked]=useState(false);
  const [sessionExpired,setSessionExpired]=useState(false);
  const [notice,setNotice]=useState("");
  const [resetKey,setResetKey]=useState(0);
  const [sharingAcknowledgement,setSharingAcknowledgement]=useState<{key:string;value:boolean}|null>(null);
  const [submissionUncertain,setSubmissionUncertain]=useState(false);
  const [reviewAttempt,setReviewAttempt]=useState(0);
  const pendingSubmission=useRef<{command:ApplicationWizardSubmit;values:ApplicationWizardValues;context:ReturnType<typeof applicationValidationContext>}|null>(null);
  const submissionKey=useRef<string|null>(null);
  const saved=useRef(initial.draft);
  const contextRef=useRef(initial.context);
  const documentsRef=useRef(initial.documents);
  const inFlight=useRef<Promise<boolean>|null>(null);
  const manual=useRef(false);
  const stopped=useRef(false);
  const failed=useRef<string|null>(null);
  const mounted=useRef(true);
  const latestStep=useRef(step);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{latestStep.current=step;},[step]);
  const validation=applicationValidationContext(context,documents,initial.accountEmail);
  const dirty=fingerprint(watched)!==acknowledged;
  const steps=applicationSteps(context.requirements);
  const changed=context.requirements.version!==draft.requirementsVersion||context.requirements.questionsVersion!==draft.questionsVersion||context.requirements.jobVersion!==draft.jobVersion;
  const retiredQuestions=Object.keys(watched.answers??{}).some(id=>!context.requirements.questions.some(question=>question.id===id));
  // Changed requirements are adopted silently: answers to retired questions are dropped and new ones are validated on their step.
  useEffect(()=>{
    if(!retiredQuestions)return;
    const current=context.requirements.questions;
    form.setValue("answers",Object.fromEntries(current.map(q=>[q.id,form.getValues().answers[q.id]??""])),{shouldDirty:true});
  },[retiredQuestions,context.requirements.questions,form]);

  function report(messages:Record<string,string>) {
    if(!mounted.current)return;
    setErrors(messages);
    form.clearErrors();
    for(const [name,message] of Object.entries(messages))if(!name.startsWith("_"))form.setError(name as Path<ApplicationWizardValues>,{type:"manual",message});
    const first=Object.keys(messages).find(name=>!name.startsWith("_"));
    const invalidStep=first?.startsWith("contact.")?"contact":first?.startsWith("documents.")?"documents":first?.startsWith("details.")?"details":first?.startsWith("answers.")?"questions":null;
    if(invalidStep&&steps.indexOf(invalidStep)>=0&&steps.indexOf(invalidStep)<=steps.indexOf(saved.current.reachedStep))setStep(invalidStep);
    requestAnimationFrame(()=>{
      document.querySelector<HTMLElement>(".application-wizard-errors")?.focus();
      if(first){
        const name=first==="contact.phone"?"contact.phone.nationalNumber":first==="details.expectedCompensation"?"details.expectedCompensation.currency":first;
        form.setFocus(name as Path<ApplicationWizardValues>);
        Array.from(document.querySelectorAll<HTMLElement>(".application-stage [name]")).find(element=>element.getAttribute("name")===name)?.focus();
        if(name.startsWith("documents."))document.querySelector<HTMLElement>(name==="documents.includePortfolio"?'.application-stage input[name="documents.includePortfolio"]':".application-stage input[type=file]")?.focus();
      }
    });
  }

  function reject(error:unknown) {
    if(!mounted.current)return;
    const fields=Object.fromEntries(Object.entries(fieldErrors(error)).map(([key,messages])=>[key.replace(/^values\./,""),messages[0]]));
    report({...fields,_form:errorMessage(error)});
    if(error instanceof ApiError&&error.status===401)setSessionExpired(true);
    if(!(error instanceof ApiError)||error.status!==422){stopped.current=true;setBlocked(true);}
  }

  const reviewEnabled=step==="review"&&!context.application&&context.acceptingApplications&&!dirty&&!saving&&!working&&!blocked;
  const reviewQuery=useQuery<ApplicationReview>({queryKey:["application-review",draft.id,draft.version,resetKey,reviewAttempt],enabled:reviewEnabled,retry:false,staleTime:0,refetchOnWindowFocus:false,placeholderData:()=>undefined,queryFn:async()=>{
    try{const result=await api.review(saved.current.id);if(mounted.current&&saved.current.version===result.version)setErrors({});return result;}catch(error){reject(error);throw error;}
  }});
  const currentReview=reviewQuery.data;
  const review=reviewEnabled&&!reviewQuery.isPlaceholderData&&!reviewQuery.isFetching&&currentReview?.draftId===draft.id&&currentReview.version===draft.version?currentReview:null;
  const reviewLoading=reviewEnabled&&(reviewQuery.isPending||reviewQuery.isFetching);
  const reviewKey=review?`${review.version}:${review.reviewHash}:${resetKey}:${reviewAttempt}`:"";
  const acknowledgedSharing=!!review&&sharingAcknowledgement?.key===reviewKey&&sharingAcknowledgement.value;
  const setAcknowledgedSharing=(value:boolean)=>setSharingAcknowledgement({key:reviewKey,value});

  async function refresh() {
    const [next,docs]=await Promise.all([api.context(initial.context.jobId),files.context(saved.current.id)]);
    if(!mounted.current)return;
    contextRef.current=next;documentsRef.current=docs;
    setContext(next);setDocuments(docs);
  }

  async function persist(intent:"save"|"advance",target:ApplicationStep,override?:ApplicationWizardValues,quiet=false):Promise<boolean> {
    if(inFlight.current){if(quiet)return false;await inFlight.current;}
    if(stopped.current||!mounted.current)return false;
    const base=copy(form.getValues()), raw=override??base;
    const checked=applicationWizardDraftValuesSchema.safeParse(raw);
    if(!checked.success){if(!quiet)report(Object.fromEntries(checked.error.issues.map(issue=>[issue.path.join(".")||"_form",issue.message])));return false;}
    const ctx=applicationValidationContext(contextRef.current,documentsRef.current,initial.accountEmail);
    if(intent==="advance"){
      const stage=applicationWizardStageSchema(ctx,target).safeParse(checked.data);
      if(!stage.success){if(!quiet)report(Object.fromEntries(stage.error.issues.map(issue=>[issue.path.join(".")||"_form",issue.message])));return false;}
    }
    const task=(async()=>{
      setSaving(true);
      try{
        const revision=saved.current;
        const result=await api.save(revision.id,{schemaVersion:2,version:revision.version,requirementsVersion:ctx.requirements.version,questionsVersion:ctx.requirements.questionsVersion,jobVersion:ctx.requirements.jobVersion,step:target,intent,values:checked.data},ctx);
        if(!mounted.current)return false;
        saved.current=result;setDraft(result);setAcknowledged(fingerprint(result.values));failed.current=null;
        if(!quiet){setErrors({});form.clearErrors();}
        if(fingerprint(form.getValues())===fingerprint(base))form.reset(copy(result.values));
        if(!quiet||applicationSteps(contextRef.current.requirements).indexOf(latestStep.current)>applicationSteps(contextRef.current.requirements).indexOf(result.reachedStep))setStep(result.step);
        try{await refresh();}
        catch{stopped.current=true;setBlocked(true);report({_form:"Your draft was saved, but its latest details could not be refreshed. Reload the saved draft before continuing."});return false;}
        return true;
      }catch(error){
        if(!mounted.current)return false;
        failed.current=fingerprint(raw);
        reject(error);
        return false;
      }finally{if(mounted.current)setSaving(false);}
    })();
    inFlight.current=task;
    try{return await task;}finally{if(inFlight.current===task)inFlight.current=null;}
  }

  useEffect(()=>{
    if(!dirty||blocked||working||saving||failed.current===fingerprint(watched)||!applicationWizardDraftValuesSchema.safeParse(watched).success)return;
    const timer=setTimeout(()=>{void persist("save",latestStep.current,undefined,true);},1000);
    return()=>clearTimeout(timer);
    // The captured form values/context are read through RHF and refs when the timer runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[watched,dirty,blocked,working,saving]);

  async function action(work:()=>Promise<boolean>) {
    if(manual.current)return false;
    manual.current=true;setWorking(true);
    try{return await work();}finally{manual.current=false;if(mounted.current)setWorking(false);}
  }
  const save=()=>action(()=>persist("save",latestStep.current));
  const next=()=>action(()=>persist(step==="review"?"save":"advance",step));
  async function submit() {
    if(!review||!acknowledgedSharing||dirty||blocked||submissionUncertain){report({_form:"Review the saved application and acknowledge sharing before submitting."});return false;}
    const checked=applicationWizardStageSchema(validation,"review").safeParse(form.getValues());
    if(!checked.success){report(Object.fromEntries(checked.error.issues.map(issue=>[issue.path.join(".")||"_form",issue.message])));return false;}
    submissionKey.current??=crypto.randomUUID();
    const {draftId,version,requirementsVersion,questionsVersion,jobVersion,reviewHash}=review;
    pendingSubmission.current={command:{schemaVersion:2,draftId,version,requirementsVersion,questionsVersion,jobVersion,reviewHash,idempotencyKey:submissionKey.current,acknowledgementVersion:APPLICATION_WIZARD_RULES.acknowledgementVersion,sharingAcknowledged:true},values:checked.data,context:{...validation,reviewHash}};
    return action(sendSubmission);
  }
  async function sendSubmission() {
    const pending=pendingSubmission.current;if(!pending)return false;
    try {
      const receipt=await api.submit(initial.context.jobId,pending.command,pending.values,pending.context);
      setContext(current=>({...current,application:receipt,draft:null,acceptingApplications:false}));setSubmissionUncertain(false);
      void cache.invalidateQueries();return true;
    }catch(error){
      const uncertain=!(error instanceof ApiError)||error.status>=500||error.status===0;
      setSubmissionUncertain(uncertain);reject(error);
      if(uncertain)report({_form:"The submission response was not confirmed. Check for your receipt before retrying. Your saved draft is preserved."});
      return false;
    }
  }
  async function checkSubmission() {
    return action(async()=>{
      try {
        const current=await api.context(initial.context.jobId);
        if(current.application){setContext(current);setSubmissionUncertain(false);void cache.invalidateQueries();return true;}
        report({_form:"No completed application was found yet. You can check again or retry the same submission safely."});return false;
      }catch(error){report({_form:errorMessage(error)});return false;}
    });
  }
  const retrySubmission=()=>action(sendSubmission);
  function validateLocal() {
    const checked=applicationWizardDraftValuesSchema.safeParse(form.getValues());
    if(checked.success)return true;
    report(Object.fromEntries(checked.error.issues.map(issue=>[issue.path.join(".")||"_form",issue.message])));return false;
  }
  function discardLocal() {
    form.reset(copy(saved.current.values));setAcknowledged(fingerprint(saved.current.values));setErrors({});setResetKey(key=>key+1);
  }
  async function selectDocument(kind:"resume"|"portfolio",value:string|null|boolean) {
    const values=copy(form.getValues());
    if(kind==="resume")values.documents.resumeAssetId=value as string|null;
    else values.documents.includePortfolio=!!value;
    if(!await action(()=>persist("save",latestStep.current,values)))throw new Error("The document selection was not saved. Check the highlighted fields or reload the saved draft.");
  }
  async function visit(target:ApplicationStep) {
    if(submissionUncertain)return;
    setSharingAcknowledgement(null);
    const targetIndex=steps.indexOf(target),currentIndex=steps.indexOf(step);
    if(targetIndex<0||targetIndex>steps.indexOf(draft.reachedStep)||working)return;
    if(targetIndex<=currentIndex){setStep(target);setErrors({});return;}
    const checked=applicationWizardStageSchema(validation,steps[targetIndex-1]).safeParse(form.getValues());
    if(!checked.success){report(Object.fromEntries(checked.error.issues.map(issue=>[issue.path.join(".")||"_form",issue.message])));return;}
    await action(()=>persist("save",target));
  }
  async function reload() {
    await action(async()=>{
      try{
        const fresh=await api.context(initial.context.jobId);
        if(!fresh.draft){setContext(fresh);setNotice(fresh.application?"":"This draft is no longer available. Return to the job to start a new draft.");return false;}
        const docs=await files.context(fresh.draft.id);
        contextRef.current=fresh;documentsRef.current=docs;saved.current=fresh.draft;
        setContext(fresh);setDocuments(docs);setDraft(fresh.draft);form.reset(copy(fresh.draft.values));setAcknowledged(fingerprint(fresh.draft.values));setStep(applicationStage(fresh,fresh.draft));
        stopped.current=false;failed.current=null;setBlocked(false);setSessionExpired(false);setErrors({});setResetKey(key=>key+1);setNotice("");pendingSubmission.current=null;submissionKey.current=null;setSubmissionUncertain(false);return true;
      }catch(error){report({_form:errorMessage(error)});return false;}
    });
  }
  const contactService={
    async challenge(id:string,input:unknown){if(!await save())throw new Error("Save the current contact details before requesting a code.");return api.challenge(id,input);},
    verify:api.verify,
  };
  return {form,watched,context,documents,draft,step,setStep,steps,validation,dirty,saving,working,blocked,sessionExpired,errors,notice,resetKey,changed,retiredQuestions,report,save,next,visit,reload,refresh,selectDocument,contactService,discardLocal,validateLocal,review,reviewLoading,acknowledgedSharing,setAcknowledgedSharing,submit,submissionUncertain,checkSubmission,retrySubmission,reloadReview:()=>setReviewAttempt(n=>n+1)};
}
