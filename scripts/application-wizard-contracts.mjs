import {readFileSync, writeFileSync} from "node:fs";
import openapiTS, {astToString} from "openapi-typescript";

const root = new URL("../../../", import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const policy = read("contracts/validation/application-wizard.json"), job = read("contracts/validation/job-v2.json");
const existingApplicant = read("contracts/openapi/phase-11.json").components.schemas.ApplicantProfile;
const limit = policy.limits;
const ref = name => ({$ref: `#/components/schemas/${name}`});
const text = maxLength => ({type: "string", maxLength, pattern: "^[^\\x00]*$"});
const object = (properties, required = Object.keys(properties)) => ({type: "object", properties, required, additionalProperties: false});
const enumeration = values => ({type: "string", enum: values});
const nullable = value => ({anyOf: [value, {type: "null"}]});
const integer = (minimum, maximum) => ({type: "integer", minimum, ...(maximum === undefined ? {} : {maximum})});
const array = (items, maxItems) => ({type: "array", items, maxItems});
const uuid = {type: "string", format: "uuid"}, revision = integer(1), boolean = {type: "boolean"}, date = {type: "string", format: "date-time"};
const version = {type: "integer", const: policy.schemaVersion};
const versions = {requirementsVersion: revision, questionsVersion: revision, jobVersion: revision};
const email = {...text(limit.email), pattern: policy.emailPattern, format: "email"};
const schemas = {
  ApplicationStep: enumeration(policy.steps),
  ApplicationPhone: object({country: {type: "string", pattern: "^[A-Z]{2}$"}, nationalNumber: {type: "string", pattern: "^[0-9]{4,15}$"}}),
  ApplicationExpectedPay: object({currency: nullable(enumeration(job.currencies)), period: nullable(enumeration(job.compensationPeriods)), amount: nullable({type: "string", pattern: job.moneyPattern, description: `Exact units, at most ${job.moneyMax}; no implicit conversion.`})}),
  ApplicationContactValues: object({name: text(limit.name), email: {anyOf: [email, {type: "string", const: ""}]}, phone: nullable(ref("ApplicationPhone"))}),
  ApplicationDocuments: object({resumeAssetId: nullable(uuid), includePortfolio: boolean}),
  ApplicationDetails: object({introduction: text(limit.introduction), location: text(limit.location), locality: text(limit.locality), noticeDays: nullable(integer(0, limit.noticeDays)), joiningDays: nullable(integer(0, limit.joiningDays)), industry: text(limit.industry), designation: text(limit.designation), department: text(limit.department), preferredLocations: array({...text(limit.preferredLocation), minLength: 1}, limit.preferredLocations), expectedCompensation: nullable(ref("ApplicationExpectedPay"))}),
  ApplicationAnswers: {type: "object", propertyNames: uuid, maxProperties: limit.answers, additionalProperties: text(limit.answer)},
  ApplicationQuestion: object({id: uuid, text: {...text(limit.question), minLength: 1}, type: enumeration(["text", "number", "yesno"]), required: boolean}),
  ApplicationRequirements: object({version: revision, questionsVersion: revision, jobVersion: revision, requireResume: boolean, requirePhone: boolean, requirePortfolio: boolean, questions: array(ref("ApplicationQuestion"), limit.answers)}),
  ApplicationDraftCreate: object({schemaVersion: version, creationKey: uuid}),
  ApplicationDraftDiscard: object({schemaVersion: version, version: revision}),
  ApplicationContactChallenge: {oneOf: [object({schemaVersion: version, kind: {type: "string", const: "email"}, email}), object({schemaVersion: version, kind: {type: "string", const: "phone"}, phone: ref("ApplicationPhone")})]},
  ApplicationContactVerify: object({schemaVersion: version, code: {type: "string", pattern: `^[0-9]{${policy.contact.codeLength}}$`}}),
  ApplicationSubmit: object({schemaVersion: version, draftId: uuid, version: revision, ...versions, idempotencyKey: uuid, acknowledgementVersion: {type: "string", const: policy.acknowledgementVersion}, sharingAcknowledged: {type: "boolean", const: true}, reviewHash: {type: "string", pattern: "^[a-f0-9]{64}$", description: "Server-computed fingerprint of the exact current draft/job/contact/document/profile/portfolio projection; compare again under locks, never an authorization or contact proof."}}),
  ApplicationProofStatus: object({email: object({value: {anyOf: [email, {type: "string", const: ""}]}, verified: boolean}), phone: nullable(object({e164: {type: "string", pattern: "^\\+[1-9][0-9]{3,14}$"}, verified: boolean}))}),
  ApplicationResume: object({id: uuid, name: text(180), mime: text(100), bytes: integer(1), state: enumeration(["pending", "uploaded", "accepted", "rejected"])}),
  ApplicationAttachment: object({id: uuid, name: text(180), mime: text(100), bytes: integer(1), kind: {type: "string", const: "resume"}}),
  ApplicationChallengeStatus: object({id: uuid, kind: enumeration(["email", "phone"]), maskedDestination: text(254), status: enumeration(["pending", "verified", "expired", "unavailable"]), sentAt: date, expiresAt: date, resendAt: date, serverTime: date}),
  ApplicationError: object({code: enumeration(policy.errors), message: text(1000), errors: {type: "object", additionalProperties: array(text(1000), 20)}, request_id: uuid}),
};
schemas.ApplicationValues = object({contact: ref("ApplicationContactValues"), documents: ref("ApplicationDocuments"), details: ref("ApplicationDetails"), answers: ref("ApplicationAnswers")});
schemas.ApplicationDraftSave = object({schemaVersion: version, version: revision, ...versions, step: ref("ApplicationStep"), intent: enumeration(["save", "advance"]), values: ref("ApplicationValues")});
schemas.ApplicationDraft = object({id: uuid, jobId: uuid, version: revision, ...versions, step: ref("ApplicationStep"), reachedStep: ref("ApplicationStep"), state: enumeration(["active", "submitted", "discarded", "expired"]), values: ref("ApplicationValues"), savedAt: date, expiresAt: date, submittedApplicationId: nullable(uuid)});
schemas.ApplicationWorkPreview = object({id: uuid, kind: enumeration(["project", "work_sample", "work_update"]), title: text(200), description: text(5000), url: nullable({type: "string", format: "uri"})});
// Match the existing safe submission profile, retaining public credentials and career breaks.
// Never inherit private recruitment, salary, address or additional profile fields by accident.
const safeProfileKeys = ["id", "slug", "name", "headline", "category", "location", "summary", "experience", "education", "arrangement", "website", "picture", "color", "lastActive", "years", "skills", "available", "public", "complete", "interests", "credentials"];
schemas.ApplicationReviewProfile = object(Object.fromEntries(safeProfileKeys.map(key => {
  if (!existingApplicant.properties[key]) throw new Error(`Missing safe profile contract field ${key}`);
  return [key, structuredClone(existingApplicant.properties[key])];
})), existingApplicant.required.filter(key => safeProfileKeys.includes(key)));
schemas.ApplicationReview = object({draftId: uuid, version: revision, ...versions, reviewHash: {type: "string", pattern: "^[a-f0-9]{64}$"}, values: ref("ApplicationValues"), questions: array(ref("ApplicationQuestion"), limit.answers), contactStatus: ref("ApplicationProofStatus"), resume: nullable(ref("ApplicationResume")), profile: ref("ApplicationReviewProfile"), portfolio: nullable(object({title: text(200), items: array(ref("ApplicationWorkPreview"), 100)}))});
schemas.ApplicationReceipt = object({id: uuid, jobId: uuid, schemaVersion: integer(1, 2), submittedAt: date, attachments: array(ref("ApplicationAttachment"), 1), contactVerification: enumeration(["recorded", "not_recorded"])});
schemas.ApplicationSharing = object({schemaVersion: version, expectedCompensation: nullable(schemas.ApplicationExpectedPay), verification: object({email: nullable(object({verifiedAt: date, source: enumeration(["account", "application"])})), phone: nullable(object({verifiedAt: date, source: enumeration(["account", "application"])}))}), attachments: array(schemas.ApplicationAttachment, 1), portfolio: nullable(object({title: text(200), items: array(schemas.ApplicationWorkPreview, 100)}))});
schemas.ApplicationDocumentContext = object({draftId: uuid, version: revision, requirements: object({requireResume: boolean, requirePortfolio: boolean}), resume: nullable(ref("ApplicationResume")), savedResume: nullable(ref("ApplicationResume")), library: array(ref("ApplicationResume"), 20), resumeIssue: nullable(text(500)), includePortfolio: boolean, portfolio: object({title: text(200), ready: boolean, sections: array(text(100), 10), items: array(ref("ApplicationWorkPreview"), 100), totalItems: integer(0)})});
schemas.ApplicationContext = object({jobId: uuid, title: text(150), companyName: text(150), acceptingApplications: boolean, closesAt: nullable(date), requirements: ref("ApplicationRequirements"), draft: nullable(ref("ApplicationDraft")), application: nullable(ref("ApplicationReceipt")), contactStatus: ref("ApplicationProofStatus"), profilePhone: nullable(ref("ApplicationPhone")), resume: nullable(ref("ApplicationResume")), portfolioReady: boolean, locations: array(text(100), 20)});
schemas.ApplicationDraftSummary = object({id: uuid, jobId: uuid, title: text(150), companyName: text(150), step: ref("ApplicationStep"), state: enumeration(["active", "submitted", "discarded", "expired"]), version: revision, savedAt: date, expiresAt: date});
schemas.ApplicationDraftPage = object({items: array(ref("ApplicationDraftSummary"), limit.pageSize), total: integer(0), page: integer(1), pageSize: integer(1, limit.pageSize)});
const paths = {};
function endpoint(path, method, request, response, phase, success = "200") {
  const parameters = [...path.matchAll(/\{([^}]+)\}/g)].map(match => ({name: match[1], in: "path", required: true, schema: uuid}));
  if (method === "post" && path.endsWith("/applications")) parameters.push({name: policy.compatibility.header, in: "header", required: true, schema: version});
  (paths[path] ??= {})[method] = {
    operationId: `applicationWizard_${method}_${path.replace(/[^a-zA-Z0-9]/g, "_")}`,
    "x-implemented": ["A2", "A3", "A4", "A6"].includes(phase), "x-implementation-phase": phase, security: [{sanctum: []}], parameters,
    ...(request ? {requestBody: {required: true, content: {"application/json": {schema: ref(request)}}}} : {}),
    responses: {[success]: {description: ["A2", "A3", "A4", "A6"].includes(phase) ? "Owned private draft or application-contact result" : "Planned later-phase result", ...(response ? {content: {"application/json": {schema: object({data: ref(response)})}}} : {})}, ...Object.fromEntries([401, 403, 404, 409, 412, 419, 422, 429, 503].map(status => [status, {description: "Session, authorization, actor mismatch, validation, state, throttle or delivery error; honor Retry-After when present", content: {"application/json": {schema: ref("ApplicationError")}}}]))},
  };
}
const base = "/api/v1";
endpoint(`${base}/jobs/{job}/application-context`, "get", null, "ApplicationContext", "A2");
endpoint(`${base}/jobs/{job}/application-drafts`, "post", "ApplicationDraftCreate", "ApplicationDraft", "A2", "201");
endpoint(`${base}/me/application-drafts`, "get", null, "ApplicationDraftPage", "A2");
paths[`${base}/me/application-drafts`].get.parameters.push({name: "page", in: "query", schema: integer(1)}, {name: "pageSize", in: "query", schema: integer(1, limit.pageSize)});
endpoint(`${base}/me/application-drafts/{draft}`, "get", null, "ApplicationDraft", "A2");
endpoint(`${base}/me/application-drafts/{draft}`, "patch", "ApplicationDraftSave", "ApplicationDraft", "A2");
endpoint(`${base}/me/application-drafts/{draft}`, "delete", "ApplicationDraftDiscard", null, "A2", "204");
endpoint(`${base}/me/application-drafts/{draft}/contact-challenges`, "post", "ApplicationContactChallenge", "ApplicationChallengeStatus", "A3", "202");
endpoint(`${base}/me/application-drafts/{draft}/contact-challenges/{challenge}`, "get", null, "ApplicationChallengeStatus", "A3");
endpoint(`${base}/me/application-drafts/{draft}/contact-challenges/{challenge}/verify`, "post", "ApplicationContactVerify", "ApplicationProofStatus", "A3");
endpoint(`${base}/jobs/{job}/applications`, "post", "ApplicationSubmit", "ApplicationReceipt", "A6", "201");
endpoint(`${base}/me/application-drafts/{draft}/documents`, "get", null, "ApplicationDocumentContext", "A4");
// Removes a resume from the owner's library; storage deletion happens only when nothing else uses the file.
schemas.ResumeLibraryRemoval = object({deleted: boolean});
endpoint(`${base}/me/resume-library/{asset}`, "delete", null, "ResumeLibraryRemoval", "A4");
endpoint(`${base}/me/application-drafts/{draft}/review`, "get", null, "ApplicationReview", "A6");
endpoint(`${base}/me/applications/{application}/receipt`, "get", null, "ApplicationReceipt", "A6");
endpoint(`${base}/me/applications/{application}/attachments/{attachment}/download`, "get", null, null, "A4");
endpoint(`${base}/organizations/{organization}/hiring/responses/{application}/attachments/{attachment}/download`, "get", null, null, "A4");
for (const [path, operations] of Object.entries(paths)) if (path.endsWith("/download")) {
  operations.get.responses["200"] = {description: "Authorized private streamed file; persistent storage keys are not serialized", content: {"application/octet-stream": {schema: {type: "string", format: "binary"}}}};
  operations.get.responses["302"] = {description: "Optional short-lived authorized download redirect after current access checks", headers: {Location: {required: true, schema: {type: "string", format: "uri"}}, "Cache-Control": {schema: {type: "string", const: "private, no-store"}}}};
}
const spec = {openapi: "3.1.0", info: {title: "Skillora dedicated application wizard", version: "2.0.0-a6", description: "A2–A6 private drafts, gated contacts, retained documents, full-page UI, review and transactional schema-2 submission are implemented. Live entry remains disabled until A7 release verification."}, "x-activation": "Full application journey behind a disabled live-entry flag; candidate delivery remains separately gated.", "x-semantic-rules": ["Supported-region phone parsing", "Unicode normalization/UTF-8 draft byte limit", "Exact decimal amount upper bound", "Case-insensitive distinct locations and question IDs", "Cumulative required fields and server contact/asset proof", "Current questions and type-correct answers", "Current-clock eligibility under transaction locks"], paths, components: {securitySchemes: {sanctum: {type: "apiKey", in: "cookie", name: "configured-session-cookie"}}, schemas}};
const output = JSON.stringify(spec, null, 2) + "\n";
const types = "/** Generated application contracts. A2–A6 application drafts, verification, documents, review and submission implemented; live entry separately gated. */\n" + astToString(await openapiTS(spec));
for (const [path, content] of [["contracts/openapi/application-wizard-v2.json", output], ["apps/web/src/types/generated/application-wizard-v2.ts", types]]) {
  const target = new URL(path, root);
  if (process.argv.includes("--check")) { if (readFileSync(target, "utf8").replaceAll("\r\n", "\n") !== content) throw new Error(`Stale application wizard contract: ${path}`); }
  else writeFileSync(target, content);
}
console.log("Application wizard OpenAPI and generated types " + (process.argv.includes("--check") ? "match." : "generated."));
