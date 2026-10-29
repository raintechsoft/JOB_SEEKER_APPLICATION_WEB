import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {ApplicationDocumentsStep} from "@/components/applications/application-documents-step";
import {createApplicationDocumentService, validateApplicationResume, type ApplicationDocumentContext} from "@/services/applications/application-documents.http";
import {ApiError, createHttpClient} from "@/services/api/client";
import {getMediaPolicy, mediaRules, setMediaPolicy} from "@/lib/validation/profile";

const id = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const resume = {id, name: "saved.pdf", mime: "application/pdf", bytes: 123, state: "accepted" as const};
const uploaded = {id: other, url: `http://localhost:8000/api/v1/media/${other}/download`, name: "new.pdf", bytes: 123};
const pdf = () => new File(["%PDF-1.4 synthetic"], "new.pdf", {type: "application/pdf"});
const context = (): ApplicationDocumentContext => ({draftId: id, version: 1, requirements: {requireResume: false, requirePortfolio: false}, resume: null, savedResume: resume, library: [], resumeIssue: null, includePortfolio: false, portfolio: {title: "Portfolio", ready: false, sections: [], items: [], totalItems: 0}});
const props = () => ({context: context(), service: {uploadResume: vi.fn().mockResolvedValue(uploaded), previewResume: vi.fn().mockResolvedValue(new Blob(["%PDF-1.4"], {type: "application/pdf"}))}, onResume: vi.fn().mockResolvedValue(undefined), onPortfolio: vi.fn().mockResolvedValue(undefined)});

beforeEach(() => {
  vi.stubGlobal("URL", Object.assign(URL, {createObjectURL: vi.fn().mockReturnValue("blob:synthetic-resume"), revokeObjectURL: vi.fn()}));
});
afterEach(() => {cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();});

it("rejects cardinality, empty, wrong-type and oversized files before any upload or HTTP operation", async () => {
  const http = createHttpClient("http://localhost:8000/api/v1");
  const get = vi.spyOn(http, "get"), post = vi.spyOn(http, "post"), blob = vi.spyOn(http, "blob");
  const media = {upload: vi.fn(), remove: vi.fn()};
  const service = createApplicationDocumentService(http, media);
  const huge = pdf(); Object.defineProperty(huge, "size", {value: mediaRules.resume.max + 1});
  for (const files of [[], [pdf(), pdf()], [new File([], "empty.pdf", {type: "application/pdf"})], [new File(["x"], "bad.exe", {type: "application/pdf"})], [new File(["x"], "bad.pdf", {type: "text/html"})], [huge]]) await expect(service.uploadResume(files)).rejects.toThrow();
  await expect(service.context("bad")).rejects.toThrow();
  await expect(service.applicantDownload(id, "bad")).rejects.toThrow();
  await expect(service.reviewerDownload("bad", id, id)).rejects.toThrow();
  expect(media.upload).not.toHaveBeenCalled();
  for (const spy of [get, post, blob]) expect(spy).not.toHaveBeenCalled();
});

it("uses the runtime resume policy rather than a second hardcoded upload limit", () => {
  const old = structuredClone(getMediaPolicy());
  try {
    setMediaPolicy({...old, rules: {...old.rules, resume: [8, old.rules.resume[1], old.rules.resume[2]]}});
    expect(validateApplicationResume([pdf()])).toContain("up to");
  } finally {setMediaPolicy(old);}
});

it("uploads only an application asset and uses credentialed scoped download routes", async () => {
  const http = createHttpClient("http://localhost:8000/api/v1");
  const get = vi.spyOn(http, "get").mockResolvedValue({data: context()});
  const blob = vi.spyOn(http, "blob").mockResolvedValue(new Blob(["bytes"]));
  const post = vi.spyOn(http, "post");
  const media = {upload: vi.fn().mockResolvedValue(uploaded), remove: vi.fn()};
  const service = createApplicationDocumentService(http, media);
  const file = pdf();
  expect(await service.uploadResume([file])).toEqual(uploaded);
  expect(media.upload).toHaveBeenCalledWith(file, "resume");
  await service.context(id);
  expect(get).toHaveBeenCalledWith(`me/application-drafts/${id}/documents`);
  await service.previewResume(id);
  await service.applicantDownload(id, other);
  await service.reviewerDownload(other, id, other);
  expect(blob.mock.calls.map(call => call[0])).toEqual([`media/${id}/download`, `me/applications/${id}/attachments/${other}/download`, `organizations/${other}/hiring/responses/${id}/attachments/${other}/download`]);
  expect(post).not.toHaveBeenCalled();
  expect(media.remove).not.toHaveBeenCalled();
});

it("uploads as soon as a valid file is chosen, selects it and shows no preview", async () => {
  const p = props();
  render(<ApplicationDocumentsStep {...p}/>);
  fireEvent.change(screen.getByLabelText("Upload another resume"), {target: {files: [pdf()]}});
  await waitFor(() => expect(p.service.uploadResume).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(p.onResume).toHaveBeenCalledWith(other));
  expect(screen.queryByTitle("Resume preview")).toBeNull();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(p.onPortfolio).not.toHaveBeenCalled();
});

it("rejects invalid files locally and shows the draft-save error after upload", async () => {
  const p = props();
  p.onResume.mockRejectedValue(new ApiError("Conflict", 409, {message: "This draft changed. Reload before saving."}));
  render(<ApplicationDocumentsStep {...p}/>);
  const input = screen.getByLabelText("Upload another resume");
  fireEvent.change(input, {target: {files: [new File(["bad"], "bad.exe", {type: "application/octet-stream"})]}});
  expect(screen.getByRole("alert")).toHaveTextContent("supported file type");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input).toHaveFocus();
  expect(p.service.uploadResume).not.toHaveBeenCalled();
  fireEvent.change(input, {target: {files: [pdf()]}});
  await screen.findByText("This draft changed. Reload before saving.");
});

it("lists every resume, switches the selection and removes library files from the list", async () => {
  const older = {id: "10000000-0000-4000-8000-000000000003", name: "older.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes: 2048, state: "accepted" as const};
  const selectedUpload = {...uploaded, mime: "application/pdf", state: "accepted" as const};
  const p = {...props(), service: {...props().service, removeResume: vi.fn().mockResolvedValue({deleted: true})}};
  p.context = {...context(), resume: selectedUpload, library: [selectedUpload, older]};
  render(<ApplicationDocumentsStep {...p}/>);
  const cards = screen.getAllByRole("listitem");
  expect(cards.map((c) => c.textContent)).toEqual([expect.stringContaining("new.pdf"), expect.stringContaining("saved.pdf"), expect.stringContaining("older.docx")]);
  expect(screen.getByRole("img", {name: "Selected for this application"})).toBeInTheDocument();
  expect(screen.getByRole("button", {name: "Upload resume"})).toBeInTheDocument();
  // The saved profile resume can be chosen but not removed here.
  expect(screen.queryByRole("button", {name: "Remove saved.pdf"})).toBeNull();

  fireEvent.click(screen.getByRole("button", {name: "Use older.docx for this application"}));
  await waitFor(() => expect(p.onResume).toHaveBeenCalledWith(older.id));

  // Removing an unselected library file deletes it without touching the selection.
  fireEvent.click(screen.getByRole("button", {name: "Remove older.docx"}));
  await waitFor(() => expect(p.service.removeResume).toHaveBeenCalledWith(older.id));
  await waitFor(() => expect(screen.queryByText("older.docx")).toBeNull());
  expect(p.onResume).toHaveBeenCalledTimes(1);

  // Removing the selected file deselects it first, then removes it.
  fireEvent.click(screen.getByRole("button", {name: "Remove new.pdf"}));
  await waitFor(() => expect(p.service.removeResume).toHaveBeenCalledWith(other));
  expect(p.onResume).toHaveBeenLastCalledWith(null);
  expect(p.onResume.mock.invocationCallOrder.at(-1)).toBeLessThan(p.service.removeResume.mock.invocationCallOrder.at(-1)!);
});

it("drops a file from the list quietly when the server keeps it for another use", async () => {
  const selectedUpload = {...uploaded, mime: "application/pdf", state: "accepted" as const};
  const p = {...props(), service: {...props().service, removeResume: vi.fn().mockResolvedValue({deleted: false})}};
  p.context = {...context(), library: [selectedUpload]};
  render(<ApplicationDocumentsStep {...p}/>);
  fireEvent.click(screen.getByRole("button", {name: "Remove new.pdf"}));
  await waitFor(() => expect(screen.queryByText("new.pdf")).toBeNull());
  expect(screen.queryByRole("alert")).toBeNull();
  expect(p.onResume).not.toHaveBeenCalled();
});

it("uses saved resume only when selected and derives portfolio readiness from server context", async () => {
  const p = props();
  const view = render(<ApplicationDocumentsStep {...p}/>);
  expect(screen.getByRole("checkbox")).toBeDisabled();
  expect(p.onResume).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "Use saved.pdf for this application"}));
  await waitFor(() => expect(p.onResume).toHaveBeenCalledWith(id));
  await waitFor(() => expect(screen.getByRole("checkbox")).not.toHaveAttribute("aria-busy"));
  p.context = {...context(), portfolio: {title: "My Work", ready: true, sections: ["Featured projects"], items: [{id, kind: "project", title: "Example project", description: "Meaningful public work", url: null}], totalItems: 1}};
  view.rerender(<ApplicationDocumentsStep {...p}/>);
  await waitFor(() => expect(screen.getByRole("checkbox")).not.toBeDisabled());
  fireEvent.click(screen.getByRole("checkbox"));
  await waitFor(() => expect(p.onPortfolio).toHaveBeenCalledWith(true));
  // The portfolio preview list is no longer shown in this step.
  expect(screen.queryByText("Example project")).toBeNull();
});

it("does not attach a completed upload to a different draft after navigation", async () => {
  const p = props();
  let resolve!: (value: typeof uploaded) => void;
  p.service.uploadResume.mockImplementation(() => new Promise(done => {resolve = done;}));
  const view = render(<ApplicationDocumentsStep {...p}/>);
  fireEvent.change(screen.getByLabelText("Upload another resume"), {target: {files: [pdf()]}});
  view.rerender(<ApplicationDocumentsStep {...p} context={{...context(), draftId: other}}/>);
  await act(async () => {resolve(uploaded);});
  expect(p.onResume).not.toHaveBeenCalled();
});

it("preserves backend upload failure and never calls the draft selection callback", async () => {
  const p = props();
  p.service.uploadResume.mockRejectedValue(new ApiError("Upload failed", 422, {message: "The file failed verification."}));
  render(<ApplicationDocumentsStep {...p}/>);
  fireEvent.change(screen.getByLabelText("Upload another resume"), {target: {files: [pdf()]}});
  await screen.findByText("The file failed verification.");
  expect(p.onResume).not.toHaveBeenCalled();
});

it("allows deselecting an optional portfolio after its previously shared work is no longer ready", async () => {
  const p = props();
  p.context.includePortfolio = true;
  render(<ApplicationDocumentsStep {...p}/>);
  expect(screen.getByRole("checkbox")).not.toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  await waitFor(() => expect(p.onPortfolio).toHaveBeenCalledWith(false));
  expect(p.onResume).not.toHaveBeenCalled();
});
