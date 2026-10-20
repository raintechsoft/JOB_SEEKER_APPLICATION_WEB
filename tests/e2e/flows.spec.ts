import { expect, test, type Page } from "@playwright/test";

/** Collects uncaught page errors and console errors for the whole test. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

const toast = (page: Page) => page.locator("#toasts .toast").last();

/** Navigates and waits until React has hydrated the page. */
async function open(page: Page, url: string) {
  await page.goto(url);
  await page.locator("html[data-hydrated=true]").waitFor();
}

test.describe("navigation", () => {
  test("public pages, demo login, workspace nav, back/forward and deep links", async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, "/");
    await expect(page.getByRole("heading", { level: 1, name: /There’s more to you/ })).toBeVisible();
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "How it works" }).click();
    await expect(page).toHaveURL(/\/how-it-works$/);
    await open(page, "/login?role=professional");
    await page.getByRole("button", { name: "Professional demo" }).click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    await expect(page.locator("body")).toHaveClass(/professional-theme/);
    await expect(toast(page)).toHaveText("Welcome to your professional demo workspace.");

    const nav = page.getByRole("navigation", { name: "Professional workspace" });
    await nav.getByRole("link", { name: "Projects" }).click();
    await expect(page).toHaveURL(/\/app\/projects$/);
    await expect(nav.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");
    await page.goBack();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/app\/projects$/);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible();

    await open(page, "/app/messages");
    await expect(page.locator("body")).toHaveClass(/messaging-page/);
    await open(page, "/does-not-exist");
    await expect(page.getByText("This chapter hasn’t been written.")).toBeVisible();
    expect(errors.filter((e) => !e.includes("404"))).toEqual([]);
  });
});

test.describe("feed", () => {
  test("like, comment, save and filter", async ({ page }) => {
    await open(page, "/app/dashboard");
    const post = page.locator("#feed-post-maya");
    await expect(post).toBeVisible();
    const counts = post.locator(".feed-social-counts button").first();
    await expect(counts).toContainText("46");
    await post.locator(".feed-post-actions").getByRole("button", { name: "Like" }).click();
    await expect(counts).toContainText("47 · You liked this");

    await post.getByRole("button", { name: "Comment", exact: true }).click();
    await post.getByRole("textbox", { name: "Write a comment" }).fill("Lovely type choices.");
    await post.getByRole("button", { name: "Post comment" }).click();
    await expect(post.locator(".feed-comment-bubble")).toContainText("Lovely type choices.");
    await expect(toast(page)).toHaveText("Comment saved locally.");

    await post.locator(".feed-post-actions").getByRole("button", { name: "Save" }).click();
    await expect(toast(page)).toHaveText("Saved. Find it in your Saved feed.");
    await page.getByRole("tab", { name: "Saved" }).click();
    await expect(page.locator(".feed-post")).toHaveCount(1);
    await expect(page.locator(".feed-results-label")).toContainText("1 saved posts");

    await page.getByRole("tab", { name: "Jobs" }).click();
    await expect(page.locator(".feed-job-post")).toHaveCount(3);
  });

  test("header search filters the feed", async ({ page }) => {
    await open(page, "/app/projects");
    const search = page.getByRole("searchbox", { name: "Search your feed" });
    await search.fill("sunday");
    await search.press("Enter");
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    await expect(page.locator(".feed-search-status")).toContainText("Results for “sunday”");
    await expect(page.locator("#feed-post-maya")).toBeVisible();
  });
});

test.describe("jobs and applications", () => {
  test("apply to a job and track it", async ({ page }) => {
    await open(page, "/app/dashboard");
    await page.locator(".rail-job").first().getByRole("button", { name: /View opportunity/ }).click();
    const dialog = page.locator("dialog#modal");
    await expect(dialog.getByRole("heading", { name: "Product Designer" })).toBeVisible();
    await dialog.getByRole("button", { name: "Apply in demo" }).click();
    await dialog.getByRole("button", { name: "Save demo application" }).click();
    await expect(toast(page)).toHaveText("Demo application saved locally. Nothing was sent to an employer.");
    await open(page, "/app/applications");
    const record = page.locator(".application-record");
    await expect(record).toHaveCount(1);
    await record.getByRole("button", { name: "Update tracking" }).click();
    await dialog.getByRole("combobox", { name: "Current status" }).selectOption("Interview");
    await dialog.getByRole("button", { name: "Save tracking" }).click();
    await expect(record.locator(".application-status")).toHaveText("Interview");
    await page.getByRole("combobox", { name: "Application status" }).selectOption("Offer");
    await expect(page).toHaveURL(/status=Offer/);
    await expect(page.getByText("No matching records.")).toBeVisible();
  });

  test("create a job alert from the rail", async ({ page }) => {
    await open(page, "/app/dashboard");
    await page.getByRole("button", { name: "Create a job alert" }).click();
    const dialog = page.locator("dialog#modal");
    await dialog.getByRole("textbox", { name: "Alert name" }).fill("Frontend roles");
    await dialog.getByRole("textbox", { name: "Job title or skills" }).fill("React");
    await dialog.getByRole("button", { name: "Save alert" }).click();
    await expect(page.locator(".rail-alert")).toContainText(["Product Designer", "Frontend roles"]);
  });
});

test.describe("creation flows", () => {
  test("publish a post through the 3-step editor", async ({ page }) => {
    await open(page, "/app/posts/new?mode=post");
    await page.getByRole("textbox", { name: "Post title" }).fill("Shipping week");
    await page.getByRole("textbox", { name: "Your story" }).fill("We shipped the onboarding redesign.");
    await expect(page.locator("#post-live-preview h3")).toHaveText("Shipping week");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Media & project", level: 2 })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Publish demo post" }).click();
    await expect(page).toHaveURL(/\/app\/dashboard\?post=/);
    await expect(page.locator(".feed-post.is-highlighted h3").first()).toHaveText("Shipping week");
  });

  test("record a work update with validation", async ({ page }) => {
    await open(page, "/app/work-pulse");
    await page.getByRole("button", { name: "Record an update" }).click();
    const dialog = page.locator("dialog#modal");
    await dialog.getByRole("textbox", { name: "Update title" }).fill("Accessibility audit");
    await dialog.getByRole("textbox", { name: "The story behind it" }).fill("Audited the checkout flow.");
    await dialog.getByRole("textbox", { name: "Skills (comma separated)" }).fill(" , ");
    await dialog.getByRole("button", { name: "Publish update" }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox", { name: "Skills (comma separated)" }).fill("Accessibility");
    await dialog.getByRole("button", { name: "Publish update" }).click();
    await expect(toast(page)).toHaveText("Work update saved. Your Work Pulse is up to date.");
    await expect(page.locator(".activity-item h3").first()).toHaveText("Accessibility audit");
  });
});

test.describe("recruiter", () => {
  test("generate a job with the template generator and publish it", async ({ page }) => {
    await open(page, "/recruiter/jobs/new");
    await page.getByRole("button", { name: "Create with AI" }).click();
    const dialog = page.locator("dialog#modal");
    await dialog.getByRole("textbox", { name: "Role name" }).fill("Data Analyst");
    await dialog.getByRole("spinbutton", { name: "Minimum annual salary" }).fill("8");
    await dialog.getByRole("spinbutton", { name: "Maximum annual salary" }).fill("12");
    await dialog.getByRole("textbox", { name: "Job location" }).fill("Pune, India");
    await dialog.getByRole("button", { name: "Generate draft" }).click();
    await expect(page.getByText("Your demo draft is ready")).toBeVisible();
    // The verification checkbox is required, so publishing is blocked until it is checked.
    await page.getByRole("button", { name: "Publish job" }).click();
    await expect(page).toHaveURL(/\/recruiter\/jobs\/new$/);
    await page.getByRole("checkbox", { name: /I’ve checked the job details/ }).check();
    await page.getByRole("button", { name: "Publish job" }).click();
    await expect(page).toHaveURL(/\/recruiter\/applications$/);
    await expect(page.locator(".managed-job-card").first()).toContainText("Data Analyst");
  });

  test("review responses: filter by stage and shortlist", async ({ page }) => {
    await open(page, "/recruiter/applications?view=responses");
    await expect(page.locator(".response-candidate")).toHaveCount(3);
    await page.locator(".response-candidate").first().getByRole("button", { name: "Shortlist" }).click();
    await expect(toast(page)).toHaveText("1 response updated.");
    await page.getByRole("link", { name: /^Shortlisted/ }).click();
    await expect(page).toHaveURL(/stage=Shortlisted/);
    await expect(page.locator(".response-candidate")).toHaveCount(1);
  });

  test("discover talent and save to a shortlist", async ({ page }) => {
    await open(page, "/recruiter/discover");
    await page.getByRole("searchbox", { name: /Search talent/ }).fill("react");
    await expect(page.locator(".talent-card")).toHaveCount(2);
    await page.locator(".talent-card").first().getByRole("button", { name: /Save to shortlist|Manage saved candidate/ }).click();
    const dialog = page.locator("dialog#modal");
    await dialog.getByRole("checkbox", { name: /Frontend Developers/ }).check();
    await dialog.getByRole("button", { name: "Save selection" }).click();
    await expect(toast(page)).toHaveText("Shortlists updated.");
  });

  test("organization editor validates and saves", async ({ page }) => {
    await open(page, "/recruiter/company");
    // Native constraints match the prototype; schema rules (http/https only) surface in the summary.
    const website = page.getByRole("textbox", { name: "Website URL" });
    await website.fill("ftp://northstar.example");
    await page.locator(".org-panel-footer").getByRole("button", { name: "Save Changes" }).click();
    await expect(page.locator(".org-error-summary")).toContainText("Use a complete HTTP or HTTPS URL.");
    await website.fill("https://northstar.example");
    await page.getByRole("textbox", { name: "Organization name" }).fill("Northstar Studio");
    await expect(page.locator("#org-save-state")).toHaveText("Unsaved changes");
    await page.locator(".org-panel-footer").getByRole("button", { name: "Save Changes" }).click();
    await expect(toast(page)).toHaveText("Organization profile saved in this browser.");
    await expect(page.locator("#org-save-state")).toHaveText("All changes saved in this browser");
  });
});

test.describe("messaging", () => {
  test("send a message", async ({ page }) => {
    await open(page, "/app/messages");
    await page.getByRole("textbox", { name: "Write a message" }).fill("Happy to chat on Friday.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.locator(".message-entry.is-own").last()).toContainText("Happy to chat on Friday.");
    await expect(toast(page)).toHaveText("Message saved locally. It has not been sent to a real person.");
  });
});

test.describe("employer registration", () => {
  test("completes the five steps with the on-screen demo OTP", async ({ page }) => {
    await open(page, "/employer/register");
    await page.getByRole("textbox", { name: "Mobile number" }).fill("9876543210");
    await page.getByRole("button", { name: "Submit" }).click();
    const enterOtp = async () => {
      const code = (await page.locator("[data-demo-code]").textContent())!.trim();
      await page.locator('[data-otp-index="0"]').focus();
      await page.keyboard.insertText(code[0]);
      for (const [i, digit] of [...code].entries()) await page.locator(`[data-otp-index="${i}"]`).fill(digit);
      await page.getByRole("button", { name: "Verify & continue" }).click();
    };
    await enterOtp();
    await page.getByRole("textbox", { name: "Full name" }).fill("Riya Rao");
    await page.getByRole("textbox", { name: "Official email ID" }).fill("riya@acme.example");
    await page.getByRole("textbox", { name: "Create password" }).fill("supersecret");
    await page.getByRole("button", { name: "Continue" }).click();
    await enterOtp();
    await page.getByRole("textbox", { name: "Company", exact: true }).fill("Acme Works");
    await page.getByRole("combobox", { name: "Industry" }).selectOption("Manufacturing");
    await page.getByRole("combobox", { name: "Number of employees" }).selectOption("11–50 employees");
    await page.getByRole("textbox", { name: "Your designation" }).fill("Founder");
    await page.getByRole("textbox", { name: "Pin code" }).fill("560001");
    await page.getByRole("textbox", { name: "Company address" }).fill("1 Main Road, Bengaluru");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/recruiter\/profile$/);
    await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue("Riya Rao");
  });
});

test.describe("responsive @responsive", () => {
  for (const path of ["/", "/app/dashboard", "/app/applications", "/app/profile", "/app/messages", "/recruiter/dashboard", "/recruiter/applications?view=responses", "/recruiter/company", "/employer/register"]) {
    test(`no horizontal overflow on ${path}`, async ({ page }) => {
      await open(page, path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
