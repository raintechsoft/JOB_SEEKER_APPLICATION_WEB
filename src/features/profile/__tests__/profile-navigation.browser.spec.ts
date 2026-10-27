import { expect, test } from "@playwright/test";

test("profile sidebar displays one section and supports history, editing, and mobile", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/app/profile");
  const panel = page.locator("#profile-section-panel"),
    nav = page.getByRole("navigation", {
      name: "Profile sections",
      exact: true,
    });
  await expect(panel.locator(".profile-section-card")).toHaveCount(1);
  await expect(page.locator("#profile-resume")).toBeVisible();
  async function selectSection(hash: string) {
    const group = nav.locator(
      `.profile-navigation-group:has(a[href="${hash}"])`,
    );
    const toggle = group.getByRole("button");
    if ((await toggle.getAttribute("aria-expanded")) === "false")
      await toggle.click();
    await group.locator(`a[href="${hash}"]`).click();
  }
  await expect(nav.locator('button[aria-expanded="true"]')).toHaveCount(1);
  const sidebar = page.locator(".profile-section-navigation");
  expect(
    await nav
      .locator('a[aria-current="page"] > span')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(14);
  expect(
    await sidebar.evaluate((el) => ({
      overflow: getComputedStyle(el).overflowY,
      fits: el.scrollHeight <= el.clientHeight + 1,
    })),
  ).toEqual({ overflow: "visible", fits: true });
  const links = await nav.locator("a").evaluateAll((elements) =>
    elements.map((el) => ({
      hash: el.getAttribute("href")!,
      label: el.textContent!.trim(),
    })),
  );
  for (const link of links) {
    await selectSection(link.hash);
    await expect(panel.locator(".profile-section-card")).toHaveCount(1);
    await expect(page.locator(link.hash)).toBeVisible();
    await expect(nav.locator('[aria-current="page"]')).toHaveAttribute(
      "href",
      link.hash,
    );
  }
  await selectSection("#profile-skills");
  await selectSection("#profile-employment");
  await page.goBack();
  await expect(page.locator("#profile-skills")).toBeVisible();
  await expect(page.locator("#profile-employment")).toHaveCount(0);
  await page.goForward();
  await expect(page.locator("#profile-employment")).toBeVisible();
  await page.goto("/app/profile#profile-personal");
  await expect(page.locator("#profile-personal")).toBeVisible();
  await expect(panel.locator(".profile-section-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator("#profile-personal")).toBeVisible();
  await page.goto("/app/profile#profile-does-not-exist");
  await expect(page.locator("#profile-resume")).toBeVisible();
  await page
    .getByRole("button", { name: "Profile options", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Improve profile", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: /^Headline/ })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator("#profile-headline")).toBeVisible();
  await page
    .locator("#profile-headline")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .locator('input[name="headline"]')
    .fill("Senior Product Designer");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("#profile-headline")).toContainText(
    "Senior Product Designer",
  );
  await page.reload();
  await expect(page.locator("#profile-headline")).toContainText(
    "Senior Product Designer",
  );
  await selectSection("#profile-skills");
  await page.locator(".profile-editor-grid").screenshot({
    path: testInfo.outputPath("profile-sections-desktop.png"),
    style: ".professional-header,.skip{visibility:hidden!important}",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nav).not.toBeVisible();
  const picker = page.getByRole("combobox", {
    name: "Profile section",
    exact: true,
  });
  await expect(picker).toBeVisible();
  await picker.selectOption("education");
  await expect(page.locator("#profile-education")).toBeVisible();
  await expect(panel.locator(".profile-section-card")).toHaveCount(1);
  await page
    .locator(".profile-editor-pagination")
    .getByRole("button", { name: "Technical skills", exact: true })
    .click();
  await expect(page.locator("#profile-technical")).toBeVisible();
  await expect(picker).toHaveValue("technical");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.locator(".profile-editor-grid").screenshot({
    path: testInfo.outputPath("profile-sections-mobile.png"),
    style: ".professional-header,.skip{visibility:hidden!important}",
  });
  expect(errors).toEqual([]);
});
