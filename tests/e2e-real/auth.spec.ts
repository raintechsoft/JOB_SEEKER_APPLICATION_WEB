import { expect, test, type Page } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

test.use({ trace: "off", screenshot: "off", video: "off" });

const deliveryDir = resolve("../api/storage/app/private/test-deliveries");
async function delivered(destination: string, subject: string, channel?: "email" | "whatsapp") {
  let value = "";
  await expect.poll(() => {
    if (!existsSync(deliveryDir)) return "";
    const deliveries = readdirSync(deliveryDir).filter((file) => file.endsWith(".json")).map((file) => JSON.parse(readFileSync(resolve(deliveryDir, file), "utf8")));
    value = deliveries.filter((item) => item.destination === destination && item.subject === subject && (!channel || item.channel === channel)).at(-1)?.secret ?? "";
    return value;
  }).not.toBe("");
  return value;
}

async function otp(page: Page, destination: string) {
  const code = await delivered(destination, "Your Skillora verification code", destination.startsWith("+") ? "whatsapp" : "email");
  for (let i = 0; i < 6; i++) await page.locator(`[data-otp-index="${i}"]`).fill(code[i]);
  await page.getByRole("button", { name: "Verify & continue" }).click();
}

async function workspaceSessionSurvivesPublicVisit(page: Page, kind: "professional" | "employer") {
  const dashboard = kind === "employer" ? "/recruiter/dashboard" : "/app/dashboard";
  let signIns = 0;
  const observe = (request: import("@playwright/test").Request) => { if (request.method() === "POST" && /\/auth\/(professional|employer)\/login$/.test(request.url())) signIns++; };
  page.on("request", observe);
  try {
    const logo = page.getByRole("banner").getByRole("link", { name: "Skillora workspace", exact: true });
    await expect(logo).toHaveAttribute("href", dashboard);
    await logo.click();
    await expect(page).toHaveURL(new RegExp(dashboard + "$"));
    await page.goto("/");
    const account = page.getByRole("banner").getByRole("link", { name: "Your workspace", exact: true });
    await expect(account).toHaveAttribute("href", dashboard, { timeout: 10_000 });
    await expect(page.getByRole("banner").getByRole("link", { name: "Login", exact: true })).toHaveCount(0);
    await expect(page.locator(".ph-login-note")).toHaveCount(0);
    await page.reload();
    await expect(account).toHaveAttribute("href", dashboard);
    await account.click();
    await expect(page).toHaveURL(new RegExp(dashboard + "$"));
    await page.goto(kind === "employer" ? "/employer/login" : "/login");
    await expect(page).toHaveURL(new RegExp(dashboard + "$"));
    await expect(page.getByRole("textbox", { name: "Email address", exact: true })).toHaveCount(0);
    expect(signIns).toBe(0);
  } finally { page.off("request", observe); }
}

test("real professional signup, verification, refresh, logout, login, recovery and revocation", async ({ page, request, browser }) => {
  const email = `professional-${randomUUID()}@example.test`;
  const password = "secure password";
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/app/dashboard");
  await expect(page).toHaveURL(/\/login\?/);
  for (const route of ["/verify-email", "/change-password"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login\?/);
  }
  await page.goto("/reset-password?verified=true&token=forged");
  await expect(page).toHaveURL(/\/forgot-password\?reason=reset-expired$/);
  await page.goto("/signup?role=professional");
  const writes: string[] = [];
  page.on("request", (r) => { if (r.method() === "POST" && r.url().includes("/auth/register")) writes.push(r.url()); });
  await page.getByRole("button", { name: "SUBMIT", exact: true }).click();
  await expect(page.getByText("Add your full name.")).toBeVisible();
  expect(writes).toHaveLength(0);
  await page.getByRole("textbox", { name: "Full name" }).fill("Independent Professional");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "SUBMIT", exact: true }).click();
  await expect(page).toHaveURL(/\/verify-email$/);
  await expect(page.locator("[data-demo-code]")).toHaveCount(0);
  { const code = await delivered(email, "Your Skillora verification code"); for (let i=0;i<6;i++) await page.locator(`[data-otp-index="${i}"]`).fill(code[i]); }
  await page.getByRole("button", { name: /^Verify email$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expect(page.getByRole("main", { name: "Your feed", exact: true })).toBeVisible();
  await page.goto("/verify-email");
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await page.goto("/app/account");
  await page.reload();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("skillora-demo-v1"))).toBeNull();
  const direct = await request.post("http://localhost:8001/api/v1/auth/register", { headers: { Origin: "http://localhost:3400", Accept: "application/json" }, data: { name: "Invalid", email: "invalid", password: "short" } });
  expect(direct.status()).toBe(419); // Real HTTP server must enforce CSRF even before validation.
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/employer/login?role=professional");
  await expect(page.getByText("Sign in with your employer account.")).toBeVisible();
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  const deniedEmployer = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/auth/employer/login"));
  await page.getByRole("button", { name: "LOGIN", exact: true }).click();
  expect((await deniedEmployer).status()).toBe(422);
  await expect(page).toHaveURL(/\/employer\/login\?role=professional$/);
  await expect(page.getByRole("alert").filter({ hasText: "These credentials could not be verified." })).toBeVisible();
  await page.goto("/app/dashboard");
  await expect(page).toHaveURL(/\/login\?/);
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "LOGIN", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await page.goto("/forgot-password");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  const issued = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/auth/forgot-password"));
  await page.getByRole("button", { name: "SEND RESET CODE", exact: true }).click();
  const resetMetadata = (await (await issued).json()).data;
  const resetCode = await delivered(email, "Your Skillora password reset code");
  const outsider = await browser.newContext();
  try {
    const headers = { Origin: "http://localhost:3400", Accept: "application/json" };
    await outsider.request.get("http://localhost:8001/sanctum/csrf-cookie", { headers });
    const cookie = (await outsider.cookies("http://localhost:8001")).find((item) => item.name === "XSRF-TOKEN");
    const stolen = await outsider.request.post("http://localhost:8001/api/v1/auth/reset-password/verify", { headers: { ...headers, "X-XSRF-TOKEN": decodeURIComponent(cookie?.value ?? "") }, data: { email, challenge_id: resetMetadata.id, code: resetCode } });
    expect(stolen.status()).toBe(422);
    const outsiderPage = await outsider.newPage();
    await outsiderPage.goto("http://localhost:3400/reset-password?verified=true");
    await expect(outsiderPage).toHaveURL(/\/forgot-password\?reason=reset-expired$/);
    await expect(outsiderPage.getByLabel(/^New password/)).toHaveCount(0);
  } finally { await outsider.close(); }
  for (let i = 0; i < 6; i++) await page.locator(`[data-otp-index="${i}"]`).fill(resetCode[i]);
  await page.getByRole("button", { name: "VERIFY CODE", exact: true }).click();
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.reload(); // Permission comes from the backend session, not component state.
  await page.getByLabel(/^New password/).fill("replacement password");
  await page.getByLabel(/^Confirm new password/).fill("replacement password");
  await page.getByRole("button", { name: /^Reset password$/i }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/app/dashboard");
  await expect(page).toHaveURL(/\/login\?/);
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByLabel(/^Password/).fill("replacement password");
  await page.getByRole("button", { name: "LOGIN", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  const passwordPage = await page.goto("/change-password");
  if (passwordPage?.status() !== 200) {
    const check = await page.request.get("http://localhost:8001/api/v1/auth/me", { headers: { Origin: "http://localhost:3400", Accept: "application/json" } });
    const metadata = await check.json();
    throw new Error(`Password page status ${passwordPage?.status()}; backend session status ${check.status()}, code ${metadata.code ?? "ok"}.`);
  }
  const changes: string[] = [];
  page.on("request", (r) => { if (r.method() === "PATCH" && r.url().endsWith("/auth/password")) changes.push(r.url()); });
  await page.getByLabel(/^Current password/).fill("incorrect");
  await page.getByLabel(/^New password/).fill("changed password");
  await page.getByLabel(/^Confirm new password/).fill("mismatch");
  await page.getByRole("button", { name: /^Change password$/i }).click();
  await expect(page.getByText("Passwords must match.")).toBeVisible();
  expect(changes).toHaveLength(0);
  await page.getByLabel(/^Confirm new password/).fill("changed password");
  await page.getByRole("button", { name: /^Change password$/i }).click();
  await expect(page.getByText("Your current password is incorrect.")).toBeVisible();
  await expect(page.getByLabel(/^New password/)).toHaveValue("changed password");
  await page.getByLabel(/^Current password/).fill("replacement password");
  await page.getByRole("button", { name: /^Change password$/i }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});

test("professional public-page navigation retains the existing session", async ({ page }) => {
  const email = `public-navigation-${randomUUID()}@example.test`;
  await page.goto("/signup?role=professional");
  await page.getByRole("textbox", { name: "Full name" }).fill("Public Navigation Verification");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByLabel(/^Password/).fill("secure password");
  await page.getByRole("button", { name: "SUBMIT", exact: true }).click();
  await expect(page).toHaveURL(/\/verify-email$/);
  const code = await delivered(email, "Your Skillora verification code");
  for (let i = 0; i < 6; i++) await page.locator(`[data-otp-index="${i}"]`).fill(code[i]);
  await page.getByRole("button", { name: /^Verify email$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await workspaceSessionSurvivesPublicVisit(page, "professional");
});

test("real five-step employer enrollment, invitations and organization access", async ({ page, browser }) => {
  test.setTimeout(90_000); // Enrollment, public-session navigation and a separate invitee browser.
  const email = `employer-${randomUUID()}@example.test`;
  const phone = "9" + String(Date.now()).slice(-9);
  await page.goto("/employer/register");
  await page.getByRole("textbox", { name: "Mobile number" }).fill(phone);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await page.locator('[data-otp-index="0"]').waitFor();
  await expect(page.getByText(/Check WhatsApp for the verification code/)).toBeVisible();
  await expect(page.locator('[data-code-expiry]')).toHaveText(/^Code expires in 0[45]:\d{2}\.$/);
  await otp(page, "+91" + phone);
  await page.getByRole("textbox", { name: "Full name" }).fill("Independent Employer");
  await expect(page.locator('[data-code-expiry]')).toHaveCount(0);
  await page.getByRole("textbox", { name: "Official email ID" }).fill(email);
  await page.getByLabel(/^Create password/).fill("employer password");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await otp(page, email);
  await page.getByRole("textbox", { name: "Company", exact: true }).fill("Independent Organization");
  await page.getByRole("combobox", { name: "Industry" }).selectOption("Manufacturing");
  await page.getByRole("combobox", { name: "Number of employees" }).selectOption("11–50 employees");
  await page.getByRole("textbox", { name: "Your designation" }).fill("Founder");
  await page.getByRole("textbox", { name: "Pin code" }).fill("560001");
  await page.getByRole("textbox", { name: "Company address" }).fill("1 Main Road, Bengaluru");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/recruiter\/dashboard$/);
  await workspaceSessionSurvivesPublicVisit(page, "employer");
  await page.goto("/recruiter/access");
  await expect(page.getByRole("heading", { name: "Independent Organization", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/login");
  await expect(page.getByText("Sign in with your professional account.")).toBeVisible();
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByLabel(/^Password/).fill("employer password");
  const deniedProfessional = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/auth/professional/login"));
  await page.getByRole("button", { name: "LOGIN", exact: true }).click();
  expect((await deniedProfessional).status()).toBe(422);
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/recruiter/access");
  await expect(page).toHaveURL(/\/employer\/login\?next=/);
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByLabel(/^Password/).fill("employer password");
  await page.getByRole("button", { name: "LOGIN", exact: true }).click();
  await expect(page).toHaveURL(/\/recruiter\/dashboard$/);
  await page.goto("/recruiter/access");
  await expect(page.getByRole("heading", { name: "Independent Organization", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Role for Independent Employer" }).selectOption("recruiter");
  await page.getByRole("button", { name: "Save access" }).click();
  await expect(page.getByText("Keep at least one active organization admin.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Role for Independent Employer" })).toHaveValue("organization_admin");

  const inviteEmail = `invitee-${randomUUID()}@example.test`;
  const context = await browser.newContext();
  try {
    const invitee = await context.newPage();
    await invitee.goto("http://localhost:3400/signup?role=professional");
    await invitee.getByRole("textbox", { name: "Full name" }).fill("Invited Professional");
    await invitee.getByRole("textbox", { name: "Email address" }).fill(inviteEmail);
    await invitee.getByLabel(/^Password/).fill("invitee password");
    await invitee.getByRole("button", { name: "SUBMIT", exact: true }).click();
    await expect(invitee).toHaveURL(/\/verify-email$/);
    { const code = await delivered(inviteEmail, "Your Skillora verification code"); for (let i=0;i<6;i++) await invitee.locator(`[data-otp-index="${i}"]`).fill(code[i]); }
    await invitee.getByRole("button", { name: /^Verify email$/i }).click();
    await expect(invitee).toHaveURL(/\/app\/dashboard$/);

    await page.getByRole("textbox", { name: "Work email" }).fill(inviteEmail);
    const invited = page.waitForResponse(response => response.request().method() === "POST" && /\/organizations\/[^/]+\/invitations$/.test(response.url()));
    await page.getByRole("button", { name: "Invite member", exact: true }).click();
    expect((await invited).ok()).toBe(true);
    await expect(page.getByRole("status")).toHaveText("Invitation queued for delivery.");
    const invitation = new URL(await delivered(inviteEmail, "Your Skillora organization invitation"));
    await invitee.goto("http://localhost:3400" + invitation.pathname + invitation.search);
    await invitee.getByRole("button", { name: /^Accept invitation$/i }).click();
    await expect(invitee).toHaveURL(/\/recruiter\/dashboard$/);
    await invitee.goto("/recruiter/access");
    await expect(invitee.getByRole("heading", { name: "Independent Organization", exact: true })).toBeVisible();
    await expect(invitee.getByRole("button", { name: "Invite member", exact: true })).toHaveCount(0);
    await page.reload();
    await page.getByRole("combobox", { name: "Status for Invited Professional" }).selectOption("inactive");
    const membership = page.locator("form").filter({ has: page.getByRole("heading", { name: "Invited Professional", exact: true }) });
    const [saved] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().includes("/members/")),
      membership.getByRole("button", { name: "Save access", exact: true }).click(),
    ]);
    expect(saved.status()).toBe(204);
    await expect(page.getByRole("combobox", { name: "Status for Invited Professional" })).toHaveValue("inactive");
    await invitee.reload();
    await expect(invitee.getByText("You do not have access to this workspace.", { exact: false })).toBeVisible();
    await expect(invitee.getByRole("heading", { name: "Independent Organization", exact: true })).toHaveCount(0);
  } finally { await context.close(); }
});

async function beginPasswordReset(page: Page) {
  const email = `expiry-${randomUUID()}@example.test`;
  await page.goto("/signup?role=professional");
  await page.getByRole("textbox", { name: "Full name" }).fill("Expiry Test Account");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByLabel(/^Password/).fill("initial test password");
  await page.getByRole("button", { name: "SUBMIT", exact: true }).click();
  await expect(page).toHaveURL(/\/verify-email$/);
  await page.goto("/forgot-password");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  const issued = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/auth/forgot-password"));
  await page.getByRole("button", { name: "SEND RESET CODE", exact: true }).click();
  const metadata = (await (await issued).json()).data;
  const code = await delivered(email, "Your Skillora password reset code");
  for (let i = 0; i < 6; i++) await page.locator(`[data-otp-index="${i}"]`).fill(code[i]);
  await page.getByRole("button", { name: "VERIFY CODE", exact: true }).click();
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.getByRole("timer")).toBeVisible();
  return metadata.expires_at as string;
}

test("reset countdown redirects a sleeping page and requires a fresh code request", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", (request) => { if (request.method() === "POST" && request.url().endsWith("/auth/forgot-password")) writes.push(request.url()); });
  const expiresAt = await beginPasswordReset(page);
  await page.getByLabel(/^New password/).fill("unsent private draft");
  await page.clock.install();
  // Advance only this browser's clock. Server expiry is separately verified by Laravel tests.
  await page.clock.setSystemTime(new Date(Date.parse(expiresAt) + 1));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page).toHaveURL(/\/forgot-password\?reason=reset-expired$/);
  await expect(page.getByRole("alert").filter({ hasText: "Your password reset session" })).toContainText("Request a new code to continue.");
  await expect(page.getByLabel(/^New password/)).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Email address" })).toBeVisible();
  await expect(page.getByRole("button", { name: "SEND RESET CODE", exact: true })).toBeVisible();
  expect(writes).toHaveLength(1); // Expiry never sends another code automatically.
});

test("backend recovery invalidation redirects even before the countdown reaches zero", async ({ page, context }) => {
  await beginPasswordReset(page);
  await expect(page.getByRole("timer")).not.toHaveText("00:00");
  const headers = { Origin: "http://localhost:3400", Accept: "application/json" };
  await context.request.get("http://localhost:8001/sanctum/csrf-cookie", { headers });
  const cookie = (await context.cookies("http://localhost:8001")).find((item) => item.name === "XSRF-TOKEN");
  const logout = await context.request.post("http://localhost:8001/api/v1/auth/logout", { headers: { ...headers, "X-XSRF-TOKEN": decodeURIComponent(cookie?.value ?? "") } });
  expect(logout.status()).toBe(204);
  await page.getByLabel(/^New password/).fill("replacement password");
  await page.getByLabel(/^Confirm new password/).fill("replacement password");
  await page.getByRole("button", { name: "RESET PASSWORD", exact: true }).click();
  await expect(page).toHaveURL(/\/forgot-password\?reason=reset-expired$/);
  await expect(page.getByRole("alert").filter({ hasText: "Your password reset session" })).toContainText("Request a new code to continue.");
  await expect(page.getByLabel(/^New password/)).toHaveCount(0);
});

test("typing another app URL abandons reset permission while same-step refresh remains valid", async ({ page, context }) => {
  await beginPasswordReset(page);
  await page.reload();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.goto("/login");
  await expect(page).toHaveURL(/\/verify-email$/); // The fixture account has not verified its email.
  const state = await context.request.get("http://localhost:8001/api/v1/auth/recovery", { headers: { Origin: "http://localhost:3400", Accept: "application/json" } });
  expect((await state.json()).data.step).toBe("email");
  await page.goto("/reset-password");
  await expect(page).toHaveURL(/\/forgot-password\?reason=reset-expired$/);
  await expect(page.getByLabel(/^New password/)).toHaveCount(0);
});

test("prefetching preserves reset but clicking away and browser Back cannot restore it", async ({ page }) => {
  await beginPasswordReset(page);
  await page.request.get("http://localhost:3400/", { headers: { "next-router-prefetch": "1" } });
  await page.reload();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.getByRole("link", { name: "Skillora home", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3400/");
  await expect(page.getByRole("status").filter({ hasText: "Closing your previous" })).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/forgot-password\?reason=reset-expired$/);
  await expect(page.getByLabel(/^New password/)).toHaveCount(0);
});

test("activating a login document bypassed by prefetch checks still abandons reset", async ({ page, context }) => {
  await beginPasswordReset(page);
  const url = "http://localhost:3400/login?role=professional";
  // A speculative fetch must preserve recovery. Deliver the activated document
  // through that same server-side exclusion and require the client to reconcile.
  // Continue real loopback traffic: fulfilling cached HTML in Chromium changes
  // address-space classification and blocks the real cross-port Laravel calls.
  const preload = await context.request.get(url, { headers: { "sec-fetch-dest": "document", "sec-purpose": "prefetch;prerender" } });
  expect(preload.status()).toBe(200);
  const status = () => context.request.get("http://localhost:8001/api/v1/auth/recovery", { headers: { Origin: "http://localhost:3400", Accept: "application/json" } });
  expect((await (await status()).json()).data.step).toBe("password");
  await page.route(url, (route) => route.continue({ headers: { ...route.request().headers(), "sec-purpose": "prefetch;prerender" } }));
  const reconciled = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/auth/recovery/navigation"));
  await page.goto(url);
  expect((await reconciled).status()).toBe(204);
  await expect(page).toHaveURL(/\/verify-email$/);
  expect((await (await status()).json()).data.step).toBe("email");
  await page.goto("/reset-password");
  await expect(page).toHaveURL(/\/forgot-password\?reason=reset-expired$/);
  await expect(page.getByLabel(/^New password/)).toHaveCount(0);
});

test("typing an API document URL consumes reset permission without treating asset fetches as departure", async ({ page, context }) => {
  await beginPasswordReset(page);
  await page.request.get("http://localhost:3400/api/health");
  await page.reload();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.goto("/api/health");
  const state = await context.request.get("http://localhost:8001/api/v1/auth/recovery", { headers: { Origin: "http://localhost:3400", Accept: "application/json" } });
  expect((await state.json()).data.step).toBe("email");
  await page.goto("/reset-password");
  await expect(page).toHaveURL(/\/forgot-password\?reason=reset-expired$/);
  await expect(page.getByLabel(/^New password/)).toHaveCount(0);
});

test("professional and employer entry points stay separate after switching portals", async ({ page }) => {
  await page.goto("/login?role=recruiter");
  await expect(page).toHaveURL(/\/employer\/login$/);
  await expect(page.getByText("Sign in with your employer account.")).toBeVisible();
  await page.goto("/login");
  await expect(page.getByText("Sign in with your professional account.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Create a profile" })).toHaveAttribute("href", "/signup?role=professional");
  await page.goto("/signup?role=recruiter");
  await expect(page).toHaveURL(/\/employer\/register$/);
  await expect(page.getByRole("textbox", { name: "Mobile number" })).toBeVisible();
  await page.goto("/signup");
  await expect(page.getByRole("textbox", { name: "Full name" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Mobile number" })).toHaveCount(0);
});
