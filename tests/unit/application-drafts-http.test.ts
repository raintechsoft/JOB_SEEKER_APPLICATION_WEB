import {afterEach, expect, it, vi} from "vitest";
import examples from "../../../../contracts/examples/application-wizard-v2.json";
import {applicationRequirementsSchema, applicationWizardDraftValuesSchema, type ApplicationWizardValidationContext} from "@/lib/validation/application-wizard";
import {createHttpApplicationDraftService} from "@/services/applications/application-wizard.http";
import {ApiError, createHttpClient} from "@/services/api/client";

afterEach(() => vi.unstubAllGlobals());
const id = examples.context.jobId;
const context = (): ApplicationWizardValidationContext => ({...structuredClone(examples.context), requirements: applicationRequirementsSchema.parse(examples.requirements)});
const save = () => ({schemaVersion: 2, version: 1, requirementsVersion: 1, questionsVersion: 1, jobVersion: 1, step: "contact", intent: "save", values: applicationWizardDraftValuesSchema.parse(structuredClone(examples.base))});

it("rejects malformed inputs before any HTTP/session/CSRF transport", async () => {
  const http = createHttpClient("http://localhost:8000/api/v1");
  const get = vi.spyOn(http, "get"), post = vi.spyOn(http, "post"), patch = vi.spyOn(http, "patch"), remove = vi.spyOn(http, "delete");
  const service = createHttpApplicationDraftService(http);
  await expect(service.context("bad")).rejects.toThrow();
  await expect(service.read("bad")).rejects.toThrow();
  await expect(service.list({page: "1"})).rejects.toThrow();
  await expect(service.list({pageSize: 21})).rejects.toThrow();
  await expect(service.create(id, {schemaVersion: 2, creationKey: "bad"})).rejects.toThrow();
  await expect(service.discard(id, {schemaVersion: 2, version: 0})).rejects.toThrow();
  await expect(service.save(id, {...save(), reachedStep: "review"}, context())).rejects.toThrow();
  await expect(service.save(id, {...save(), intent: "advance", values: {...save().values, contact: {...save().values.contact, email: "not-an-email"}}}, context())).rejects.toThrow();
  for (const spy of [get, post, patch, remove]) expect(spy).not.toHaveBeenCalled();
  await expect(service.submit(id, {schemaVersion:2}, save().values, context())).rejects.toThrow();
  await expect(service.review("invalid")).rejects.toThrow();
  await expect(service.receipt("invalid")).rejects.toThrow();
  for (const spy of [get,post,patch,remove])expect(spy).not.toHaveBeenCalled();
  expect(service.submit).toBeTypeOf("function");
  expect(service.verify).toBeTypeOf("function");
});

it("sends the reviewed schema-2 command with its header and clears stale hiring caches only after success",async()=>{
  const http=createHttpClient("http://localhost:8000/api/v1"),onSubmitted=vi.fn();
  const receipt={id,jobId:id,schemaVersion:2,submittedAt:"2026-10-28T10:00:00Z",attachments:[],contactVerification:"recorded"};
  const post=vi.spyOn(http,"post").mockResolvedValue({data:receipt});const service=createHttpApplicationDraftService(http,onSubmitted);
  const ctx=context();const command={schemaVersion:2,draftId:id,version:1,requirementsVersion:ctx.requirements.version,questionsVersion:ctx.requirements.questionsVersion,jobVersion:ctx.requirements.jobVersion,idempotencyKey:id,acknowledgementVersion:"application-review-2",sharingAcknowledged:true,reviewHash:ctx.reviewHash};
  await expect(service.submit(id,command,save().values,ctx)).resolves.toEqual(receipt);
  expect(post).toHaveBeenCalledWith(`jobs/${id}/applications`,command,{headers:{"X-Skillora-Application-Schema":"2"}});expect(onSubmitted).toHaveBeenCalledTimes(1);
  post.mockRejectedValueOnce(new ApiError("Changed",409));await expect(service.submit(id,command,save().values,ctx)).rejects.toMatchObject({status:409});expect(onSubmitted).toHaveBeenCalledTimes(1);
});

it("sends normalized valid drafts with exact captured revisions and never retries a rejected save", async () => {
  const http = createHttpClient("http://localhost:8000/api/v1");
  const post = vi.spyOn(http, "post").mockResolvedValue({data: {id, version: 1}});
  const patch = vi.spyOn(http, "patch").mockResolvedValueOnce({data: {id, version: 2}}).mockRejectedValueOnce(new ApiError("stale", 409, {code: "application_draft_conflict", message: "Reload this draft."}));
  const service = createHttpApplicationDraftService(http);
  await service.create(id, {schemaVersion: 2, creationKey: id});
  expect(post).toHaveBeenCalledWith(`jobs/${id}/application-drafts`, {schemaVersion: 2, creationKey: id});
  const input = save();
  input.values.contact.name = "  Candidate  ";
  input.values.contact.email = " CANDIDATE@example.test ";
  const before = structuredClone(input);
  expect(await service.save(id, input, context())).toEqual({id, version: 2});
  expect(patch.mock.calls[0]).toEqual([`me/application-drafts/${id}`, {...input, values: {...input.values, contact: {name: "Candidate", email: "candidate@example.test", phone: null}}}]);
  await expect(service.save(id, input, context())).rejects.toMatchObject({status: 409});
  expect(patch).toHaveBeenCalledTimes(2);
  expect(input).toEqual(before);
});

it("reads owned summaries and sends revision-checked discard without exposing future operations", async () => {
  const http = createHttpClient("http://localhost:8000/api/v1");
  const get = vi.spyOn(http, "get").mockResolvedValue({data: {items: [], total: 0, page: 1, pageSize: 20}});
  const remove = vi.spyOn(http, "delete").mockResolvedValue(undefined);
  const service = createHttpApplicationDraftService(http);
  expect((await service.list()).total).toBe(0);
  expect(get).toHaveBeenCalledWith("me/application-drafts", {page: 1, pageSize: 20});
  await service.discard(id, {schemaVersion: 2, version: 3});
  expect(remove).toHaveBeenCalledWith(`me/application-drafts/${id}`, {schemaVersion: 2, version: 3});
});

it("establishes the actor for private job application context without changing public job reads", async () => {
  const fetcher = vi.fn().mockImplementation(async (url: string | URL) => {
    const pathname = new URL(String(url)).pathname;
    return new Response(JSON.stringify({data: pathname.endsWith("/auth/me") ? {user: {id}} : {jobId: id}}), {status: 200, headers: {"Content-Type": "application/json"}});
  });
  vi.stubGlobal("fetch", fetcher);
  const publicHttp = createHttpClient("http://localhost:8000/api/v1");
  await publicHttp.get(`jobs/${id}`);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(String(fetcher.mock.calls[0][0])).not.toContain("auth/me");
  fetcher.mockClear();
  const service = createHttpApplicationDraftService(createHttpClient("http://localhost:8000/api/v1"));
  await service.context(id);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(String(fetcher.mock.calls[0][0])).toContain("auth/me");
  expect(fetcher.mock.calls[1][1].headers).toMatchObject({"X-Skillora-User": id});
});
