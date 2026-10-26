import {readFileSync,writeFileSync} from "node:fs";
const root=new URL("../../../",import.meta.url);
const api=JSON.parse(readFileSync(new URL("contracts/openapi/phase-8.json",root),"utf8"));
for(const phase of [9,10,11]){
 api.info.version=`0.${phase}.0`;
 api.info.description="Cumulative Laravel REST contract. Embedding registration and offline ML are trusted operator workflows, not public model-training endpoints. Optional learned ranking retains the baseline and current authorization.";
 if(phase===11){for(const schema of Object.values(api.components.schemas)){if(schema.properties?.strategyVersion)schema.properties.strategyVersion={type:"string",minLength:1,maxLength:100};}}
 if(phase===11){api.components.schemas.EmployerMobile.properties={country:{type:"string",pattern:"^[A-Z]{2}$",description:"ISO 3166-1 alpha-2 region. libphonenumber supplies the calling code and validates the national number."},mobile:{type:"string",pattern:"^[0-9]{4,15}$",description:"National number digits. libphonenumber validates the length and pattern for the selected region."}};}
 const target=new URL(`contracts/openapi/phase-${phase}.json`,root),output=JSON.stringify(api,null,2)+"\n";
 if(process.argv.includes("--check")){if(readFileSync(target,"utf8").replaceAll("\r\n","\n")!==output)throw new Error(`Phase ${phase} contract is stale`);}else writeFileSync(target,output);
}
