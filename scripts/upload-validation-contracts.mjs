import {existsSync,readFileSync,writeFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
// Laravel's copy is the source. Default: the backend repository checked out next to this one; override with CONTRACTS_SOURCE.
const root=process.env.CONTRACTS_SOURCE?pathToFileURL(process.env.CONTRACTS_SOURCE.replace(/[\\/]*$/,"/")):new URL("../../JOB_SEEKER_APPLICATION_BACKEND/contracts/",import.meta.url);
for(const name of ["media","profile","organization","social","job","link-preview","activity-calendar","talent-discovery"]){
 const file=new URL(`validation/${name}.json`,root);
 if(!existsSync(file)){console.warn(`Skipping ${name}: Laravel contract not found at ${file.pathname}.`);continue;}
 const source=readFileSync(file,"utf8").replaceAll("\r\n","\n");
 const target=new URL(`../contracts/validation/${name}.json`,import.meta.url);
 if(process.argv.includes("--check")){if(readFileSync(target,"utf8").replaceAll("\r\n","\n")!==source)throw Error(`Frontend ${name} validation contract differs from Laravel's source.`);}
 else writeFileSync(target,source);
}
