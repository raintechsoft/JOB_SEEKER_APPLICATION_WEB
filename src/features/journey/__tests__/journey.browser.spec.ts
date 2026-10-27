import { expect, test } from "@playwright/test";

test("career memories persist, publish selectively, replay, and fit mobile", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/app/profile#profile-journey");
  await expect(page.locator("#profile-journey")).toBeVisible();
  // Explicit fictional history in this isolated browser context, never the user's saved profile.
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("skillora-demo-v1")!);
    const p = db.professionals[0];
    p.public = true;
    p.professionalDetails.revision = 1;
    p.professionalDetails.employment = [
      {
        id: "work-one",
        company: "Forma Studio",
        title: "Product Designer",
        start: "2024-01",
        end: "",
        current: true,
        public: true,
      },
      {
        id: "work-two",
        company: "Northstar Creative",
        title: "Visual Designer",
        start: "2022-01",
        end: "2023-12",
        current: false,
        public: true,
      },
    ];
    db.careerJourneys = {};
    localStorage.setItem("skillora-demo-v1", JSON.stringify(db));
  });
  await page.reload();
  const journey = page.locator("#profile-journey");
  await expect(
    journey.getByText("Forma Studio", { exact: true }),
  ).toBeVisible();
  await journey
    .getByRole("button", { name: "+ Add colleague", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Search people you follow").fill("Maya");
  await dialog.getByRole("radio", { name: /Maya Chen/ }).check();
  await dialog
    .getByLabel("Role or connection (optional)")
    .fill("Design teammate");
  await dialog
    .getByRole("button", { name: "Save colleague", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await journey
    .getByRole("button", { name: "Add memory", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog
    .getByLabel("Give this memory a title")
    .fill("The launch we built together");
  await dialog.getByLabel("When did it happen?").fill("2025-04-20");
  await dialog
    .getByLabel("The story (optional)")
    .fill(
      "A year of small ideas became something our whole team was proud of.",
    );
  await dialog.getByLabel("Maya Chen", { exact: true }).check();
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "team.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await dialog
    .getByLabel("Photo 1 description")
    .fill("The team celebrating launch day");
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Save privately", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await journey
    .getByRole("button", { name: /The launch we built together/ })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Maya Chen", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("img", { name: "The team celebrating launch day" }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Publish to profile", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("skillora-demo-v1")!),
      store = db.careerJourneys.p0;
    store.memories.push(
      {
        id: "reflection",
        employmentId: "work-one",
        title: "Finding my voice as a designer",
        type: "Reflection",
        date: "2024-08-12",
        story: "Learning to ask better questions.",
        public: false,
        photos: [],
        colleagueIds: [],
      },
      {
        id: "milestone",
        employmentId: "work-one",
        title: "A new chapter",
        type: "Milestone",
        date: "2024-02-01",
        story: "New faces and so much to explore.",
        public: true,
        photos: [],
        colleagueIds: [],
      },
      {
        id: "sprint",
        employmentId: "work-two",
        title: "Our first design sprint",
        type: "Moment",
        date: "2023-03-12",
        story: "Five days and dozens of ideas.",
        public: true,
        photos: [],
        colleagueIds: [],
      },
    );
    localStorage.setItem("skillora-demo-v1", JSON.stringify(db));
  });
  await page.reload();
  await expect(
    journey.getByText("Finding my voice as a designer", { exact: true }),
  ).toBeVisible();
  await journey.getByRole("button", { name: "2025", exact: true }).click();
  await expect(
    journey.getByText("Finding my voice as a designer", { exact: true }),
  ).not.toBeVisible();
  await journey.getByRole("button", { name: "All years", exact: true }).click();
  await journey
    .getByRole("button", { name: "▷ Play journey", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", {
      name: "Our first design sprint",
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(
    dialog.getByRole("heading", { name: "A new chapter", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
  });
  await journey.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await journey.screenshot({
    path: testInfo.outputPath("mobile.png"),
    style: ".professional-header,.skip-link{visibility:hidden!important}",
  });
  const slug = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("skillora-demo-v1")!).professionals[0]
        .slug,
  );
  await page.goto(`/professionals/${slug}`);
  await expect(
    page
      .locator("#profile-journey")
      .getByRole("button", { name: /The launch we built together/ }),
  ).toBeVisible();
  await expect(
    page.locator("#profile-journey").getByText("Maya Chen", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .locator("#profile-journey")
      .getByText("Finding my voice as a designer", { exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
