// Synthetic records only; reuse the isolated R3 service harness (ports 3109/8109/8089).
import { chromium, expect as baseExpect } from '@playwright/test';
const expect=baseExpect.configure({timeout:20000});
import fs from 'node:fs';
const f=JSON.parse(fs.readFileSync('.runtime/r3-browser-fixture.json','utf8'));
const base='http://localhost:3109',api='http://localhost:8109/api/v1';
const browser=await chromium.launch({headless:true}),contexts=[],results={},sockets={},active={},reads={};
async function mutate(c,method,path,data){await c.request.get('http://localhost:8109/sanctum/csrf-cookie',{headers:{Origin:base,Accept:'application/json'}});const token=(await c.cookies('http://localhost:8109')).find(x=>x.name==='XSRF-TOKEN');const r=await c.request.fetch(api+'/'+path,{method,data,headers:{Origin:base,Accept:'application/json','X-XSRF-TOKEN':decodeURIComponent(token.value)}});expect(r.status(),`${method} ${path}: ${await r.text()}`).toBeLessThan(300);return r.status()===204?null:(await r.json()).data;}
async function context(account,employer=false){const c=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(c);if(account){await mutate(c,'POST',`auth/${employer?'employer':'professional'}/login`,{email:account.email,password:f.password});await mutate(c,'POST','me/workspace',{identity_id:account.identity});}return c;}
async function read(c,path){const r=await c.request.get(api+'/'+path,{headers:{Origin:base,Accept:'application/json'}});expect(r.status()).toBe(200);return (await r.json()).data;}
async function page(c,name,url){const p=await c.newPage();sockets[name]=0;active[name]=0;reads[name]=0;p.on('websocket',socket=>{if(!socket.url().includes(':8089/'))return;sockets[name]++;active[name]++;socket.on('close',()=>active[name]--);});p.on('request',r=>{if(r.method()==='GET'&&/api\/v1\/(public\/(feed|search)|me\/social\/)/.test(r.url()))reads[name]++;});p.on('pageerror',e=>{(results.pageErrors??=[]).push(e.message);});await p.goto(base+url);await expect(p.locator('.feed-post').first()).toBeVisible({timeout:60000});return p;}
async function check(name,run){if(process.argv.includes('--recovery-only')&&!/offline|Privacy|idle/.test(name))return;if(process.argv.includes('--network-only')&&name!=='sidebarFollowingCountUpdatesWithoutReload')return;await run();results[name]=true;console.log('PASS '+name);}
const ab=`me/social/${f.applicant.identity}`,bb=`me/social/${f.recruiter.identity}`;
let a,b,g,ap,bp,gp,target;
const publish=(title)=>mutate(a,'POST',ab+'/posts',{creationKey:crypto.randomUUID(),title,body:'Synthetic R4 browser content',project:'',attachments:[]});
try{
 a=await context(f.applicant);b=await context(f.recruiter,true);g=await context();
 const stamp=Date.now();for(let n=0;n<(process.argv.includes('--network-only')?1:15);n++)target=await publish(`R4 synthetic ${stamp} ${n}`);
 gp=await page(g,'guest','/');ap=await page(a,'professional','/app/dashboard');bp=await page(b,'recruiter','/recruiter/dashboard');
 gp.on('response',async r=>{if(r.url().includes('/api/v1/public/')&&r.status()>=400)(results.failedReads??=[]).push({path:new URL(r.url()).pathname,status:r.status(),body:await r.text().catch(()=>null)});});
 gp.on('requestfailed',r=>{if(r.url().includes('/api/v1/public/'))(results.failedReads??=[]).push({path:new URL(r.url()).pathname,error:r.failure()?.errorText});});
 await expect.poll(()=>active.guest).toBe(1);await expect.poll(()=>active.professional).toBe(1);await expect.poll(()=>active.recruiter).toBe(1);
 await check('newPostBannerPreservesLoadedTailAndOrder',async()=>{
   const count=await gp.locator('[data-public-entry]').count();await gp.getByRole('button',{name:'See more posts',exact:true}).click();await expect.poll(()=>gp.locator('[data-public-entry]').count()).toBeGreaterThan(count);await expect(gp.locator('#feed-post-list')).toHaveAttribute('aria-busy','false');
   const before=await gp.locator('[data-public-entry]').evaluateAll(nodes=>nodes.map(n=>n.dataset.publicEntry));
   await gp.evaluate(()=>window.scrollTo(0,700));
   const fresh=await publish('R4 new remote '+Date.now());
   for(const p of [gp,ap,bp])await expect(p.getByRole('button',{name:'New posts',exact:true})).toBeVisible({timeout:20000});
   await expect(gp.locator('#feed-'+fresh.id)).toHaveCount(0);
   expect(await gp.locator('[data-public-entry]').evaluateAll(nodes=>nodes.map(n=>n.dataset.publicEntry))).toEqual(before);
   await gp.getByRole('button',{name:'New posts',exact:true}).click();await expect(gp.locator('#feed-'+fresh.id)).toBeVisible();target=fresh;
   await bp.getByRole('button',{name:'New posts',exact:true}).click();await ap.getByRole('button',{name:'New posts',exact:true}).click();
 });
 await check('remoteLikesCommentsRepliesAndPinUpdateGuestAndMember',async()=>{
   await mutate(b,'PATCH',`${bb}/entries/${target.id}/liked`,{enabled:true});
   await expect(gp.locator(`#feed-${target.id} .feed-social-counts button`).first()).toHaveText('1',{timeout:15000});
   const comment=await mutate(b,'POST',`${bb}/entries/${target.id}/comments`,{text:'R4 live comment',creationKey:crypto.randomUUID()});
   await expect(gp.locator(`#feed-${target.id} .feed-social-counts`)).toContainText('1 comment',{timeout:15000});
   await gp.locator(`#feed-${target.id} .feed-social-counts button`).last().click();
   await expect(gp.locator(`#feed-${target.id}`)).toContainText('R4 live comment');
   await mutate(a,'POST',`${ab}/entries/${target.id}/comments`,{text:'R4 live reply',parentId:comment.id,creationKey:crypto.randomUUID()});
   await expect(gp.locator(`#feed-${target.id}`)).toContainText('R4 live reply',{timeout:15000});
   await mutate(a,'PATCH',`${ab}/entries/${target.id}/comments/${comment.id}/pinned`,{enabled:true});
   await expect(gp.locator(`#feed-${target.id}`)).toContainText('Pinned by author',{timeout:15000});
   await mutate(a,'DELETE',`${ab}/entries/${target.id}/comments/${comment.id}`,{version:1});
   await expect(gp.locator(`#feed-${target.id} .feed-social-counts`)).toContainText('0 comments',{timeout:15000});
   await expect(gp.getByText('R4 live comment',{exact:true})).toHaveCount(0);
 });
 await check('ownRepostAndOtherAccountRepostRefresh',async()=>{
   await mutate(a,'PATCH',`${ab}/entries/${target.id}/reposted`,{enabled:true});
   await expect(ap.locator(`#feed-${target.id}`)).toContainText('Reposted',{timeout:15000});
   await mutate(b,'PATCH',`${bb}/entries/${target.id}/reposted`,{enabled:true});
   await expect(bp.locator(`#feed-${target.id}`)).toContainText('Reposted',{timeout:15000});
 });
 await check('followAndUnfollowUpdateTheOtherOpenBrowser',async()=>{
   const profile=await read(a,'me/profile');
   await mutate(b,'PATCH',`${bb}/follows/people/${profile.person.id}`,{enabled:true});
   await expect(bp.locator(`#feed-${target.id}`).getByRole('button',{name:'Unfollow R3 Applicant',exact:true})).toBeVisible();
   await mutate(b,'PATCH',`${bb}/follows/people/${profile.person.id}`,{enabled:false});
   await expect(bp.locator(`#feed-${target.id}`).getByRole('button',{name:'Follow R3 Applicant',exact:true})).toBeVisible();
 });
 await check('sidebarFollowingCountUpdatesWithoutReload',async()=>{
   const comment=await mutate(b,'POST',`${bb}/entries/${target.id}/comments`,{text:'R4 following count fixture',creationKey:crypto.randomUUID()});
   const author=(await read(a,`${ab}/entries/${target.id}/comments`)).items.find(row=>row.id===comment.id).author.id;
   await mutate(a,'PATCH',`${ab}/follows/people/${author}`,{enabled:false});
   const initial=await read(a,`${ab}/network`),count=initial.following.length+initial.companies.length;
   const display=ap.locator('.feed-connections button strong');await expect(display).toHaveText(String(count));
   await mutate(a,'PATCH',`${ab}/follows/people/${author}`,{enabled:true});await expect(display).toHaveText(String(count+1));
   await mutate(a,'PATCH',`${ab}/follows/people/${author}`,{enabled:false});await expect(display).toHaveText(String(count));
   await mutate(b,'DELETE',`${bb}/entries/${target.id}/comments/${comment.id}`,{version:1});
 });
 await check('blockRemovesOnlyTheAffectedAccountsFeedAndUnblockRecovers',async()=>{
   const comment=await mutate(a,'POST',`${ab}/entries/${target.id}/comments`,{text:'R4 block fixture',creationKey:crypto.randomUUID()});
   await mutate(b,'PATCH',`${bb}/entries/${target.id}/comments/${comment.id}/blocked`,{enabled:true});
   await expect(bp.locator('#feed-'+target.id)).toHaveCount(0);await expect(gp.locator('#feed-'+target.id)).toBeVisible();
   await mutate(b,'DELETE',`${bb}/blocks/${f.applicant.identity}`);
   await expect(bp.getByRole('button',{name:'New posts',exact:true})).toBeVisible();await bp.getByRole('button',{name:'New posts',exact:true}).click();
   await expect(bp.locator('[data-post-id]').first()).toBeVisible();expect((await read(b,`${bb}/entries/${target.id}`)).id).toBe(target.id);
 });
 await check('deletionRemovesGuestAndOtherMemberContentWithoutNewPostClick',async()=>{
   await mutate(a,'DELETE',`${ab}/posts/${target.id}`,{version:1});
   for(const p of [gp,ap,bp]){await expect(p.locator('#feed-'+target.id)).toHaveCount(0,{timeout:15000});await expect(p.locator('.feed-post').first()).toBeVisible();}
 });
 await check('offlineGuestReconcilesMissedPosts',async()=>{
   await g.setOffline(true);const fresh=await publish('R4 missed during offline '+Date.now());await g.setOffline(false);
   await expect(gp.getByRole('button',{name:'New posts',exact:true})).toBeVisible({timeout:25000});
   await gp.getByRole('button',{name:'New posts',exact:true}).click();await expect(gp.locator('#feed-'+fresh.id)).toBeVisible();target=fresh;
 });
 await check('profilePrivacyRevokesPublicPostsAndRestoresDiscovery',async()=>{
   const privacy=async enabled=>{const p=await read(a,'me/profile');return mutate(a,'PATCH','me/profile/sections/identity',{profile_version:p.version,name:p.person.name,headline:p.person.headline||'Synthetic test account',location:p.person.location||'Synthetic location',years:String(p.person.years||0),email:p.person.email,public:enabled});};
   await privacy(false);
   await expect(gp.locator('#feed-'+target.id)).toHaveCount(0);await expect(bp.locator('#feed-'+target.id)).toHaveCount(0);
   await privacy(true);await expect(gp.getByRole('button',{name:'New posts',exact:true})).toBeVisible();await gp.getByRole('button',{name:'New posts',exact:true}).click();await expect(gp.locator('#feed-'+target.id)).toBeVisible();
 });
 await check('idleFeedsMakeNoRepeatedBusinessReads',async()=>{
   let last=JSON.stringify(reads),quiet=Date.now(),deadline=Date.now()+30000;
   while(Date.now()-quiet<4000){await new Promise(r=>setTimeout(r,250));const next=JSON.stringify(reads);if(next!==last){last=next;quiet=Date.now();}if(Date.now()>deadline)throw new Error('Feed reads did not settle');}
   const before={...reads},connections={...sockets};await new Promise(r=>setTimeout(r,65000));expect(reads).toEqual(before);expect(sockets).toEqual(connections);results.idleSeconds=65;results.idleReads=0;
 });
 await gp.screenshot({path:'.runtime/r4-guest-feed.png'});await bp.screenshot({path:'.runtime/r4-recruiter-feed.png'});
 expect(results.pageErrors??[]).toEqual([]);
}catch(error){results.failure=error.stack;console.error(error);for(const c of contexts)for(const p of c.pages())await p.screenshot({path:`.runtime/r4-failure-${contexts.indexOf(c)}.png`}).catch(()=>{});process.exitCode=1;}
finally{results.sockets=sockets;results.reads=reads;fs.writeFileSync(process.argv.includes('--network-only')?'.runtime/r4-network-result.json':'.runtime/r4-browser-result.json',JSON.stringify(results,null,2));await browser.close();}
