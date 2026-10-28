// Deterministic Phase 2 schema derived from the shared field contracts.
import { readFileSync, writeFileSync } from "node:fs";
const root = new URL("../../../", import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const profile = read("contracts/validation/profile.json"), org = read("contracts/validation/organization.json"), onboarding = read("contracts/validation/onboarding.json");
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const text = { type: "string" }, bool = { type: "boolean" }, integer = { type: "integer" }, uuid = { type: "string", format: "uuid" };
const array = (items) => ({ type: "array", items });
const object = (properties, required = Object.keys(properties), additionalProperties = false) => ({ type: "object", properties, required, additionalProperties });
const fields = (definitions, response = false) => {
  const properties = {}, required = [];
  for (const [key, rule] of Object.entries(definitions)) {
    const [type, a] = rule.replace(/!$/, "").split(":");
    let schema = { ...text };
    if (!response) {
      if (type === "text") schema.maxLength = Number(a);
      if (type === "enum") schema.enum = a.split("|");
      if (type === "proficiency") schema.enum = profile.proficiency;
      if (type === "email") schema.maxLength = 254;
      if (type === "url") schema.maxLength = 2048;
      if (type === "month") schema.pattern = "^[0-9]{4}-(0[1-9]|1[0-2])$";
      if (["number", "integer"].includes(type)) schema.pattern = type === "number" ? "^[0-9]+(?:\\.[0-9]+)?$" : "^[0-9]+$";
      if (rule.endsWith("!")) { schema.minLength = 1; required.push(key); }
      else schema = { anyOf: [schema, { type: "null" }] };
    } else required.push(key);
    properties[key] = schema;
  }
  return object(properties, required);
};
const schemas = {
  Revision: object({ version: { ...integer, minimum: 1 } }),
  MediaInit: object({ purpose: { enum: ["portrait", "resume", "logo", "cover", "gallery", "recruiter_photo", "business_document"] }, name: { ...text, maxLength: 180 }, mime: text, bytes: { ...integer, minimum: 1, maximum: 2097152 }, organization_id: uuid }, ["purpose", "name", "mime", "bytes"]),
  MediaPending: object({ id: uuid, expires_at: text }),
  ManagedAsset: object({ id: uuid, url: text, name: text, bytes: integer }),
  Resume: object({ id: uuid, name: text, size: integer, format: text, uploadedAt: text }),
  Image: object({ id: uuid, url: text, alt: text, bytes: integer }),
  VerificationDocument: object({ id: uuid, name: text, size: integer, type: text }),
};
for (const [name, definition] of Object.entries(profile.sections)) {
  const schema = fields(definition); schema.properties.profile_version = { ...integer, minimum: 1 }; schema.required.push("profile_version");
  if (name === "identity") for (const flag of ["public", "available", "publicEmail", "publicPhone"]) schema.properties[flag] = bool;
  schemas[`ProfileSection_${name}`] = schema;
}
const records = {};
for (const [name, definition] of Object.entries(profile.collections)) {
  const record = fields(definition); Object.assign(record.properties, { id: { anyOf: [uuid, { type: "null" }, { const: "" }] }, profile_version: { ...integer, minimum: 1 }, public: bool, current: bool, neverExpires: bool, featured: bool, projects: array(uuid), project: { anyOf: [uuid, { type: "null" }, { const: "" }] }, skillId: uuid }); record.required.push("profile_version"); schemas[`ProfileRecord_${name}`] = record;
  records[name] = array(object({ id: uuid, ...Object.fromEntries(Object.keys(definition).map((key) => [key, text])), public: bool, current: bool, neverExpires: bool, featured: bool, skillId: uuid, projects: array(uuid) }, ["id"], true));
}
const personProps = Object.fromEntries(["id", "slug", "name", "headline", "category", "location", "summary", "experience", "education", "arrangement", "website", "picture", "color", "lastActive"].map((key) => [key, text]));
Object.assign(personProps, { years: { type: "number" }, skills: array(text), available: bool, public: bool, complete: integer });
schemas.ProfilePerson = object({ ...personProps, interests: text, email: text, avatar: integer });
schemas.ProfileDetails = object({ version: { const: 1 }, revision: integer, updatedAt: text, phone: text, currentTitle: text, currentCompany: text, employmentStatus: text, focus: text, strengths: text, resume: { anyOf: [ref("Resume"), { type: "null" }] }, career: fields(profile.sections.career, true), personal: fields(profile.sections.personal, true), diversity: fields(profile.sections.diversity, true), privacy: object({ email: bool, phone: bool }), photoRemoved: bool, ...records });
schemas.ProfileSnapshot = object({ version: integer, onboardingStep: integer, person: ref("ProfilePerson"), details: ref("ProfileDetails"), completion: object({ percent: integer, items: array(object({ label: text, weight: integer, done: bool, section: text })) }), projects: array(object({}, [], true)) });
schemas.PublicProfessional = object({ person: object({ ...personProps, interests: { const: "" }, credentials: object({ groups: array(object({ label: text, records: array(object({ title: text, source: text, description: text, url: text, linkLabel: text }, [], false)) })), breaks: array(object({ start: text, end: text, current: bool, description: text }, [], false)), contact: object({ email: text, phone: text }, []) }) }), projects: array(object({}, [], true)), updates: array(object({}, [], true)), portfolioSlug: text, saved: bool });
const orgFields = fields(org.fields, true).properties;
const organization = object({ ...orgFields, id: uuid, logoUrl: text, coverImageUrl: text, version: integer, updatedAt: text, verificationStatus: { enum: ["Not started", "In progress", "Pending review", "Verified", "Action required"] }, socialLinks: object({ linkedin: text, other: text }), workplaceImages: array(ref("Image")), ...Object.fromEntries(org.lists.map((key) => [key, array(text)])), ...Object.fromEntries(org.flags.map((key) => [key, bool])) });
schemas.OrganizationProfile = organization;
const publicOrg = structuredClone(organization); for (const key of ["version", "applicationContact"]) { delete publicOrg.properties[key]; publicOrg.required = publicOrg.required.filter((k) => k !== key); } schemas.PublicOrganizationProfile = publicOrg;
schemas.Verification = object({ ...fields(org.verification, true).properties, documents: array(ref("VerificationDocument")), submittedAt: text, reviewNote: text });
schemas.VerificationInput = object({ ...fields(org.verification).properties, submit: bool, documents: array(object({ id: uuid })), version: { ...integer, minimum: 1 } }, ["submit", "documents"]);
schemas.OrganizationInput = { ...fields(org.fields), properties: { ...fields(org.fields).properties, ...Object.fromEntries(org.lists.map((key) => [key, { ...array({ ...text, maxLength: 100 }), maxItems: 20, uniqueItems: true }])), ...Object.fromEntries(org.flags.map((key) => [key, bool])), version: { ...integer, minimum: 1 }, logoUrl: text, coverImageUrl: text, workplaceImages: { ...array(ref("Image")), maxItems: 4 }, socialLinks: object({ linkedin: text, other: text }), verification: ref("VerificationInput") }, required: [...fields(org.fields).required, "version", ...org.lists, ...org.flags, "workplaceImages"] };
const member = object({ ...fields(org.recruiter, true).properties, id: uuid, organizationId: uuid, avatarUrl: text, version: integer, role: { enum: ["Organization Admin", "Recruiter", "Hiring Manager"] }, accountStatus: { enum: ["Active", "Inactive"] }, hiringDepartments: array(text), hiringLocations: array(text), professionalLinks: object({ linkedin: text }) });
schemas.RecruiterProfile = member;
schemas.RecruiterInput = { ...member, required: [...fields(org.recruiter).required, "version", "hiringDepartments", "hiringLocations"] };
const publicMember = structuredClone(member); for (const key of ["workEmail", "privateMobile", "role", "accountStatus", "communicationPreference", "version"]) { delete publicMember.properties[key]; publicMember.required = publicMember.required.filter((k) => k !== key); } schemas.PublicRecruiterProfile = publicMember;
schemas.InvitationRow = object({ id: uuid, organizationId: uuid, fullName: text, email: text, role: text, hiringDepartment: text, invitationStatus: text, createdAt: text, reminderAt: { type: ["string", "null"] } });
schemas.OrganizationContext = object({ workspace: object({ organization: { anyOf: [ref("OrganizationProfile"), ref("PublicOrganizationProfile")] }, recruiters: array(ref("RecruiterProfile")), invitations: array(ref("InvitationRow")), verification: ref("Verification"), currentRecruiterId: uuid }), currentRecruiter: ref("RecruiterProfile"), canManage: bool, companyJobs: array(object({}, [], true)), openJobs: array(object({}, [], true)) });
schemas.PublicOrganizationView = object({ organization: ref("PublicOrganizationProfile"), openJobs: array(object({}, [], true)) });
schemas.PublicRecruiterView = object({ organization: ref("PublicOrganizationProfile"), recruiter: ref("PublicRecruiterProfile") });
const paths = {};
function operation(path, method, output, input, options = {}) {
  const parameters = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => ({ name: m[1], in: "path", required: true, schema: { type: "string" } }));
  const result = { operationId: `phase2_${method}_${path.replace(/[^a-zA-Z0-9]+/g, "_")}`, ...(parameters.length ? { parameters } : {}), responses: { [options.status ?? (output ? "200" : "204")]: output ? { description: "Success", content: { "application/json": { schema: object({ data: typeof output === "string" ? ref(output) : output }) } } } : { description: "No content" }, default: { $ref: "#/components/responses/Error" } }, ...options };
  delete result.status;
  if (input) result.requestBody = { required: true, content: { "application/json": { schema: typeof input === "string" ? ref(input) : input } } };
  paths[path] ??= {}; paths[path][method] = result;
}
operation("/me/profile", "get", "ProfileSnapshot"); operation("/me/profile", "post", "ProfileSnapshot");
operation("/me/profile/sections/{section}", "patch", "Revision", { oneOf: Object.keys(profile.sections).map((key) => ref(`ProfileSection_${key}`)) });
operation("/me/profile/records/{collection}", "post", "Revision", { anyOf: Object.keys(profile.collections).map((key) => ref(`ProfileRecord_${key}`)) });
operation("/me/profile/records/{collection}/{record}/{action}", "post", "Revision", object({ profile_version: integer, offset: { enum: [-1, 1] } }, ["profile_version"]));
operation("/me/profile/assets/{purpose}", "post", "Revision", object({ profile_version: integer, asset_id: { anyOf: [uuid, { type: "null" }] } }));
operation("/me/onboarding/{step}", "post", "ProfileSnapshot", { anyOf: [object({ ...fields(onboarding.basic).properties, profile_version: integer }, [...fields(onboarding.basic).required, "profile_version"]), object({ profile_version: integer }), object({ ...fields(onboarding.background).properties, skills: { ...array(text), minItems: 1, maxItems: 30 }, profile_version: integer }, ["experience", "education", "skills", "profile_version"]), object({ public: bool, profile_version: integer })] });
operation("/professionals/{slug}", "get", "PublicProfessional", null, { security: [] });
operation("/public/organizations/{slug}", "get", "PublicOrganizationView", null, { security: [] });
operation("/public/recruiters/{member}", "get", "PublicRecruiterView", null, { security: [] });
operation("/organizations/{organization}/profile", "get", "OrganizationContext"); operation("/organizations/{organization}/profile", "patch", "OrganizationContext", "OrganizationInput");
operation("/organizations/{organization}/recruiters/{member}", "patch", "OrganizationContext", "RecruiterInput");
operation("/organizations/{organization}/verification", "post", "OrganizationContext", { allOf: [ref("VerificationInput"), { required: ["version"] }] });
operation("/organizations/{organization}/invitations/{invitation}/{action}", "post");
operation("/media", "post", "MediaPending", "MediaInit", { status: 201 });
operation("/media/{asset}/content", "post", null, null, { requestBody: { required: true, content: { "multipart/form-data": { schema: object({ file: { type: "string", format: "binary" } }) } } } });
operation("/media/{asset}/complete", "post", "ManagedAsset"); operation("/media/{asset}", "delete");
schemas.MediaInit.properties.bytes.maximum=5497558138880;
schemas.MediaInit.properties.initiationKey=uuid;
const nullableMedia=(v)=>({anyOf:[v,{type:"null"}]});
schemas.MediaSignedUpload=object({url:text,headers:{type:"object",additionalProperties:text},expiresAt:text});
schemas.MediaUploadStatus=object({id:uuid,state:{type:"string",enum:["pending","uploaded","processing","accepted","rejected","cancelled","deleting"]},failureCode:nullableMedia(text),expiresAt:text,asset:nullableMedia(ref("ManagedAsset"))});
schemas.MediaAuthorization=object({mode:{type:"string",enum:["local","put","multipart","uploaded"]},chunkBytes:integer,expiresAt:text,parts:array(object({number:integer,bytes:integer,etag:text,checksum:nullableMedia(text)})),upload:nullableMedia(ref("MediaSignedUpload"))});
schemas.MediaPartInput=object({number:{...integer,minimum:1,maximum:10000},checksum:{...text,pattern:"^[A-Za-z0-9+/]{43}=$"}});
schemas.MediaPolicy=object({rules:{type:"object",additionalProperties:{type:"array",items:{anyOf:[integer,array(text)]},minItems:3,maxItems:3}},fileConcurrency:integer,partConcurrency:integer,retries:integer,postMaxItems:integer,postTotalBytes:integer,jobTotalBytes:integer});
operation("/media/policy","get","MediaPolicy");operation("/media/{asset}","get","MediaUploadStatus");operation("/media/{asset}/authorization","post","MediaAuthorization");operation("/media/{asset}/parts/sign","post","MediaSignedUpload","MediaPartInput");operation("/media/{asset}/abort","post");
paths["/media/{asset}/complete"].post.responses[202]={description:"Object received; verification queued. Poll the owned upload status until accepted.",content:{"application/json":{schema:object({data:ref("MediaUploadStatus")})}}};
operation("/media/{asset}/download", "get", null, null, { security: [], responses: { 200: { description: "Access-controlled file stream; private files require a current authenticated session.", content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } } }, default: { $ref: "#/components/responses/Error" } } });
paths["/media/{asset}/download"].get.responses[206]={description:"Authorized single-range video stream."};
paths["/media/{asset}/download"].get.responses[302]={description:"Short-lived private storage GET redirect for eligible non-CORS media requests. Never persist the Location."};
paths["/media/{asset}/download"].get.responses[416]={description:"Requested video range is not satisfiable."};
const base = read("contracts/openapi/phase-1.json");
base.info.title = "Skillora API through Phase 2"; base.info.version = "1.2.0";
base.info.description += " Phase 2 adds revisioned profiles, explicit public resources, atomic company/verification saves, managed private uploads and ordered onboarding. Field contracts in contracts/validation define cross-field constraints. Project/job arrays are empty until their owning phases.";
Object.assign(base.paths, paths); Object.assign(base.components.schemas, schemas);
const output = JSON.stringify(base, null, 2) + "\n";
const destination = new URL("contracts/openapi/phase-2.json", root);
if (process.argv.includes("--check")) { if (readFileSync(destination, "utf8").replaceAll("\r\n", "\n") !== output) throw new Error("Phase 2 contract is stale."); }
else writeFileSync(destination, output);
