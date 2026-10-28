import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// The browser test never opens the developer's physical camera.
test.use({ permissions: ["camera"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] }, trace: "off" });

async function signup(page: Page) {
  const email = `photo-${randomUUID()}@example.test`;
  await page.goto("/signup?role=professional");
  await page.getByRole("textbox", { name: "Full name" }).fill("Photo Editor Tester");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByLabel(/^Password/).fill("photo editor test password");
  await page.getByRole("button", { name: "SUBMIT", exact: true }).click();
  const folder = resolve("../api/storage/app/private/test-deliveries");
  let code = "";
  await expect.poll(() => {
    if (!existsSync(folder)) return false;
    code = readdirSync(folder).filter(f => f.endsWith(".json")).map(f => JSON.parse(readFileSync(resolve(folder, f), "utf8"))).filter(v => v.destination === email && v.subject === "Your Skillora verification code").at(-1)?.secret ?? "";
    return code.length === 6;
  }).toBe(true);
  for (let index = 0; index < 6; index++) await page.locator(`[data-otp-index="${index}"]`).fill(code[index]);
  await page.getByRole("button", { name: /^Verify email$/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await page.waitForLoadState("networkidle");
}

test("profile photo validates, crops, flips, rotates, persists, re-edits and captures from a simulated camera", async ({ page }) => {
  test.setTimeout(180000);
  const check = expect.configure({ timeout: 20000 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await signup(page);
  await page.goto("/app/profile");
  await check(page.getByRole("button", { name: "View or edit profile photo", exact: true })).toBeVisible();
  const source = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 800; canvas.height = 400;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#f00000"; context.fillRect(0, 0, 400, 400);
    context.fillStyle = "#0000f0"; context.fillRect(400, 0, 400, 400);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const writes: string[] = [];
  page.on("request", request => { if (request.method() === "POST" && /\/api\/v1\/(media(?:\/|$)|me\/profile\/assets\/portrait)/.test(request.url())) writes.push(request.url()); });
  await page.getByRole("button", { name: "View or edit profile photo", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await check(dialog.getByRole("button", { name: "Edit", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Update", exact: true }).click();
  await dialog.getByLabel("Choose a profile photo").setInputFiles({ name: "invalid.txt", mimeType: "text/plain", buffer: Buffer.from("not a photo") });
  await check(dialog.getByRole("alert")).toContainText("Choose a supported file type.");
  expect(writes).toEqual([]);
  await dialog.getByLabel("Choose a profile photo").setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: Buffer.from(source, "base64") });
  const crop = dialog.getByRole("group", { name: "Photo crop area" });
  await check(crop).toBeVisible();
  await dialog.getByRole("slider", { name: /Zoom/ }).fill("1.5");
  await crop.focus(); await page.keyboard.press("ArrowRight");
  await dialog.getByRole("button", { name: "Flip", exact: true }).click();
  await check(dialog.getByRole("button", { name: "Flip", exact: true })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Rotate", exact: true }).click();
  expect(writes).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await dialog.screenshot({ path: "test-results/profile-photo-editor-mobile.png" });
  const saved = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith("/me/profile/assets/portrait"));
  await dialog.getByRole("button", { name: "Save photo", exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await check(dialog).not.toBeVisible();
  const avatar = page.getByRole("button", { name: "View or edit profile photo", exact: true }).locator("img");
  await check(avatar).toHaveAttribute("src", /\/media\/.+\/download$/);
  const photoUrl = await avatar.getAttribute("src");
  // Verify real canvas pixels, dimensions and rotation, rather than only checking a request succeeded.
  const pixels = await page.evaluate(async url => {
    const image = new Image(); image.crossOrigin = "use-credentials"; image.src = url!; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
    const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
    return { width: image.naturalWidth, height: image.naturalHeight, top: [...context.getImageData(256, 80, 1, 1).data], bottom: [...context.getImageData(256, 430, 1, 1).data] };
  }, photoUrl);
  expect(pixels.width).toBe(512); expect(pixels.height).toBe(512);
  expect(pixels.top[2]).toBeGreaterThan(180); expect(pixels.top[0]).toBeLessThan(30);
  expect(pixels.bottom[0]).toBeGreaterThan(180); expect(pixels.bottom[2]).toBeLessThan(30);
  await page.waitForLoadState("networkidle"); await page.reload();
  await check(avatar).toHaveAttribute("src", photoUrl!);
  await page.getByRole("button", { name: "View or edit profile photo", exact: true }).click();
  await check.poll(() => dialog.locator("img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await dialog.screenshot({ path: "test-results/profile-photo-preview-mobile.png" });
  await dialog.getByRole("button", { name: "Edit", exact: true }).click();
  await check(crop).toBeVisible();
  await dialog.getByRole("button", { name: "Rotate", exact: true }).click();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await check(dialog).not.toBeVisible();
  await check(page.getByRole("button", { name: "Discard changes" })).toHaveCount(0);
  await check(avatar).toHaveAttribute("src", photoUrl!);
  await page.getByRole("button", { name: "View or edit profile photo", exact: true }).click();
  await dialog.getByRole("button", { name: "Update", exact: true }).click();
  await dialog.getByRole("button", { name: "Use camera", exact: true }).click();
  await check(dialog.getByRole("button", { name: "Take photo", exact: true })).toBeEnabled();
  await page.evaluate(() => {
    const video = document.querySelector("video")!;
    (window as unknown as { photoTestTrack: MediaStreamTrack }).photoTestTrack = (video.srcObject as MediaStream).getVideoTracks()[0];
  });
  await dialog.getByRole("button", { name: "Take photo", exact: true }).click();
  await check(crop).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { photoTestTrack: MediaStreamTrack }).photoTestTrack.readyState)).toBe("ended");
  const captured = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith("/me/profile/assets/portrait"));
  await dialog.getByRole("button", { name: "Save photo", exact: true }).click(); expect((await captured).ok()).toBe(true);
  await check(dialog).not.toBeVisible(); await check(avatar).not.toHaveAttribute("src", photoUrl!);
  await page.getByRole("button", { name: "View or edit profile photo", exact: true }).click();
  await dialog.getByRole("button", { name: "Remove photo", exact: true }).click();
  await dialog.getByRole("button", { name: "Remove photo", exact: true }).click();
  await check(dialog).not.toBeVisible(); await check(avatar).toHaveCount(0);
  await check(page.getByRole("button", { name: "View or edit profile photo", exact: true })).toContainText("PE");
  expect(errors).toEqual([]);
});
