import { expect, test, type Page } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

async function secret(destination: string) {
  const folder = resolve("../api/storage/app/private/test-deliveries");
  let code = "";
  await expect.poll(() => {
    if (!existsSync(folder)) return "";
    code = readdirSync(folder).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(resolve(folder, f), "utf8"))).filter((v) => v.destination === destination && v.subject === "Your Skillora verification code").at(-1)?.secret ?? "";
    return code;
  }).not.toBe("");
  return code;
}
async function signup(page: Page) {
  const email = `phase2-${randomUUID()}@example.test`;
  await page.goto("/signup?role=professional");
  await page.getByRole("textbox", { name: "Full name" }).fill("Phase Two Professional");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByLabel(/^Password/).fill("phase two password");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  { const code = await secret(email); for (let i=0;i<6;i++) await page.locator(`[data-otp-index="${i}"]`).fill(code[i]); }
  await page.getByRole("button", { name: /^Verify email$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  return email;
}

test("hidden onboarding redirects, profile validation, private resume, refresh and public projection", async ({ page, browser }) => {
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  const email = await signup(page);
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(page.getByText("Onboarding CV", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save & continue", exact: true })).toHaveCount(0);
  await page.goto("/app/profile");
  await expect(page.getByRole("heading", { name: /^Phase Two Professional/ })).toBeVisible();
  await page.getByRole("button", { name: "Edit basic profile" }).click();
  const identity = page.getByRole("dialog");
  await identity.getByRole("textbox", { name: "Headline" }).fill("Backend Engineer");
  await identity.getByRole("textbox", { name: "City" }).fill("Bengaluru");
  const publicToggle = identity.getByRole("switch", { name: /Make my professional profile public/ });
  if (!(await publicToggle.isChecked())) await publicToggle.check();
  await identity.getByRole("button", { name: "Save changes" }).click();
  await expect(identity).toHaveCount(0);
  await page.getByRole("combobox", { name: "Profile section" }).selectOption("resume");
  await page.getByLabel("Upload resume").setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF") });
  await page.getByRole('complementary',{name:'Media uploads'}).getByRole('button',{name:'Upload',exact:true}).click();
  await expect(page.getByRole('heading',{name:'resume.pdf',exact:true})).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading',{name:'resume.pdf',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Key skills',exact:true}).click();
  await page.getByRole("button", { name: "Add skill", exact: true }).click();
  const skills: string[] = []; page.on("request", (r) => { if (r.url().includes("/records/skills") && r.method() === "POST") skills.push(r.url()); });
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.getByRole("combobox", { name: "Skill name", exact: true })).toHaveAttribute("aria-invalid", "true"); expect(skills).toHaveLength(0);
  await page.getByRole("combobox", { name: "Skill name", exact: true }).fill("Laravel");
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.getByRole("combobox", { name: "Skill name", exact: true })).toHaveCount(0);
  await expect(page.getByText("Laravel", { exact: true }).first()).toBeVisible();
  const response = await page.request.get("http://localhost:8001/api/v1/me/profile", { headers: { Origin: "http://localhost:3400" } });
  expect(response.ok()).toBe(true); const view = (await response.json()).data;
  const outsider = await browser.newContext();
  try {
    const anonymous = await outsider.newPage(); await anonymous.goto(`http://localhost:3400/professionals/${view.person.slug}`);
    await expect(anonymous.getByRole("heading", { name: "Phase Two Professional", exact: true })).toBeVisible();
    await expect(anonymous.getByText(email, { exact: true })).toHaveCount(0);
    const download = await outsider.request.get(`http://localhost:8001/api/v1/media/${view.details.resume.id}/download`, { headers: { Origin: "http://localhost:3400" } }); expect(download.status()).toBe(404);
  } finally { await outsider.close(); }
  expect(errors).toEqual([]);
});

test("real company editor validates before save and persists company, verification and recruiter details", async ({ page }) => {
  const email = `company-${randomUUID()}@example.test`, phone = "9" + String(Date.now()).slice(-9);
  const verify = async (destination: string) => { const code = await secret(destination); for (let i=0;i<6;i++) await page.locator(`[data-otp-index="${i}"]`).fill(code[i]); await page.getByRole("button", { name: "Verify & continue" }).click(); };
  await page.goto("/employer/register"); await page.getByRole("textbox", { name: "Mobile number" }).fill(phone); await page.getByRole("button", { name: "Submit", exact: true }).click(); await verify("+91" + phone);
  await page.getByRole("textbox", { name: "Full name" }).fill("Company Administrator"); await page.getByRole("textbox", { name: "Official email ID" }).fill(email); await page.getByLabel(/^Create password/).fill("company password"); await page.getByRole("button", { name: "Continue", exact: true }).click(); await verify(email);
  await page.getByRole("textbox", { name: "Company", exact: true }).fill("Phase Two Company"); await page.getByRole("combobox", { name: "Industry" }).selectOption("Manufacturing"); await page.getByRole("combobox", { name: "Number of employees" }).selectOption("11–50 employees"); await page.getByRole("textbox", { name: "Your designation" }).fill("Founder"); await page.getByRole("textbox", { name: "Pin code" }).fill("560001"); await page.getByRole("textbox", { name: "Company address" }).fill("Main Road, Bengaluru"); await page.getByRole("button", { name: "Create account", exact: true }).click(); await expect(page).toHaveURL(/\/recruiter\/dashboard$/);
  await page.goto("/recruiter/company");
  const writes: string[] = []; page.on("request", (r) => { if (r.method() === "PATCH" && /\/organizations\/[^/]+\/profile$/.test(r.url())) writes.push(r.url()); });
  await page.getByRole('textbox',{name:'Organization name',exact:true}).fill('');
  await page.getByRole("button", { name: "Save Changes", exact: true }).first().click(); await expect(page.getByRole("alert").first()).toBeVisible(); expect(writes).toHaveLength(0);
  await page.getByRole("combobox", { name: "Organization type" }).selectOption("Privately held");
  await page.getByRole('textbox',{name:'Organization name',exact:true}).fill('Phase Two Company');
  await page.getByRole("textbox", { name: "Headquarters country" }).fill("India"); await page.getByRole("textbox", { name: "Headquarters city" }).fill("Bengaluru"); await page.getByRole("textbox", { name: "Website URL", exact: true }).fill("https://example.test"); await page.getByRole("textbox", { name: "Short company tagline" }).fill("Engineering with care"); await page.getByRole("textbox", { name: "Company description" }).fill("A company built for independent engineering.");
  const organizationSaved=page.waitForResponse(r=>r.request().method()==='PATCH'&&/\/organizations\/[^/]+\/profile$/.test(r.url()));
  await page.getByRole("button", { name: "Save Changes", exact: true }).first().click(); expect((await organizationSaved).ok()).toBe(true); await expect(page.getByText("Organization profile saved.", { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole("textbox", { name: "Short company tagline" })).toHaveValue("Engineering with care");
  await page.goto("/recruiter/company?section=verification"); await page.getByRole("button", { name: "Submit for review", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("document");
  await expect(page.getByText("Prototype review controls")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Registered business name" }).fill("Phase Two Legal Company");
  await page.getByRole("textbox", { name: "Business registration number" }).fill("PRIVATE-REGISTRATION");
  await page.getByRole("textbox", { name: "Registration country / jurisdiction" }).fill("India");
  await page.getByRole("textbox", { name: "Authorized representative", exact: true }).fill("Company Administrator");
  await page.getByRole("textbox", { name: "Representative designation" }).fill("Founder");
  await page.getByRole("textbox", { name: "Business email", exact: true }).fill(email);
  await page.getByRole("textbox", { name: "Business website", exact: true }).fill("https://example.test");
  await page.locator('input[type="file"][accept="application/pdf,image/png,image/jpeg"]').setInputFiles({ name: "proof.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF") });
  await page.getByRole('complementary',{name:'Media uploads'}).getByRole('button',{name:'Upload',exact:true}).click();
  await expect(page.getByText(/proof.pdf ·/)).toBeVisible();
  await page.getByRole("button", { name: "Submit for review", exact: true }).click();
  await expect(page.getByText("Verification request submitted for review.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Business registration number" })).toHaveValue("PRIVATE-REGISTRATION");
  await page.goto("/recruiter/profile"); await expect(page.getByRole("heading", { name: "My Recruiter Profile", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Full name", exact: true }).fill("Updated Recruiter"); await page.getByRole("button", { name: "Save Changes", exact: true }).first().click();
  await expect(page.getByText("Recruiter identity saved. Organization details were not changed.")).toBeVisible(); await page.reload(); await expect(page.getByRole("textbox", { name: "Full name", exact: true })).toHaveValue("Updated Recruiter");
});
