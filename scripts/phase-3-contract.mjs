import { readFileSync,writeFileSync } from "node:fs";
const root=new URL("../../../",import.meta.url),read=(p)=>JSON.parse(readFileSync(new URL(p,root),"utf8"));
const api=read("contracts/openapi/phase-2.json"),work=read("contracts/validation/work.json"),portfolio=read("contracts/validation/portfolio.json"),schemas=api.components.schemas;
const str={type:"string"},bool={type:"boolean"},int={type:"integer"},uuid={type:"string",format:"uuid"},ref=(name)=>({$ref:`#/components/schemas/${name}`}),array=(items)=>({type:"array",items});
const object=(properties,required=Object.keys(properties),additionalProperties=false)=>({type:"object",properties,required,additionalProperties});
const fields=(definitions)=>{const properties={},required=[];for(const[key,value]of Object.entries(definitions)){const[type,a]=value.replace(/!$/,"").split(":");const schema={...str};if(type==="text")schema.maxLength=Number(a);if(type==="enum")schema.enum=a.split("|");if(type==="date")schema.format="date";if(type==="url")schema.maxLength=2048;if(value.endsWith("!")){schema.minLength=1;required.push(key);}properties[key]=schema;}return object(properties,required);};
schemas.PublicProfessional.properties.person.properties.category={enum:["Design","Engineering","Data","Business"]};
schemas.PublicProfessional.properties.person.properties.credentials.properties.breaks.items.required=["start","end","current","description"];
schemas.PublicProfessional.properties.person.properties.credentials.properties.groups.items.properties.records.items.required=["title"];
const projectInput=fields(work.project);Object.assign(projectInput.properties,{id:uuid,version:{...int,minimum:1},skills:{...array({...str,minLength:1,maxLength:100}),minItems:1,maxItems:30,uniqueItems:true},featured:bool,cover_asset_id:{anyOf:[uuid,{type:"null"}]}});projectInput.required.push("skills","featured");
schemas.ProjectInput=projectInput;
schemas.WorkProject=object({...fields(work.project).properties,id:uuid,owner:uuid,version:int,skills:array(str),featured:bool,art:int,cover:str});
const updateInput=fields(work.update);Object.assign(updateInput.properties,{id:uuid,version:{...int,minimum:1},skills:projectInput.properties.skills,project:{anyOf:[uuid,{const:""},{type:"null"}]}});updateInput.required.push("skills");schemas.WorkUpdateInput=updateInput;
schemas.WorkUpdate=object({...fields(work.update).properties,id:uuid,owner:uuid,version:int,skills:array(str),project:{anyOf:[uuid,{const:""}]}});
schemas.WorkPulse=object({cells:array(object({date:str,count:int})),months:array(str),totalDays:int,updateCount:int,activeDays:int,projectCount:int,recentDays:array(int)});
schemas.PortfolioConfig=object({title:str,headline:str,slug:str,theme:str,public:bool,version:int,sections:array(object({name:{enum:portfolio.sections},visible:bool})),expiry:str,otp:{const:false}},["title","headline","slug","theme","public","sections","expiry","otp"]);
schemas.PortfolioView=object({person:structuredClone(schemas.PublicProfessional.properties.person),config:ref("PortfolioConfig"),projects:array(ref("WorkProject")),updates:array(ref("WorkUpdate")),accessGranted:bool,shareLink:{anyOf:[object({id:uuid,expiresAt:{type:["string","null"]}}),{type:"null"}]}},["person","config","projects","updates","accessGranted"]);
schemas.PortfolioInput=fields(portfolio.fields);Object.assign(schemas.PortfolioInput.properties,{public:bool,version:{...int,minimum:1}});schemas.PortfolioInput.required.push("public","version");
schemas.PortfolioShareInput=object({version:{...int,minimum:1},public:bool,otp:{const:false},expiry:{type:["string","null"]}},["version","public","otp"]);
schemas.PortfolioShare=object({id:uuid,url:str,expiresAt:{type:["string","null"]},version:int});
schemas.ProfileSnapshot.properties.projects=array(ref("WorkProject"));schemas.PublicProfessional.properties.projects=array(ref("WorkProject"));schemas.PublicProfessional.properties.updates=array(ref("WorkUpdate"));
schemas.MediaInit.properties.purpose.enum.push("project_cover");
function route(path,method,output,input,options={}){
  const parameters=[...path.matchAll(/\{([^}]+)\}/g)].map((m)=>({name:m[1],in:"path",required:true,schema:str}));
  const data=typeof output === "string" ? ref(output) : output;
  const response=output ? {description:"Success",content:{"application/json":{schema:object({data,...(options.page ? {meta:object({next_cursor:{type:["string","null"]}})} : {})})}}} : {description:"No content"};
  const value={operationId:`phase3_${method}_${path.replace(/[^a-zA-Z0-9]+/g,"_")}`,parameters,responses:{[options.status ?? (output ? "200" : "204")]:response,default:{$ref:"#/components/responses/Error"}}};
  if(options.public)value.security=[];
  if(options.query)for(const[name,schema]of Object.entries(options.query))value.parameters.push({name,in:"query",required:false,schema});
  if(input)value.requestBody={required:true,content:{"application/json":{schema:typeof input === "string" ? ref(input) : input}}};
  api.paths[path] ??={};api.paths[path][method]=value;
}
const page={cursor:{...str,maxLength:1000},limit:{...int,minimum:1,maximum:100},share:{...str,pattern:"^[a-f0-9]{64}$"}},projects={...page,q:{...str,maxLength:200},category:{enum:["Design","Engineering","Data","Business"]},visibility:{enum:["Public","Private"]}},updates={...page,date:{...str,format:"date"},publicOnly:bool};
route("/work/projects","get",array(ref("WorkProject")),null,{public:true,query:{"ids[]":{...array(uuid),maxItems:50},share:page.share}});
route("/work/projects/{project}","get","WorkProject",null,{public:true,query:{share:page.share}});route("/work/updates/{update}","get","WorkUpdate",null,{public:true,query:{share:page.share}});
for(const scope of ["/me","/professionals/{professional}"]){const publicScope=scope!=="/me";route(`${scope}/projects`,"get",array(ref("WorkProject")),null,{public:publicScope,page:true,query:projects});route(`${scope}/updates`,"get",array(ref("WorkUpdate")),null,{public:publicScope,page:true,query:updates});route(`${scope}/pulse`,"get","WorkPulse",null,{public:publicScope,query:{days:{enum:[91,365]},share:page.share}});}
route("/me/projects","post","WorkProject","ProjectInput");route("/me/updates","post","WorkUpdate","WorkUpdateInput");
route("/me/projects/{project}","delete",null,object({version:int}));route("/me/updates/{update}","delete",null,object({version:int}));route("/me/projects/{project}/featured","patch",null,object({version:int,featured:bool}));route("/me/projects/{project}/move","post",null,object({version:int,offset:{enum:[-1,1]}}));
route("/me/portfolio","get","PortfolioView");route("/me/portfolio","patch","PortfolioView","PortfolioInput");route("/me/portfolio/sections/{index}","patch","PortfolioView",object({version:int,visible:bool,offset:{enum:[-1,1]}},["version"]));
route("/me/portfolio/shares","post","PortfolioShare","PortfolioShareInput",{status:201});route("/me/portfolio/shares/{link}","delete",null,object({version:int}));route("/portfolios/{slug}","get","PortfolioView",null,{public:true,query:{share:page.share}});
api.components.parameters ??={};api.components.parameters.ActorContext={name:"X-Skillora-User",in:"header",required:false,description:"Optional observed-account consistency check. A mismatched authenticated account returns 412; this header never grants access.",schema:uuid};
for(const path of Object.values(api.paths))for(const [method,operation]of Object.entries(path))if(["get","post","patch","delete"].includes(method)){operation.parameters ??=[];operation.parameters.push({$ref:"#/components/parameters/ActorContext"});}
api.info.title="Skillora API through Phase 3";api.info.version="1.3.0";api.info.description+=" Phase 3 adds owned work records, UTC Work Pulse, filtered public evidence, revisioned portfolios and hashed expiring/revocable sharing. Project/update edits require version with id. Public updates linked to a subsequently hidden project are excluded from public lists and counts. OTP/QR sharing is not enabled in real mode.";
const output=JSON.stringify(api,null,2)+"\n",destination=new URL("contracts/openapi/phase-3.json",root);
if(process.argv.includes("--check")){if(readFileSync(destination,"utf8").replaceAll("\r\n","\n")!==output)throw new Error("Phase 3 contract is stale.");}else writeFileSync(destination,output);
