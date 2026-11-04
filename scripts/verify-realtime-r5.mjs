// Run from the repo root against the isolated synthetic harness on 3109/8109/8089.
import {chromium,expect as baseExpect} from '@playwright/test';
import fs from 'node:fs';
const expect=baseExpect.configure({timeout:25000}),base='http://localhost:3109',api='http://localhost:8109/api/v1';
const f=JSON.parse(fs.readFileSync('.runtime/r3-browser-fixture.json','utf8')),h=JSON.parse(fs.readFileSync('.runtime/r5-browser-fixture.json','utf8'));
const browser=await chromium.launch({headless:true}),contexts=[],results={},reads={},active={};
async function mutate(c,method,path,data){await c.request.get('http://localhost:8109/sanctum/csrf-cookie',{headers:{Origin:base,Accept:'application/json'}});const token=(await c.cookies('http://localhost:8109')).find(x=>x.name==='XSRF-TOKEN');const r=await c.request.fetch(api+'/'+path,{method,data,headers:{Origin:base,Accept:'application/json','X-XSRF-TOKEN':decodeURIComponent(token.value)}});expect(r.status(),`${method} ${path}: ${await r.text()}`).toBeLessThan(300);return r.status()===204?null:(await r.json()).data;}
async function read(c,path){const r=await c.request.get(api+'/'+path,{headers:{Origin:base,Accept:'application/json'}});expect(r.status(),path).toBe(200);return (await r.json()).data;}
async function context(account,employer=false){const c=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(c);await mutate(c,'POST',`auth/${employer?'employer':'professional'}/login`,{email:account.email,password:f.password});await mutate(c,'POST','me/workspace',{identity_id:account.identity});return c;}
async function page(c,name,path){const p=await c.newPage();reads[name]=0;active[name]=0;p.on('request',r=>{if(r.method()==='GET'&&/api\/v1\/(me\/(applications|saved-jobs|job-alerts|application-drafts)|organizations\/[^/]+\/hiring|jobs\/[^/]+\/application-context)/.test(r.url()))reads[name]++;});p.on('websocket',s=>{if(!s.url().includes(':8089/'))return;active[name]++;s.on('close',()=>active[name]--);});p.on('pageerror',e=>(results.pageErrors??=[]).push(e.message));await p.goto(base+path);await expect.poll(()=>active[name],{timeout:60000}).toBe(1);return p;}
const hiring=`organizations/${h.organization}/hiring`;
async function check(name,run){await run();results[name]=true;console.log('PASS '+name);}
try{
 const a=await context(f.applicant),b=await context(f.recruiter,true);
 const ap=await page(a,'applicant','/app/applications?tab=applied'),bp=await page(b,'recruiter',`/recruiter/applications?job=${h.job}&view=responses`);
 await expect(bp.locator('.response-status').first()).toBeVisible();
 await expect(ap.getByText(h.title,{exact:true})).toBeVisible();
 await check('recruiterStatusRefreshesApplicantRowsAndFilterCounts',async()=>{
  for(const [status,label] of [['Reviewing','In review'],['Shortlisted','Shortlisted'],['Interview','Interview']]){
   const item=await read(b,`${hiring}/responses/${h.application}`);await mutate(b,'POST',`${hiring}/responses/actions/status`,{ids:[h.application],versions:{[h.application]:item.application.version},status});
   await expect(ap.getByText(label,{exact:true}).first()).toBeVisible();
  }
  await expect(ap.getByRole('button',{name:/^Interview, 1 application$/})).toBeVisible();
  await ap.getByRole('button',{name:/^Interview, 1 application$/}).click();await expect(ap.getByText(h.title,{exact:true})).toBeVisible();
 });
 const sp=await page(a,'saved','/app/applications?tab=saved');await expect(sp.getByText(h.openTitle,{exact:true})).toBeVisible();
 await check('savedArchiveAndDeleteArriveFromAnotherTab',async()=>{
  await mutate(a,'PATCH','me/saved-jobs',{ids:[h.openJob],action:'archive'});await expect(sp.getByText(h.openTitle,{exact:true})).toHaveCount(0);
  await mutate(a,'PATCH','me/saved-jobs',{ids:[h.openJob],action:'restore'});await expect(sp.getByText(h.openTitle,{exact:true})).toBeVisible();
  await mutate(a,'DELETE','me/saved-jobs',{ids:[h.openJob]});await expect(sp.getByText(h.openTitle,{exact:true})).toHaveCount(0);
 });
 const alerts=await page(a,'alerts','/app/applications?tab=alerts');
 await check('alertCreateToggleDeleteArriveFromAnotherTab',async()=>{
  const name='R5 live alert '+Date.now();await mutate(a,'POST','me/job-alerts',{name,keywords:'engineering',location:'',arrangement:'Any',days:30,enabled:true});await expect(alerts.getByText(name,{exact:true})).toBeVisible();
  const alert=(await read(a,'me/job-alerts')).find(x=>x.name===name);await mutate(a,'POST',`me/job-alerts/${alert.id}/toggle`,{});await expect(alerts.getByText('Paused',{exact:true}).first()).toBeVisible();
  await mutate(a,'DELETE',`me/job-alerts/${alert.id}`);await expect(alerts.getByText(name,{exact:true})).toHaveCount(0);
 });
 const editor=await page(a,'editor',`/app/jobs/${h.openJob}/apply`);
 await expect(editor.getByRole('textbox',{name:/Name/})).toBeVisible({timeout:60000});
 await check('remoteDraftConflictRetainsInputAndRequiresExplicitReload',async()=>{
  const ctx=await read(a,`jobs/${h.openJob}/application-context`),d=ctx.draft;
  await editor.getByRole('textbox',{name:/Name/}).fill('R5 unsaved local input');
  d.values.contact.name='R5 remote saved name';await mutate(a,'PATCH',`me/application-drafts/${d.id}`,{schemaVersion:2,version:d.version,requirementsVersion:d.requirementsVersion,questionsVersion:d.questionsVersion,jobVersion:d.jobVersion,step:d.step,intent:'save',values:d.values});
  await expect(editor.getByText(/Your saved draft or the job requirements changed/)).toBeVisible();await expect(editor.getByRole('textbox',{name:/Name/})).toHaveValue('R5 unsaved local input');
  await editor.getByRole('button',{name:'Reload saved draft'}).click();await expect(editor.getByRole('textbox',{name:/Name/})).toHaveValue('R5 remote saved name');
 });
 await check('closingJobBlocksOpenEditorWithoutLosingInput',async()=>{
  const job=await read(b,`${hiring}/jobs/${h.openJob}`);await mutate(b,'POST',`${hiring}/jobs/actions/close`,{ids:[h.openJob],versions:{[h.openJob]:job.version}});
  await expect(editor.getByText('This job is no longer accepting applications. Your input is retained.')).toBeVisible();await expect(editor.getByRole('textbox',{name:/Name/})).toHaveValue('R5 remote saved name');await expect(editor.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
 });
 await check('withdrawalRemovesInterviewMembershipAndUpdatesRecruiter',async()=>{
  const app=await read(a,`me/applications/${h.application}`);await mutate(a,'POST',`me/applications/${h.application}/withdraw`,{version:app.version});
  await expect(ap.getByRole('button',{name:/^Interview, 0 applications$/})).toBeVisible();await expect(ap.getByText(h.title,{exact:true})).toHaveCount(0);await expect(bp.getByText('Withdrawn · Previously Interview',{exact:true}).first()).toBeVisible();
 });
 await check('idleHasNoBusinessPollingAndOneSocketPerTab',async()=>{
  await ap.waitForTimeout(2500);const before={...reads};await ap.waitForTimeout(65000);results.idleReads=Object.fromEntries(Object.keys(reads).map(k=>[k,reads[k]-before[k]]));expect(Object.values(results.idleReads)).toEqual(Object.values(reads).map(()=>0));expect(Object.values(active)).toEqual(Object.values(active).map(()=>1));
 });
 expect(results.pageErrors??[]).toEqual([]);
}catch(error){results.failure=String(error.stack??error);process.exitCode=1;console.error(results.failure);}
finally{fs.writeFileSync('.runtime/r5-browser-result.json',JSON.stringify(results,null,2));for(const c of contexts)await c.close();await browser.close();}
