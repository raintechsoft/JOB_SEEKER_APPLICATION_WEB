import {readFileSync,writeFileSync} from "node:fs";
const root=new URL("../../../",import.meta.url);
for(const name of ["media","profile","organization","social","job","link-preview","activity-calendar","talent-discovery"]){
 const source=readFileSync(new URL(`contracts/validation/${name}.json`,root),"utf8").replaceAll("\r\n","\n");
 const target=new URL(`../contracts/validation/${name}.json`,import.meta.url);
 if(process.argv.includes("--check")){if(readFileSync(target,"utf8").replaceAll("\r\n","\n")!==source)throw Error(`Frontend ${name} validation contract differs from Laravel's source.`);}
 else writeFileSync(target,source);
}
