import {describe, expect, it, vi} from "vitest";
import examples from "../../contracts/examples/application-wizard-v2.json";
import policy from "../../contracts/validation/application-wizard.json";
import spec from "../../contracts/openapi/application-wizard-v2.json";
import {applicationContactChallengeSchema, applicationContactVerifySchema, applicationDraftSaveSchema, applicationRequirementsSchema, applicationSubmitRequestSchema, applicationWizardDraftValuesSchema, applicationWizardStageSchema, type ApplicationStep, type ApplicationWizardValidationContext} from "@/lib/validation/application-wizard";
import {applicationReturnPath, applicationSteps, applicationWizardPath, emptyApplicationWizardValues, legacyExpectedCompensation, portfolioReady} from "@/lib/domain/application-wizard";
import {createApplicationWizardCommands, type ApplicationWizardTransport} from "@/services/applications/application-wizard.service";
import type {components} from "@/types/generated/application-wizard-v2";

const id = examples.context.jobId;
const values = () => applicationWizardDraftValuesSchema.parse(structuredClone(examples.base));
const context = (): ApplicationWizardValidationContext => ({...structuredClone(examples.context), requirements: applicationRequirementsSchema.parse(examples.requirements)});
const save = () => ({schemaVersion: 2, version: 1, requirementsVersion: 1, questionsVersion: 1, jobVersion: 1, step: "contact", intent: "save", values: values()});
const submit = () => ({schemaVersion: 2, draftId: id, version: 1, requirementsVersion: 1, questionsVersion: 1, jobVersion: 1, idempotencyKey: id, acknowledgementVersion: policy.acknowledgementVersion, sharingAcknowledged: true, reviewHash: "a".repeat(64)});
function patched(patch: Record<string, unknown>) {
  const base = structuredClone(examples.base);
  const result: Record<string, unknown> = {...base, ...patch};
  for (const key of ["contact", "documents", "details"] as const) if (key in patch) result[key] = {...base[key], ...(patch[key] as object)};
  return result;
}
describe("shared A1 structural and client semantic examples", () => {
  it.each(examples.cases)("$name", test => {
    const ctx = {...context(), ...test.contextPatch, requirements: applicationRequirementsSchema.parse({...examples.requirements, ...test.requirementsPatch})};
    const schema = test.mode === "draft" ? applicationWizardDraftValuesSchema : applicationWizardStageSchema(ctx, test.mode as ApplicationStep);
    expect(schema.safeParse(patched(test.patch)).success).toBe(test.valid);
  });
});
it("validates before every unconnected mutation port and retains accepted values without transmitting client proof", async () => {
  const transport = {create: vi.fn().mockResolvedValue({}), save: vi.fn().mockResolvedValue({}), discard: vi.fn().mockResolvedValue({}), challenge: vi.fn().mockResolvedValue({}), verify: vi.fn().mockResolvedValue({}), submit: vi.fn().mockResolvedValue({})} satisfies ApplicationWizardTransport;
  const commands = createApplicationWizardCommands(transport);
  expect(() => commands.create("bad", {schemaVersion: 2, creationKey: id})).toThrow();
  expect(() => commands.save(id, {...save(), values: {...values(), owner: id}}, context())).toThrow();
  expect(() => commands.save(id, {...save(), intent: "advance", requirementsVersion: 2}, context())).toThrow();
  expect(() => commands.save(id, {...save(), intent: "advance", values: emptyApplicationWizardValues()}, context())).toThrow();
  expect(() => commands.challenge(id, {schemaVersion: 2, kind: "phone", phone: {country: "IN", nationalNumber: "......."}})).toThrow();
  expect(() => commands.verify(id, id, {schemaVersion: 2, code: "12345"})).toThrow();
  expect(() => commands.discard(id, {schemaVersion: 2, version: 0})).toThrow();
  expect(() => commands.submit(id, {...submit(), verified: true}, values(), context())).toThrow();
  expect(() => commands.submit(id, submit(), emptyApplicationWizardValues(), context())).toThrow();
  expect(() => commands.submit(id, {...submit(), reviewHash: "b".repeat(64)}, values(), context())).toThrow();
  for (const method of Object.values(transport)) expect(method).not.toHaveBeenCalled();
  const incomplete = {...save(), values: emptyApplicationWizardValues()};
  await commands.save(id, incomplete, context());
  expect(transport.save).toHaveBeenCalledWith(id, incomplete);
  await commands.submit(id, submit(), values(), context());
  expect(transport.submit).toHaveBeenCalledWith(id, submit());
  expect(transport.submit.mock.calls[0][1]).not.toHaveProperty("values");
  expect(transport.submit.mock.calls[0][1]).not.toHaveProperty("verifiedEmails");
});
it("rejects forged payload keys, stale context, missing acknowledgement and unsafe version types", () => {
  for (const patch of [{sharingAcknowledged: false}, {acknowledgementVersion: "old"}, {version: "1"}, {version: 0}, {draftId: "bad"}, {values: values()}, {idempotencyKey: "bad"}]) expect(applicationSubmitRequestSchema.safeParse({...submit(), ...patch}).success).toBe(false);
  expect(applicationDraftSaveSchema.safeParse({...save(), reachedStep: "review"}).success).toBe(false);
  expect(applicationContactChallengeSchema.safeParse({schemaVersion: 2, kind: "email", email: "candidate@example.test", verified: true}).success).toBe(false);
  expect(applicationContactVerifySchema.safeParse({schemaVersion: 2, code: "123456", expiresAt: "2099-01-01"}).success).toBe(false);
});
it("normalizes contact and text, bounds Unicode bytes and keeps optional zero distinct from missing", () => {
  const result = applicationWizardDraftValuesSchema.parse({...values(), contact: {name: "  Synthetic  ", email: " CANDIDATE@example.test ", phone: null}, details: {...values().details, noticeDays: 0}});
  expect(result.contact).toEqual({name: "Synthetic", email: "candidate@example.test", phone: null});
  expect(result.details.noticeDays).toBe(0);
  expect(emptyApplicationWizardValues().details.noticeDays).toBeNull();
  const large = {...values(), contact: {...values().contact, name: "😀".repeat(150)}, details: {...values().details, introduction: "😀".repeat(1500), preferredLocations: Array.from({length: 10}, (_, i) => `${i}${"😀".repeat(199)}`)}, answers: Object.fromEntries(Array.from({length: 6}, (_, i) => [`00000000-0000-4000-8000-00000000002${i}`, "😀".repeat(1000)]))};
  expect(applicationWizardDraftValuesSchema.safeParse(large).success).toBe(false);
});
it("uses stable conditional step names and prevents external or escaped return routes", () => {
  const ctx = context();
  expect(applicationSteps(ctx.requirements)).toEqual(policy.steps);
  expect(applicationSteps({...ctx.requirements, questions: []})).toEqual(["contact", "documents", "details", "review"]);
  for (const destination of ["https://evil.test", "//evil.test", "/\\evil.test", "/app/jobs#secret", "/app/jobs/../../login", "/app/%2f%2fevil.test", "/employer/login"]) expect(applicationReturnPath(destination)).toBe("/app/jobs");
  expect(applicationReturnPath("/app/search?q=PHP&scope=jobs")).toBe("/app/search?q=PHP&scope=jobs");
  expect(applicationReturnPath("/app/organizations/northstar-labs")).toBe("/app/organizations/northstar-labs");
  expect(applicationReturnPath(`/jobs/${id}`)).toBe(`/jobs/${id}`);
  expect(applicationWizardPath(id, "/app/search?q=PHP")).toContain(`/app/jobs/${id}/apply?returnTo=`);
  expect(() => applicationWizardPath("../login")).toThrow();
});
it("requires meaningful shareable portfolio content without requiring a public profile", () => {
  expect(portfolioReady([{title: "Work", description: "A sufficiently detailed work example", shareable: false}])).toBe(false);
  expect(portfolioReady([{title: "Work", description: "", shareable: true}])).toBe(false);
  expect(portfolioReady([{title: "Work", description: "", url: "javascript:alert(1)", shareable: true}])).toBe(false);
  expect(portfolioReady([{title: "Work", description: "", url: "https://example.test/sample", shareable: true}])).toBe(true);
  expect(portfolioReady([{title: "Work", description: "A sufficiently detailed work example", shareable: true}])).toBe(true);
});
it("adapts legacy LPA exactly for reading without mutating historical values or inventing zero", () => {
  const legacy = {expectedSalaryLpa: "0.29"};
  expect(legacyExpectedCompensation(legacy.expectedSalaryLpa)).toEqual({currency: "INR", period: "year", amount: "29000.00"});
  expect(legacy).toEqual({expectedSalaryLpa: "0.29"});
  expect(legacyExpectedCompensation("")).toBeNull();
  expect(legacyExpectedCompensation("0")).toMatchObject({amount: "0.00"});
  expect(legacyExpectedCompensation("0.0000001")).toMatchObject({amount: "0.01"});
  expect(legacyExpectedCompensation("00.29")).toMatchObject({amount: "29000.00"});
  expect(() => legacyExpectedCompensation("0.00000001")).toThrow("without rounding");
  expect(() => legacyExpectedCompensation("10000000.01")).toThrow();
});
it("keeps generated contracts disconnected and error/purpose policies explicit", () => {
  for (const methods of Object.values(spec.paths)) for (const operation of Object.values(methods)) expect(operation["x-implemented"]).toBe(["A2", "A3", "A4", "A6"].includes(operation["x-implementation-phase"]));
  expect(policy.contact).toMatchObject({purpose: "application_contact", ttlSeconds: 300, resendSeconds: 60, maxAttempts: 5});
  expect(spec.components.schemas.ApplicationSubmit.additionalProperties).toBe(false);
  const envelope: components["schemas"]["ApplicationSubmit"] = {...submit(), schemaVersion: 2, sharingAcknowledged: true, acknowledgementVersion: "application-review-2"};
  expect(applicationSubmitRequestSchema.parse(envelope)).toEqual(envelope);
});
