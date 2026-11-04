// Run from the monorepo root after starting the isolated R3 fixture server.
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
const f=JSON.parse(fs.readFileSync('.runtime/r3-browser-fixture.json','utf8'));
const base='http://localhost:3109',api='http://localhost:8109/api/v1';
const browser=await chromium.launch({headless:true});const contexts=[];const results={};
async function context(account,employer=false){const c=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(c);await mutate(c,'POST',`auth/${employer?'employer':'professional'}/login`,{email:account.email,password:f.password});await mutate(c,'POST','me/workspace',{identity_id:account.identity});return c;}
async function mutate(c,method,path,data){await c.request.get('http://localhost:8109/sanctum/csrf-cookie',{headers:{Origin:base,Accept:'application/json'}});const token=(await c.cookies('http://localhost:8109')).find(x=>x.name==='XSRF-TOKEN');const response=await c.request.fetch(api+'/'+path,{method,data,headers:{Origin:base,Accept:'application/json','X-XSRF-TOKEN':decodeURIComponent(token.value)}});expect(response.status(),`${method} ${path}: ${await response.text()}`).toBeLessThan(300);return response.status()===204?null:(await response.json()).data;}
async function read(c,path){const r=await c.request.get(api+'/'+path,{headers:{Origin:base,Accept:'application/json'}});expect(r.status(),path).toBe(200);return (await r.json()).data;}
const counts={};const sockets={};
async function page(c,label,path){const p=await c.newPage();counts[label]=0;sockets[label]=0;p.on('request',r=>{if(r.method()==='GET'&&r.url().includes('/communications/'))counts[label]++;});p.on('websocket',ws=>{if(ws.url().includes(':8089/')){sockets[label]++;ws.on('framereceived',e=>{try{const frame=JSON.parse(String(e.payload));if(frame.event==='skillora.changed.v1')results.receivedSignals=(results.receivedSignals??0)+1;}catch{}});}});p.on('pageerror',e=>{results.pageErrors??=[];results.pageErrors.push(e.message);});await p.goto(base+path);await expect(p.getByRole('heading',{name:'Messaging',exact:true})).toBeVisible({timeout:120000});await expect(p.locator('.direct-message-history')).toContainText('Synthetic history 62',{timeout:30000});await expect.poll(()=>sockets[label],{timeout:30000}).toBe(1);return p;}
async function check(name,fn){await fn();results[name]=true;console.log('PASS '+name);}
try{
const a=await context(f.applicant),b=await context(f.recruiter,true);
const ap=await page(a,'a','/app/messages'),bp=await page(b,'b','/recruiter/messages'),a2=await page(a,'a2','/app/messages');
const ab=`me/communications/${f.applicant.identity}`,bb=`me/communications/${f.recruiter.identity}`;
const send=async(text)=>mutate(b,'POST',`${bb}/conversations/${f.conversation}/messages`,{text,assetIds:[],clientMessageId:crypto.randomUUID()});
await check('twoAccountsAndSameUserTabsReceiveMessagesAndNewCount',async()=>{
 const old=await read(a,ab+'/notifications');await mutate(a,'POST',ab+'/notifications/seen',{seenToken:old.seenToken});
 await expect(ap.locator('.notification-new-count')).toHaveCount(0,{timeout:15000});
 const text='R3 live '+Date.now();await send(text);
 for(const p of [ap,bp,a2])await expect(p.locator('.direct-message-history')).toContainText(text,{timeout:20000});
 for(const p of [ap,a2])await expect(p.locator('.notification-new-count')).toHaveText('1',{timeout:15000});
});
await check('notificationSeenReadAndDeletePropagateWithoutLosingNewVersusUnread',async()=>{
 await ap.getByRole('button',{name:'Notifications',exact:true}).click();
 await expect(ap.locator('.notification-row').first()).toBeVisible();
 await expect(a2.locator('.notification-new-count')).toHaveCount(0,{timeout:15000});
 const notifications=await read(a,ab+'/notifications');const item=notifications.items[0];
 await mutate(a,'PATCH',`${ab}/notifications/${item.id}/read`);
 await expect(ap.locator(`[data-notification-id="${item.id}"]`)).toHaveAttribute('data-unread','false',{timeout:15000});
 await mutate(a,'DELETE',`${ab}/notifications/${item.id}`);
 await expect(ap.locator(`[data-notification-id="${item.id}"]`)).toHaveCount(0,{timeout:15000});
 await ap.keyboard.press('Escape');
});
await check('historyPaginationAndScrollSurviveIncomingMessages',async()=>{
 await ap.getByRole('button',{name:/earlier/i}).click();await expect(ap.locator('.direct-message-history')).toContainText('Synthetic history 01');
 await ap.locator('.direct-message-history').evaluate(el=>{el.scrollTop=100;el.dispatchEvent(new Event('scroll'));});
 const top=await ap.locator('.direct-message-history').evaluate(el=>el.scrollTop);const text='History preserved '+Date.now();await send(text);
 await expect(ap.locator('.direct-message-history')).toContainText(text,{timeout:15000});await expect(ap.locator('.direct-message-history')).toContainText('Synthetic history 01');
 expect(Math.abs((await ap.locator('.direct-message-history').evaluate(el=>el.scrollTop))-top)).toBeLessThan(20);
});
await check('blockAndUnblockRefreshBothParticipants',async()=>{
 await mutate(b,'PATCH',`${bb}/conversations/${f.conversation}/flags`,{flag:'blockedBy',enabled:true});
 await expect(ap.getByRole('textbox',{name:'Write a message',includeHidden:true})).toBeDisabled({timeout:15000});
 await mutate(b,'PATCH',`${bb}/conversations/${f.conversation}/flags`,{flag:'blockedBy',enabled:false});
 await expect(ap.getByRole('textbox',{name:'Write a message',includeHidden:true})).toBeEnabled({timeout:15000});
});
await check('offlineReconnectCatchesMissedMessage',async()=>{
 await a.setOffline(true);const text='While offline '+Date.now();await send(text);await a.setOffline(false);
 await expect(ap.locator('.direct-message-history')).toContainText(text,{timeout:20000});await expect(a2.locator('.direct-message-history')).toContainText(text,{timeout:20000});
});
await check('failedSendKeepsDraftAndRetryStoresOneMessage',async()=>{
 const text='Retained after failure '+Date.now(), keys=[];
 const matcher=`**/conversations/${f.conversation}/messages`;
 await ap.route(matcher,route=>{keys.push(route.request().postDataJSON().clientMessageId);return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic outage'})});});
 await ap.getByRole('textbox',{name:'Write a message'}).fill(text);await ap.getByRole('button',{name:'Send',exact:true}).click();
 await expect(ap.getByText('Your message could not be sent. Your draft is kept here; retry when ready.')).toBeVisible();
 await expect(ap.getByRole('textbox',{name:'Write a message'})).toHaveValue(text);
 await ap.unroute(matcher);ap.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith(`/conversations/${f.conversation}/messages`))keys.push(r.postDataJSON().clientMessageId);});
 await ap.getByRole('button',{name:'Send',exact:true}).click();await expect(bp.locator('.direct-message-history')).toContainText(text,{timeout:15000});
 expect(keys).toHaveLength(2);expect(keys[0]).toBe(keys[1]);
 const history=await read(a,`${ab}/conversations/${f.conversation}`);expect(history.messages.filter(m=>m.text===text)).toHaveLength(1);
});
await check('noIdleCommunicationRequestsOrExtraSockets',async()=>{
 let last=JSON.stringify(counts),quiet=Date.now();const deadline=Date.now()+40000;while(Date.now()-quiet<5000){await new Promise(r=>setTimeout(r,250));const next=JSON.stringify(counts);if(next!==last){last=next;quiet=Date.now();}if(Date.now()>deadline)throw new Error("Communication updates did not settle");}const before={...counts},connections={...sockets};await new Promise(r=>setTimeout(r,65000));expect(counts).toEqual(before);expect(sockets).toEqual(connections);results.idleRequests=0;results.idleSeconds=65;
});
await check('crossTabWorkspaceSwitchRemovesPreviousPrivateSnapshot',async()=>{
 await mutate(a,'POST','me/workspace',{identity_id:f.applicant.identity});
 await mutate(b,'POST','me/workspace',{identity_id:f.recruiter.professional});
 await expect(bp.locator('.direct-message-history')).toHaveCount(0,{timeout:20000});
 await expect(bp.getByText('Synthetic history 62',{exact:true})).toHaveCount(0);
 await expect(ap.locator('.direct-message-history')).toBeVisible();
});
await ap.screenshot({path:'.runtime/r3-messaging-desktop.png'});
}catch(e){results.failure=e.stack;console.error(e);for(const c of contexts)for(const p of c.pages())await p.screenshot({path:`.runtime/r3-failure-${contexts.indexOf(c)}-${c.pages().indexOf(p)}.png`}).catch(()=>{});process.exitCode=1;}
finally{results.requests=counts;results.sockets=sockets;fs.writeFileSync('.runtime/r3-browser-result.json',JSON.stringify(results,null,2));await browser.close();}
