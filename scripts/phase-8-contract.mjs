import {readFileSync,writeFileSync} from "node:fs";
const root=new URL("../../../",import.meta.url),api=JSON.parse(readFileSync(new URL("contracts/openapi/phase-7.json",root),"utf8")),contract=JSON.parse(readFileSync(new URL("contracts/analytics/events.json",root),"utf8"));
const str={type:"string"},int={type:"integer"},bool={type:"boolean"},uuid={...str,format:"uuid"},obj=(properties,required=Object.keys(properties))=>({type:"object",properties,required,additionalProperties:false}),ref=name=>({$ref:`#/components/schemas/${name}`});
const s=api.components.schemas;
s.AnalyticsContext=obj({requestId:uuid,itemId:uuid,position:{...int,minimum:0,maximum:199}});
for(const name of ["SocialEntry","RecommendedJob","RecommendedTalent","RecommendedFeed","TalentCard"])s[name].properties.analyticsContext=ref("AnalyticsContext");
s.AnalyticsSettings=obj({available:bool,granted:bool,hasStoredConsent:bool,policyVersion:{...str,maxLength:80},policyUrl:{...str,maxLength:2048},retentionDays:{...int,minimum:0,maximum:365},version:{...int,minimum:0}});
s.AnalyticsConsent=obj({granted:bool,policyVersion:{...str,maxLength:80},version:{...int,minimum:0}});
const field=type=>type==='boolean'?bool:type==='surface'?{...str,enum:contract.surfaces}:type==='optional_count'?{...int,minimum:0,maximum:1000000}:type==='position'?{...int,minimum:0,maximum:199}:uuid;
s.AnalyticsEvent={oneOf:Object.entries(contract.browser).map(([name,fields])=>obj({id:uuid,name:{const:name},schemaVersion:{const:1},occurredAt:{...str,format:'date-time'},properties:obj(Object.fromEntries(Object.entries(fields).map(([key,type])=>[key,field(type)])),Object.keys(fields).filter(key=>fields[key]!=='optional_count'))}))};
s.AnalyticsBatch=obj({identityId:uuid,events:{type:"array",minItems:1,maxItems:20,items:ref("AnalyticsEvent")}});
for(const[path,method,input,out]of [["settings","get",null,"AnalyticsSettings"],["consent","patch","AnalyticsConsent","AnalyticsSettings"],["events","post","AnalyticsBatch",null]]){
 const operation={operationId:`phase8_${method}_${path}`,parameters:[{$ref:'#/components/parameters/ActorContext'}],responses:{[out?200:204]:out?{description:'Success',content:{'application/json':{schema:obj({data:ref(out)})}}}:{description:'No content'},default:{$ref:'#/components/responses/Error'}}};if(input)operation.requestBody={required:true,content:{'application/json':{schema:ref(input)}}};api.paths[`/me/analytics/${path}`]={[method]:operation};
}
api.info.version='0.8.0';api.info.description='Cumulative core plus disabled-by-default, explicit-consent optional analytics. Browser payloads are allowlisted; business conversions are server authoritative. Mixpanel requires separate provider configuration and activation approval.';
const output=JSON.stringify(api,null,2)+'\n',target=new URL('contracts/openapi/phase-8.json',root);
if(process.argv.includes('--check')){if(readFileSync(target,'utf8').replaceAll('\r\n','\n')!==output)throw new Error('Phase 8 contract is stale.');}else writeFileSync(target,output);
