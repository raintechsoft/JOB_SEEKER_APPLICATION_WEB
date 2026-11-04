import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import openapiTS,{astToString} from "openapi-typescript";
const root=new URL("../../../",import.meta.url),read=path=>JSON.parse(readFileSync(new URL(path,root),"utf8"));
const policy=read("contracts/validation/public-browsing.json"),search=read("contracts/validation/global-search.json"),jobs=read("contracts/validation/search.json");
const text=maxLength=>({type:"string",maxLength,pattern:"^[^\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]*$"});
const object=(properties,required=Object.keys(properties))=>({type:"object",properties,required,additionalProperties:false});
const ref=name=>({$ref:`#/components/schemas/${name}`}),nullable=schema=>({anyOf:[schema,{type:"null"}]}),enumeration=values=>({type:"string",enum:values});
const uuid={type:"string",format:"uuid"},date={type:"string",format:"date-time"},count={type:"integer",minimum:0},boolean={type:"boolean"};
const cursor={type:"string",maxLength:policy.limits.cursor,pattern:policy.cursorPattern,minLength:1},limit=max=>({type:"integer",minimum:1,maximum:max,default:policy.limits.defaultPageSize});
const idPattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const resourcePath={type:"string",maxLength:512,pattern:`^/(?:feed/${idPattern}|jobs/${idPattern}|professionals/[a-z0-9]+(?:-[a-z0-9]+)*|organizations/[a-z0-9]+(?:-[a-z0-9]+)*|recruiters/${idPattern}|portfolio/[a-z0-9]+(?:-[a-z0-9]+)*)$`};
const schemas={
  GuestAction:enumeration([...policy.publicActions,...policy.accountActions,...policy.professionalActions,...policy.recruiterActions,...Object.keys(policy.permissionActions)]),
  PublicFeedQuery:object({filter:{...enumeration(policy.feedFilters),default:"all"},sort:{type:"string",const:"recent",default:"recent"},limit:limit(policy.limits.pageSize),cursor},[]),
  PublicCommentsQuery:object({limit:limit(policy.limits.commentPageSize),cursor,focus:uuid},[]),
  PublicSearchQuery:object({q:{...text(policy.limits.queryMax),minLength:policy.limits.queryMin},scope:{...enumeration(policy.searchScopes),default:"all"},sort:{...enumeration(policy.searchSorts),default:"relevance"},limit:limit(policy.limits.pageSize),cursor,
    selected:{type:"string",pattern:"^(person|company|post|job|update):[0-9a-fA-F-]{36}$"},
    location:{...text(200),minLength:1},skill:{...text(100),minLength:1},industry:{...text(100),minLength:1},companyType:enumeration(search.companyTypes),arrangement:enumeration(search.arrangements),employment:enumeration(search.employment),education:enumeration(search.education),contentType:enumeration(search.contentTypes),author:uuid,
    days:{type:"integer",minimum:1,maximum:365},experienceMin:{type:"number",minimum:0,maximum:60},experienceMax:{type:"number",minimum:0,maximum:60},salaryMin:{type:"number",minimum:0,maximum:1e12,multipleOf:0.01},salaryMax:{type:"number",minimum:0,maximum:1e12,multipleOf:0.01},currency:enumeration(jobs.currencies),compensationPeriod:enumeration(jobs.compensationPeriods)},["q"]),
  PublicMedia:object({id:uuid,kind:enumeration(["image","video","document"]),mime:{...text(120),minLength:1},name:{...text(180),minLength:1},alt:text(300),downloadPath:{type:"string",pattern:"^/api/v1/media/[0-9a-fA-F-]{36}/download$"},position:{type:"integer",minimum:0,maximum:199}},["id","kind","mime","name","alt","downloadPath"]),
  PublicExternalVideo:object({position:{type:"integer",minimum:0,maximum:199},url:{type:"string",maxLength:2048,pattern:policy.externalVideoUrlPattern},name:text(180),alt:text(300)}),
  PublicAuthor:object({id:uuid,kind:enumeration(["professional","recruiter"]),name:{...text(150),minLength:1},headline:text(300),profilePath:resourcePath,picture:nullable(ref("PublicMedia"))}),
  PublicCompany:object({id:nullable(uuid),name:{...text(150),minLength:1},profilePath:nullable(resourcePath),confidential:boolean,logo:nullable(ref("PublicMedia")),verified:boolean}),
  PublicJobSummary:object({id:uuid,title:{...text(150),minLength:1},location:text(300),arrangement:text(100),employment:text(100),compensationLabel:text(1000),acceptingApplications:boolean,closesAt:nullable(date),publicPath:resourcePath}),
  PublicEntry:object({id:uuid,kind:enumeration(["post","job","update"]),path:resourcePath,title:text(policy.limits.title),body:text(policy.limits.body),publishedAt:date,author:nullable(ref("PublicAuthor")),company:nullable(ref("PublicCompany")),media:{type:"array",items:ref("PublicMedia"),maxItems:policy.limits.media},counts:object({likes:count,comments:count,reposts:count}),job:nullable(ref("PublicJobSummary"))}),
  PublicComment:object({id:uuid,entryId:uuid,parentId:nullable(uuid),author:ref("PublicAuthor"),text:{...text(policy.limits.comment),minLength:1},createdAt:date,pinned:boolean}),
  PublicSearchResult:object({id:uuid,kind:enumeration(["person","company","post","job","update"]),title:{...text(300),minLength:1},subtitle:text(1000),path:resourcePath,picture:nullable(ref("PublicMedia"))}),
  PublicBrowseError:object({code:enumeration(["not_found","validation_failed","rate_limited","request_failed","forbidden"]),message:text(300),errors:{anyOf:[{type:"object",additionalProperties:{type:"array",items:text(300)}},{type:"array",maxItems:0}]},request_id:uuid},["code","message"]),
};
schemas.PublicEntry.properties.externalVideos={type:"array",items:ref("PublicExternalVideo"),maxItems:policy.limits.media};
const page=(name,max)=>object({items:{type:"array",items:ref(name),maxItems:max},nextCursor:nullable(cursor),total:count});
schemas.PublicFeedPage=page("PublicEntry",policy.limits.pageSize);
schemas.PublicFeedRefreshQuery=object({ids:{type:"string",minLength:36,maxLength:1479,description:"One to forty unique, comma-separated lowercase UUIDs. Inaccessible entries are omitted."},filter:{...enumeration(policy.feedFilters),default:"all"}},["ids"]);
schemas.PublicFeedRefresh={type:"array",items:ref("PublicEntry"),maxItems:40};
schemas.PublicCommentsPage=page("PublicComment",policy.limits.commentPageSize);
schemas.PublicSearchPage={...page("PublicSearchResult",policy.limits.pageSize),properties:{...page("PublicSearchResult",policy.limits.pageSize).properties,scope:enumeration(policy.searchScopes)},required:["items","nextCursor","total","scope"]};
schemas.PublicCompany.allOf=[{if:{properties:{confidential:{const:true}},required:["confidential"]},then:{properties:{id:{type:"null"},profilePath:{type:"null"},logo:{type:"null"},verified:{const:false},name:{const:"Confidential company"}}}}];
schemas.PublicEntry.allOf=[{if:{properties:{kind:{const:"job"}},required:["kind"]},then:{properties:{job:ref("PublicJobSummary")}},else:{properties:{job:{type:"null"},author:ref("PublicAuthor")}}}];
const paths={};
function endpoint(path,query,response){
  const parameters=Object.entries(query?schemas[query].properties:{}).map(([name,schema])=>({name,in:"query",required:(schemas[query].required??[]).includes(name),schema}));
  if(path.includes("{entry}"))parameters.unshift({name:"entry",in:"path",required:true,schema:uuid});
  const failure=description=>({description,content:{"application/json":{schema:ref("PublicBrowseError")}}});
  paths[path]={get:{operationId:`publicBrowse_${response}`,security:[],"x-implementation-phase":"G2","x-implemented":true,parameters,responses:{200:{description:"Whitelisted public projection; no viewer identity or private account data",content:{"application/json":{schema:object({data:ref(response)})}}},403:failure("Untrusted application origin"),404:failure("Absent or ineligible content; do not reveal private resource existence"),422:failure("Unsupported or invalid query"),429:{...failure("Public read limit exceeded"),headers:{"Retry-After":{schema:{type:"integer",minimum:1}}}},503:failure("Public browsing is unavailable")}}};
}
endpoint("/api/v1/public/feed","PublicFeedQuery","PublicFeedPage");
endpoint("/api/v1/public/feed/refresh","PublicFeedRefreshQuery","PublicFeedRefresh");
paths["/api/v1/public/feed/refresh"].get["x-implementation-phase"]="R4";
endpoint("/api/v1/public/feed/{entry}",null,"PublicEntry");
endpoint("/api/v1/public/feed/{entry}/comments","PublicCommentsQuery","PublicCommentsPage");
endpoint("/api/v1/public/search","PublicSearchQuery","PublicSearchPage");
const spec={openapi:"3.1.0",info:{title:"Skillora public browsing",version:"1.0.0-g2",description:"G2 public read APIs are implemented behind the default-disabled PUBLIC_BROWSING_ENABLED release gate."},"x-live":false,"x-semantic-rules":["Current source/author/company/project/moderation eligibility before projection and pagination","Public-safe comment authors and parent thread context","Category-specific filters and exact compensation units","Matching resource IDs, paths, response scope and entry/comment ownership","No private portfolio tokens in discovery","Opaque scope-bound expiring cursors","No exposure/history/analytics writes for guest reads"],paths,components:{schemas}};
const artifacts=[["contracts/openapi/public-browsing-v1.json",JSON.stringify(spec,null,2)+"\n"],["apps/web/src/types/generated/public-browsing-v1.ts","/** Generated public contracts. G2 endpoints require the separately controlled Laravel public-browsing release gate. */\n"+astToString(await openapiTS(spec))]];
for(const app of ["apps/api","apps/web"]){
  artifacts.push([`${app}/contracts/openapi/public-browsing-v1.json`,JSON.stringify(spec,null,2)+"\n"]);
  for(const name of ["validation/public-browsing.json","examples/public-browsing.json"])artifacts.push([`${app}/contracts/${name}`,readFileSync(new URL(`contracts/${name}`,root),"utf8")]);
}
for(const [path,content]of artifacts){const target=new URL(path,root);if(process.argv.includes("--check")){if(readFileSync(target,"utf8")!==content)throw new Error(`Regenerate ${path}`);}else{mkdirSync(new URL(".",target),{recursive:true});writeFileSync(target,content);}}
console.log(`Public browsing ${policy.phase} contracts and mirrors ${process.argv.includes("--check")?"match.":"generated."}`);
