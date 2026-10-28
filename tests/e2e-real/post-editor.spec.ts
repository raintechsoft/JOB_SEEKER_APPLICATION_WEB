import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

test.use({ trace: "off" });
for (const role of ["professional", "recruiter"] as const) test(`${role} drafts, images, publishing and edits persist`, async ({ page }) => {
  test.setTimeout(120_000);
  const check = expect.configure({ timeout: 20_000 });
  const values = Object.fromEntries(readFileSync(resolve("../api/.env.testing"), "utf8").split(/\r?\n/).filter(line => line && !line.startsWith("#")).map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)]; }));
  const fixture = spawnSync("php", ["tests/Fixtures/saved-jobs-browser.php"], { cwd: resolve("../api"), env: { ...values, ...process.env, APP_ENV: "testing", DB_DATABASE: "skillora_e2e_test", QUEUE_CONNECTION: "sync", ANALYTICS_COLLECTION_ENABLED: "false" }, encoding: "utf8" });
  if (fixture.status !== 0) throw Error("Post fixture failed: " + fixture.stderr);
  const data = JSON.parse(fixture.stdout) as { email: string; employerEmail: string };
  const base = role === "professional" ? "/app" : "/recruiter";
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(role === "professional" ? "/login" : "/employer/login");
  await page.getByRole("textbox", { name: "Email address" }).fill(role === "professional" ? data.email : data.employerEmail);
  await page.getByLabel(/^Password/).fill("isolated saved opportunities password");
  await page.getByRole("button", { name: /^login$/i }).click(); await check(page).toHaveURL(new RegExp(base + "/dashboard$"));
  await page.goto(base + "/posts/new");
  const title = `Verified ${role} image story`;
  await page.getByRole("textbox", { name: "Post title", exact: true }).fill(title);
  await page.getByRole("textbox", { name: "Your story", exact: true }).fill("A story with managed media and a preserved draft.");
  await check(page.locator("#post-save-status")).toHaveText("Draft saved");
  await page.reload(); await check(page.getByRole("textbox", { name: "Post title", exact: true })).toHaveValue(title);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const fixturePng=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=360;const ctx=c.getContext('2d')!;ctx.fillStyle='#315ef4';ctx.fillRect(0,0,640,360);ctx.fillStyle='#f0a14a';ctx.fillRect(320,0,320,360);return c.toDataURL('image/png').split(',')[1];});
  const png=Buffer.from(fixturePng,'base64');
  let uploadIntents=0;page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname==='/api/v1/media')uploadIntents++;});
  await page.locator("#post-editor-files").setInputFiles([{ name: "first.png", mimeType: "image/png", buffer: png }, { name: "second.png", mimeType: "image/png", buffer: png }]);
  await check(page.locator(".post-media-tile")).toHaveCount(2);
  for (const image of await page.locator(".post-media-tile img").all()) {
    await check(image).toHaveAttribute("src", /^blob:/);
    await check.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  }
  const preview=page.locator('#post-live-preview');
  await check(preview.locator('.post-carousel-slide')).toHaveCount(1);
  if(role==='professional')await preview.screenshot({path:'test-results/post-selected-preview.png'});
  const firstPreview=await preview.locator('.post-carousel-slide img').getAttribute('src');
  await preview.getByRole('button',{name:'Next media',exact:true}).click();
  await check(preview.locator('.post-carousel-slide')).toHaveCount(1);
  await check(preview.locator('.post-carousel-slide img')).not.toHaveAttribute('src',firstPreview!);
  await page.getByRole("button", { name: "Remove first.png", exact: true }).click();
  await check(page.locator(".post-media-tile")).toHaveCount(1);
  check(uploadIntents).toBe(0);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  check(uploadIntents).toBe(0);
  let release:()=>void=()=>{};
  let intercepted:Promise<void>=Promise.resolve();
  if(role==='professional'){
    let started!:()=>void;intercepted=new Promise<void>(resolve=>{started=resolve;});
    const hold=new Promise<void>(resolve=>{release=resolve;});
    await page.route('**/api/v1/media/*/content',async route=>{started();await hold;await route.continue();});
  }
  let publicationRequests=0;page.on('request',request=>{if(request.method()==='POST'&&/\/social\/.+\/posts$/.test(new URL(request.url()).pathname))publicationRequests++;});
  const published=page.waitForResponse(response=>response.request().method()==='POST'&&/\/social\/.+\/posts$/.test(new URL(response.url()).pathname));
  await page.getByRole("button", { name: "Publish post", exact: true }).click();
  await intercepted;
  await check(page).toHaveURL(new RegExp(base+'/dashboard$'));
  if(role==='professional'){
    await check(page.getByRole('progressbar',{name:'Uploading post',exact:true})).toHaveCount(1);
    await check(page.getByRole('complementary',{name:'Media uploads'}).locator('progress')).toHaveCount(1);
    check(publicationRequests).toBe(0);
    await page.screenshot({path:'test-results/post-background-upload.png'});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'test-results/post-background-upload-mobile.png'});
    await page.setViewportSize({width:1280,height:720});
    release();
  }
  const response=await published;check(response.ok()).toBe(true);
  const payload=response.request().postDataJSON();check(payload.attachments).toHaveLength(1);check(payload.attachments[0].src).toMatch(/\/api\/v1\/media\/.+\/download$/);check(JSON.stringify(payload)).not.toContain('blob:');
  await check(page.getByRole('complementary',{name:'Media uploads'})).toContainText('Post uploaded');
  await page.getByRole('link',{name:'View post',exact:true}).click();
  await check(page).toHaveURL(new RegExp(base+'/dashboard\\?post='));
  const card = page.locator("#feed-" + new URL(page.url()).searchParams.get("post")); await check(card).toContainText(title);
  await card.locator(".activity-post-menu summary").click(); await card.getByRole("button", { name: "Edit post", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit your post" });
  await dialog.getByRole("textbox", { name: role === "professional" ? "Post title" : "Title", exact: true }).fill(title + " edited");
  await dialog.getByRole("textbox", { name: role === "professional" ? "Your story" : "Your post", exact: true }).fill("An updated story with its original media retained.");
  const editReads:Array<{status:number;title?:string;path:string}>=[];
  const observeEdits=async(response:import('@playwright/test').Response)=>{const u=new URL(response.url());if(response.request().method()==='GET'&&/\/(feed|entries\/[^/]+)$/.test(u.pathname)){const row=await response.json().catch(()=>null);editReads.push({status:response.status(),path:u.pathname.endsWith('/feed')?'feed':'entry',title:row?.data?.items?.find((v:{id:string})=>v.id===new URL(page.url()).searchParams.get('post'))?.title??row?.data?.title});}};
  page.on('response',observeEdits);
  const edited=page.waitForResponse(r=>r.request().method()==='PATCH'&&/\/posts\/[^/]+$/.test(new URL(r.url()).pathname));
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  check((await edited).ok()).toBe(true);
  await check(dialog).not.toBeVisible();
  try { await check(card).toContainText(title+" edited"); } catch(error) { console.log(JSON.stringify({editReads}));throw error; }
  page.off('response',observeEdits);
  await page.reload(); await check(card).toContainText("An updated story with its original media retained."); await check(card.locator(".post-carousel")).toBeVisible();
  check(errors).toEqual([]);
});
