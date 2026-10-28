import {mediaRules} from "@/lib/validation/profile";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PhotoEditor } from "@/components/profile/photo-editor";
import { loadProfilePhoto, exportProfilePhoto, PHOTO_FRAMES, PHOTO_SIZE, photoGeometry } from "@/lib/utils/profile-photo";
import { useModalStore } from "@/stores/modal-store";
import { useToastStore } from "@/stores/toast-store";

vi.mock("@/lib/utils/profile-photo", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/utils/profile-photo")>(),
  loadProfilePhoto: vi.fn(), exportProfilePhoto: vi.fn(),
}));
const decoded = { naturalWidth: 800, naturalHeight: 400 } as HTMLImageElement;
beforeEach(() => {
  vi.mocked(loadProfilePhoto).mockReset().mockResolvedValue(decoded);
  vi.mocked(exportProfilePhoto).mockReset().mockResolvedValue(new File(["processed"], "profile-photo.jpg", { type: "image/jpeg" }));
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:photo-preview"), revokeObjectURL: vi.fn() }));
  useModalStore.getState().show("Profile photo", null, "photo");
});
afterEach(() => { useModalStore.getState().close(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function mount(picture = "/portrait.png") {
  const onSave = vi.fn().mockResolvedValue(undefined), onRemove = vi.fn().mockResolvedValue(undefined);
  const root = render(<PhotoEditor person={{ id: "account", name: "Jordan Chen", picture }} onSave={onSave} onRemove={onRemove} />);
  return { ...root, onSave, onRemove };
}
it("opens separate edit/update choices and validates files before decoding or uploading", async () => {
  const { onSave } = mount("");
  expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Update" }));
  expect(screen.getByRole("button", { name: "Use camera" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Upload from computer" })).toBeVisible();
  const input = screen.getByLabelText("Choose a profile photo");
  for (const file of [new File(["bad"], "bad.txt", { type: "text/plain" }), new File([new Uint8Array(mediaRules.portrait.max+1)], "huge.png", { type: "image/png" })]) {
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByRole("alert")).toBeVisible();
  }
  expect(loadProfilePhoto).not.toHaveBeenCalled(); expect(onSave).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { files: [new File(["png"], "photo.png", { type: "image/png" })] } });
  expect(await screen.findByRole("group", { name: "Photo crop area" })).toBeVisible();
  expect(onSave).not.toHaveBeenCalled();
  expect(useModalStore.getState().dirty).toBe(true);
});
it("applies zoom, keyboard positioning, rotation and flip only when Save is confirmed", async () => {
  const { onSave } = mount();
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  const crop = await screen.findByRole("group", { name: "Photo crop area" });
  fireEvent.change(screen.getByRole("slider", { name: /Zoom/ }), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Rotate" }));
  fireEvent.click(screen.getByRole("button", { name: "Flip" }));
  expect(screen.getByRole("button", { name: "Flip" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.keyDown(crop, { key: "ArrowRight" });
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save photo" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(exportProfilePhoto).toHaveBeenCalledWith(decoded, { zoom: 2, rotation: 90, flipX: true, x: 5, y: 0 }, mediaRules.portrait.max, PHOTO_FRAMES.portrait, "profile-photo.jpg");
  expect(onSave.mock.calls[0][0].name).toBe("profile-photo.jpg");
  expect(useModalStore.getState().open).toBe(false);
});
it("preserves adjustments after a failed save and suppresses duplicate submissions", async () => {
  const { onSave } = mount();
  let reject!: (error: Error) => void;
  onSave.mockImplementation(() => new Promise((_yes, no) => { reject = no; }));
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  await screen.findByRole("group", { name: "Photo crop area" });
  fireEvent.change(screen.getByRole("slider", { name: /Zoom/ }), { target: { value: "1.5" } });
  const save = screen.getByRole("button", { name: "Save photo" });
  const before = useToastStore.getState().toasts.length;
  fireEvent.click(save); fireEvent.click(save);
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(useModalStore.getState().blocking).toBe(false);
  expect(useModalStore.getState().open).toBe(true);
  await act(async () => reject(new Error("Connection interrupted. Try again.")));
  expect(await screen.findByText("Connection interrupted. Try again.")).toBeVisible();
  expect(screen.getByRole("slider", { name: /Zoom/ })).toHaveValue("1.5");
  expect(useModalStore.getState().blocking).toBe(false);
  expect(useToastStore.getState().toasts.length).toBe(before);
});
it("rejects undecodable images and releases temporary URLs", async () => {
  const { onSave, unmount } = mount();
  vi.mocked(loadProfilePhoto).mockRejectedValueOnce(new Error("bad bytes"));
  fireEvent.click(screen.getByRole("button", { name: "Update" }));
  fireEvent.change(screen.getByLabelText("Choose a profile photo"), { target: { files: [new File(["invalid"], "photo.png", { type: "image/png" })] } });
  expect(await screen.findByText(/This image could not be opened/)).toBeVisible();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo-preview");
  expect(onSave).not.toHaveBeenCalled(); unmount();
});
it("requests camera access only on demand and stops a late stream after closing", async () => {
  let resolve!: (stream: MediaStream) => void;
  const getUserMedia = vi.fn(() => new Promise<MediaStream>(yes => { resolve = yes; }));
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  const stop = vi.fn();
  const { unmount, onSave } = mount();
  expect(getUserMedia).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Update" }));
  expect(getUserMedia).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Use camera" }));
  expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false }));
  unmount(); await act(async () => resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream));
  expect(stop).toHaveBeenCalledTimes(1); expect(onSave).not.toHaveBeenCalled();
});
it("shows camera denial with upload fallback and makes no save request", async () => {
  const getUserMedia = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  const { onSave } = mount();
  fireEvent.click(screen.getByRole("button", { name: "Update" }));
  fireEvent.click(screen.getByRole("button", { name: "Use camera" }));
  expect(await screen.findByText(/Camera access was denied/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Take photo" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Upload instead" })).toBeEnabled();
  expect(onSave).not.toHaveBeenCalled();
});
it("enforces the configured recruiter photo limit before decoding or upload", () => {
  const onSave = vi.fn();
  render(<PhotoEditor person={{ id: "recruiter", name: "Jordan Chen" }} purpose="recruiter_photo" onSave={onSave} onRemove={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Update" }));
  fireEvent.change(screen.getByLabelText("Choose a profile photo"), { target: { files: [new File([new Uint8Array(mediaRules.recruiter_photo.max+1)], "photo.png", { type: "image/png" })] } });
  expect(screen.getByRole("alert")).toHaveTextContent(`Choose a file up to ${mediaRules.recruiter_photo.max/1024} KB.`);
  expect(loadProfilePhoto).not.toHaveBeenCalled(); expect(onSave).not.toHaveBeenCalled();
});
it("keeps the circular crop covered at every quarter turn and extreme drag position", () => {
  for (const [width, height] of [[800, 400], [400, 800], [512, 512]]) {
    for (const rotation of [0, 90, 180, 270]) for (const zoom of [1, 1.5, 3]) for (const offset of [-10000, 0, 10000]) {
      const geometry = photoGeometry(width, height, { rotation, zoom, flipX: false, x: offset, y: offset });
      const rotatedWidth = rotation % 180 ? height : width, rotatedHeight = rotation % 180 ? width : height;
      expect(rotatedWidth * geometry.scale / 2 - Math.abs(geometry.x)).toBeGreaterThanOrEqual(PHOTO_SIZE / 2);
      expect(rotatedHeight * geometry.scale / 2 - Math.abs(geometry.y)).toBeGreaterThanOrEqual(PHOTO_SIZE / 2);
    }
  }
});
it("keeps a landscape cover crop covered at extreme drag positions", () => {
  const frame = PHOTO_FRAMES.cover;
  for (const [width, height] of [[1600, 900], [900, 1600], [2000, 400]]) {
    for (const rotation of [0, 90, 180, 270]) for (const zoom of [1, 3]) for (const offset of [-10000, 0, 10000]) {
      const geometry = photoGeometry(width, height, { rotation, zoom, flipX: false, x: offset, y: offset }, frame);
      const rotatedWidth = rotation % 180 ? height : width, rotatedHeight = rotation % 180 ? width : height;
      expect(rotatedWidth * geometry.scale / 2 - Math.abs(geometry.x)).toBeGreaterThanOrEqual(frame.width / 2);
      expect(rotatedHeight * geometry.scale / 2 - Math.abs(geometry.y)).toBeGreaterThanOrEqual(frame.height / 2);
    }
  }
});
it("offers computer upload only for organization logo and cover", () => {
  const onSave = vi.fn();
  const { unmount } = render(<PhotoEditor purpose="logo" sources="computer" onSave={onSave} onRemove={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Update" }));
  expect(screen.queryByRole("button", { name: "Use camera" })).toBeNull();
  expect(screen.getByRole("button", { name: "Upload from computer" })).toBeVisible();
  fireEvent.change(screen.getByLabelText("Choose an organization logo"), { target: { files: [new File([new Uint8Array(mediaRules.logo.max+1)], "logo.png", { type: "image/png" })] } });
  expect(screen.getByRole("alert")).toHaveTextContent(`Choose a file up to ${mediaRules.logo.max/1024} KB.`);
  expect(loadProfilePhoto).not.toHaveBeenCalled();
  unmount();
  render(<PhotoEditor purpose="cover" sources="computer" onSave={onSave} onRemove={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Update" }));
  expect(screen.queryByRole("button", { name: "Use camera" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Choose a cover image"), { target: { files: [new File([new Uint8Array(mediaRules.cover.max+1)], "cover.png", { type: "image/png" })] } });
  expect(screen.getByRole("alert")).toHaveTextContent(`Choose a file up to ${mediaRules.cover.max/1024} KB.`);
  expect(onSave).not.toHaveBeenCalled();
});
it("lets an initiated save finish after closing without closing a newer dialog",async()=>{
  const {onSave}=mount();let finish!:()=>void;
  onSave.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
  fireEvent.click(screen.getByRole('button',{name:'Edit'}));await screen.findByRole('group',{name:'Photo crop area'});
  fireEvent.click(screen.getByRole('button',{name:'Save photo'}));await waitFor(()=>expect(onSave).toHaveBeenCalledOnce());
  expect(useModalStore.getState().blocking).toBe(false);
  act(()=>{useModalStore.getState().requestClose();useModalStore.getState().show('Another dialog',null);});
  await act(async()=>{finish();});
  expect(useModalStore.getState().open).toBe(true);expect(useModalStore.getState().title).toBe('Another dialog');
});
