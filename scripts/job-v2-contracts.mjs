import {readFileSync, writeFileSync} from "node:fs";
import openapiTS, {astToString} from "openapi-typescript";

const root = new URL("../../../", import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const rules = read("contracts/validation/job-v2.json"), imports = read("contracts/validation/job-import.json"), old = read("contracts/openapi/phase-11.json").components.schemas;
const ref = name => ({$ref: `#/components/schemas/${name}`});
const object = (properties, required = Object.keys(properties)) => ({type: "object", properties, required, additionalProperties: false});
const string = maxLength => ({type: "string", maxLength});
const nullable = schema => ({anyOf: [schema, {type: "null"}]});
const enumeration = values => ({type: "string", enum: values});
const integer = (minimum, maximum) => ({type: "integer", minimum, ...(maximum === undefined ? {} : {maximum})});
const array = (items, maxItems) => ({type: "array", items, maxItems});
const uuid = {type: "string", format: "uuid"}, revision = integer(1), boolean = {type: "boolean"};
const money = {type: "string", pattern: rules.moneyPattern, maxLength: 16, description: `Decimal currency units, at most ${rules.moneyMax}; never an IEEE-754 number.`};
const schemas = {
  MoneyV2: money,
  CompensationStageV2: object({label: string(rules.scheduleLabelMax), startMonth: integer(1, rules.scheduleMonthMax), endMonth: nullable(integer(1, rules.scheduleMonthMax)), amount: nullable(ref("MoneyV2")), period: nullable(enumeration(rules.compensationPeriods))}),
  CompensationAllowanceV2: object({label: string(rules.allowanceLabelMax), amount: nullable(ref("MoneyV2")), percent: nullable(ref("MoneyV2"))}),
  CompensationV2: object({kind: nullable(enumeration(rules.compensationKinds)), format: enumeration(rules.compensationFormats), currency: nullable(enumeration(rules.currencies)), period: nullable(enumeration(rules.compensationPeriods)), minAmount: nullable(ref("MoneyV2")), maxAmount: nullable(ref("MoneyV2")), hidden: boolean, variableEnabled: boolean, variablePercent: nullable(ref("MoneyV2")), scaleLabel: nullable(string(rules.scaleLabelMax)), notes: string(rules.compensationNoteMax), allowances: array(ref("CompensationAllowanceV2"), rules.allowancesMax), schedule: array(ref("CompensationStageV2"), rules.scheduleMax)}),
  DeadlineV2: nullable(object({date: {type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"}, time: nullable({type: "string", pattern: "^(?:[01][0-9]|2[0-3]):[0-5][0-9]$"}), timezone: {...string(rules.timezoneMax), minLength: 1}, offset: nullable({type: "string", pattern: rules.deadlineOffsetPattern})})),
};
schemas.PublicCompensationV2 = {oneOf: [object({disclosure: enumeration(["undisclosed", "unspecified"])}), object({...schemas.CompensationV2.properties, disclosure: enumeration(["specified"]), hidden: {const: false}, format: enumeration(rules.compensationFormats.filter(f=>f!=="unspecified"))})]};
const removed = ["currency", "salaryMin", "salaryMax", "hideSalary", "variableEnabled", "variablePercent", "expiresAt"];
const properties = Object.fromEntries(Object.entries(old.JobWizardValues.properties).filter(([key]) => !removed.includes(key)));
Object.assign(properties, {schemaVersion: {type: "integer", const: 2}, compensation: ref("CompensationV2"), deadline: ref("DeadlineV2"), experienceMin: nullable(integer(0, rules.experienceMax)), experienceMax: nullable(integer(0, rules.experienceMax)), vacancies: nullable(integer(1, rules.vacanciesMax)), employment: enumeration(["", ...rules.employment]), education: {...array(enumeration(rules.education), 7), uniqueItems: true}});
schemas.JobDraftValuesV2 = object(properties, Object.keys(properties).filter(k => k !== "aiVerified"));
schemas.JobDraftValuesV2.description = "Version 2 job payload accepted by the negotiated J3 editor endpoints. Cross-field rules and semantic examples accompany this schema; JSON Schema alone cannot compare sibling amounts or resolve timezone transitions.";
const publication = {};
for (const key of rules.requiredStages.flat()) {
  const prop = properties[key];
  publication[key] = key === "experienceMin" ? integer(0, rules.experienceMax) : prop.type === "array" ? {minItems: 1} : {type: "string", minLength: 1, pattern: "\\S"};
}
schemas.JobPublishValuesV2 = {allOf: [ref("JobDraftValuesV2"), {properties: publication}], description: "Also requires complete compensation, questions, conditional thumbnail alt and current server availability/source review. Business relationships are checked independently by both implementations."};
schemas.JobStageAdvanceV2 = object({values: ref("JobDraftValuesV2"), step: integer(0,6), reached: integer(0,6), version: revision, jobVersion: revision});
schemas.JobStageAdvanceV2.properties.generated = nullable(object({mode:enumeration(["template-demo"]),role:{...string(100),minLength:1},at:{type:"string",format:"date-time"}}));
schemas.JobPublishRequestV2 = {...structuredClone(schemas.JobStageAdvanceV2), properties: {...schemas.JobStageAdvanceV2.properties, values: ref("JobPublishValuesV2")}};
schemas.JobDraftV2 = structuredClone(old.JobDraft);
schemas.JobDraftV2.properties.values = ref("JobDraftValuesV2");
schemas.JobDraftContextV2 = structuredClone(old.JobDraftContext);
schemas.JobDraftContextV2.properties.draft = ref("JobDraftV2");
const privateJobKeys = ["reference","postedBy","collaborationNote","collaborators"];
schemas.HiringJobV2 = structuredClone(old.HiringJob);
for (const key of privateJobKeys) delete schemas.HiringJobV2.properties[key];
schemas.HiringJobV2.required = schemas.HiringJobV2.required.filter(key=>!privateJobKeys.includes(key));
Object.assign(schemas.HiringJobV2.properties,{schemaVersion:{type:"integer",const:2},compensation:ref("PublicCompensationV2"),deadline:ref("DeadlineV2"),closesAt:nullable({type:"string",format:"date-time"}),experienceMin:integer(0,rules.experienceMax),experienceMax:nullable(integer(0,rules.experienceMax)),vacancies:nullable(integer(1,rules.vacanciesMax)),education:array(enumeration(rules.education),7)});
schemas.HiringJobV2.required.push("schemaVersion","compensation","deadline","closesAt","experienceMin","experienceMax","vacancies","education");
schemas.HiringJobV2.properties.wizardValues = object({education:array(enumeration(rules.education),7),experienceMin:nullable(integer(0,50)),experienceMax:nullable(integer(0,50)),vacancies:nullable(integer(1,rules.vacanciesMax))});
schemas.HiringJobV2.description = "Public view only: no editable wizard values, recruiter contact, source-review evidence or confidential pay. The legacy salary string remains a display label with the real period; it is not a numeric annual fallback.";
schemas.HiringJobPrivateV2 = structuredClone(schemas.HiringJobV2);
for (const key of privateJobKeys) schemas.HiringJobPrivateV2.properties[key] = structuredClone(old.HiringJob.properties[key]);
schemas.HiringJobPrivateV2.properties.wizardValues = ref("JobDraftValuesV2");
schemas.HiringJobPrivateV2.properties.compensation = ref("CompensationV2");
schemas.JobDraftContextV2.properties.latestJob = nullable(ref("HiringJobPrivateV2"));
schemas.JobDetailV2 = structuredClone(old.JobDetail);
schemas.JobDetailV2.properties.job = ref("HiringJobV2");
schemas.ImportStart = object({sourceAssetId: uuid, idempotencyKey: uuid});
schemas.ImportFile = object({name: {...string(180), minLength: 1, pattern: String.raw`^[^/\\\x00]+\.[xX][lL][sS][xX]$`}, bytes: integer(1, imports.maxBytes)});
schemas.ImportMapping = object({version: revision, sheet: {...string(31), minLength: 1}, headerRow: integer(1,imports.headerRowMax), preset: enumeration(imports.presets), timezone: {...string(100),minLength:1}, columns: object(Object.fromEntries(imports.mappingTargets.map(key=>[key,integer(1,imports.maxColumns)])),["title"])});
schemas.ImportResolution = object({issue: enumeration(imports.issueCodes), kind: enumeration(imports.resolutionKinds), note: {...string(imports.reviewNoteMax),minLength:10,pattern:"\\S"}});
schemas.ImportPositionReview = object({version: revision, values: ref("JobDraftValuesV2"), resolutions: array(ref("ImportResolution"),imports.issueCodes.length)});
schemas.ImportSplits = object({version:revision,rowId:uuid,positions:{...array(object({sourcePositionKey:{...string(imports.sourcePositionKeyMax),minLength:1},values:ref("JobDraftValuesV2")}),imports.selectionMax),minItems:1}});
schemas.ImportDraftSelection = object({version:revision,idempotencyKey:uuid,positions:{...array(object({id:uuid,version:revision}),imports.selectionMax),minItems:1}});
schemas.ImportCancel = object({version:revision});
schemas.ImportOperation = object({id:uuid,state:enumeration(["pending","running","completed","failed","cancelled"]),total:integer(0,imports.selectionMax),processed:integer(0,imports.selectionMax),results:array(object({positionId:uuid,status:enumeration(["created","already_created","skipped","conflict","failed"]),jobId:nullable(uuid),draftKey:nullable(uuid),errorCode:nullable(string(100))}),imports.selectionMax)});
schemas.ImportBatch = object({id:uuid,version:revision,state:enumeration(imports.batchStates),sourceRows:integer(0,imports.maxRows),positions:integer(0,imports.maxPositions),sourceSha256:{type:"string",pattern:"^[a-f0-9]{64}$"},sheets:array(string(31),imports.maxSheets)});
schemas.ImportPosition = object({id:uuid,version:revision,sourceRow:integer(1),sourcePositionKey:{...string(imports.sourcePositionKeyMax),minLength:1},state:enumeration(imports.positionStates),values:ref("JobDraftValuesV2"),issues:array(enumeration(imports.issueCodes),imports.issueCodes.length),canCreateDraft:boolean,canPublish:boolean});
schemas.ImportPosition.properties.jobId = nullable(uuid);
schemas.ImportPosition.properties.draftKey = nullable(uuid);
schemas.ImportPosition.required.push("jobId","draftKey");
schemas.ImportBatchPage = object({items:array(ref("ImportBatch"),100),total:integer(0),page:integer(1),pageSize:integer(1,100)});
schemas.ImportPositionsPage = object({items:array(ref("ImportPosition"),100),total:integer(0,imports.maxPositions),page:integer(1),pageSize:integer(1,100)});
// Copy only transitive unchanged schemas; do not fork or modify the live cumulative API contract.
for (let count = -1; count !== Object.keys(schemas).length;) {
  count = Object.keys(schemas).length;
  for (const match of JSON.stringify(schemas).matchAll(/#\/components\/schemas\/([^"\\]+)/g)) if (!schemas[match[1]]) {
    if (!old[match[1]]) throw new Error(`Missing schema ${match[1]}`);
    schemas[match[1]] = structuredClone(old[match[1]]);
  }
}
const base = "/api/v1/organizations/{organization}/hiring";
const paths = {};
const endpoint = (suffix, method, request, response, phase) => {
  const path = base+suffix, names = [...path.matchAll(/\{([^}]+)\}/g)].map(m=>m[1]);
  (paths[path] ??= {})[method] = {operationId:`jobV2_${method}_${suffix.replace(/[^a-zA-Z0-9]/g,"_") || "root"}`,"x-implementation-phase":phase,"x-implemented":phase === "J3",security:[{sanctum:[]}],parameters:names.map(name=>({name,in:"path",required:true,schema:uuid})),...(request?{requestBody:{required:true,content:{"application/json":{schema:ref(request)}}}}:{}),responses:{[(suffix === "/imports" && method === "post") || method === "put" ? "202" : "200"]:{description:"Validated versioned result; import endpoints remain planned",content:{"application/json":{schema:response?object({data:ref(response)}):{type:"object"}}}},"422":{description:"Field validation errors"},"409":{description:"Revision, duplicate-key or business-state conflict"},"403":{description:"Denied by current membership/resource policy"},"429":{description:"Rate limit; honor Retry-After"}}};
};
endpoint("/imports","post","ImportStart","ImportBatch","J5"); endpoint("/imports","get",null,"ImportBatchPage","J5");
endpoint("/imports/{batch}","get",null,"ImportBatch","J5"); endpoint("/imports/{batch}/mapping","put","ImportMapping","ImportBatch","J5");
endpoint("/imports/{batch}/positions","get",null,"ImportPositionsPage","J6"); endpoint("/imports/{batch}/positions/{position}","patch","ImportPositionReview","ImportPosition","J6");
endpoint("/imports/{batch}/splits","post","ImportSplits","ImportBatch","J6"); endpoint("/imports/{batch}/drafts","post","ImportDraftSelection","ImportOperation","J7");
endpoint("/imports/{batch}/operations/{operation}","get",null,"ImportOperation","J7"); endpoint("/imports/{batch}/cancel","post","ImportCancel","ImportBatch","J7");
schemas.JobDraftOpenV2 = object({job_id:uuid,creation_key:uuid},[]);
endpoint("/drafts","post","JobDraftOpenV2","JobDraftContextV2","J3");
endpoint("/drafts/{draft}","patch","JobStageAdvanceV2","JobDraftV2","J3"); endpoint("/drafts/{draft}/publish","post","JobPublishRequestV2","JobDraftV2","J3");
for (const [path, methods] of Object.entries(paths)) if (path.includes("/drafts")) for (const operation of Object.values(methods)) {
  operation.parameters.push({name:"X-Skillora-Job-Schema",in:"header",required:true,schema:{type:"integer",const:2},description:"J3 payload negotiation. Header and body schemaVersion must agree. Old clients cannot submit non-annual v2 values as v1."});
}
paths["/api/v1/jobs/{job}"] = {get:{operationId:"jobV2_publicDetail","x-implementation-phase":"J3","x-implemented":true,parameters:[{name:"job",in:"path",required:true,schema:uuid},{name:"X-Skillora-Job-Schema",in:"header",required:true,schema:{type:"integer",const:2}}],responses:{"200":{description:"Safe public v2 job projection",content:{"application/json":{schema:object({data:ref("JobDetailV2")})}}},"404":{description:"Absent or unavailable"}}}};
const spec = {openapi:"3.1.0",info:{title:"Skillora job module version 2 contracts",version:"2.0.0-j3",description:"J3 editor/publication contracts; imports remain planned. Job schema version 2 is separate from the /api/v1 URL. Legacy clients remain supported for legacy jobs; upgrades are explicit."},"x-activation":"J3 editor connected; J4 discovery integration pending; Excel import disabled",paths,components:{securitySchemes:{sanctum:{type:"apiKey",in:"cookie",name:"configured-session-cookie"}},schemas}};
const output = new URL("contracts/openapi/job-module-v2.json",root), generated = JSON.stringify(spec,null,2)+"\n";
const types = "/** Generated job v2 contracts. J3 operations implemented; import operations remain planned. */\n"+astToString(await openapiTS(spec));
const typePath = new URL("apps/web/src/types/generated/job-module-v2.ts",root);
for (const [path, content] of [[output,generated],[typePath,types]]) {
  if (process.argv.includes("--check")) { if (readFileSync(path,"utf8").replaceAll("\r\n","\n") !== content) throw new Error(`Stale job v2 contract: ${path.pathname}`); }
  else writeFileSync(path,content);
}
console.log(process.argv.includes("--check") ? "Job module OpenAPI and generated types match shared rules." : "Generated job module OpenAPI and TypeScript contracts.");
