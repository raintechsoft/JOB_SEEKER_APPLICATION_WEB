import {publicCommentsQuerySchema,publicEntryIdSchema,publicFeedQuerySchema,publicSearchQuerySchema,type PublicSearchQuery} from "@/lib/validation/public-browsing";
import {publicResourcePathSchema} from "@/lib/validation/public-browsing";
import {apiConfig} from "@/services/api/config";
import type {PublicFeedEntry} from "@/services/public-browsing/public-browsing.service";
import type {MediaItem} from "@/types/domain";

export type PublicRouteInput=Record<string,string|string[]|undefined>;
export function publicParams(values:Pick<URLSearchParams,"keys"|"getAll">):PublicRouteInput{
  return Object.fromEntries([...new Set(values.keys())].map(key=>{const found=values.getAll(key);return [key,found.length===1?found[0]:found];}));
}
// Pagination tokens stay inside the read service; public URLs contain human-readable filters only.
const publicFeedLocation=publicFeedQuerySchema.refine(value=>value.cursor===undefined,{path:["cursor"],message:"Open the feed again to start a new page."});
const publicSearchLocation=publicSearchQuerySchema.refine(value=>value.cursor===undefined,{path:["cursor"],message:"Start a new search instead of reusing a pagination link."});
export const readPublicFeed=(input:PublicRouteInput)=>publicFeedLocation.safeParse(input);
export const readPublicSearch=(input:PublicRouteInput)=>publicSearchLocation.safeParse(input);
export function readPublicEntry(id:string,input:PublicRouteInput){
  if(Object.keys(input).some(key=>key!=="comment"))return null;
  const entry=publicEntryIdSchema.safeParse(id),comments=publicCommentsQuerySchema.safeParse(input.comment===undefined?{}:{focus:input.comment});
  return entry.success&&comments.success?{id:entry.data,comments:comments.data}:null;
}
export function publicSearchHref(input:unknown){
  const {q,scope,sort,limit,cursor,...rest}=publicSearchQuerySchema.parse(input);void cursor;
  const params=new URLSearchParams({q,scope});
  if(sort!=="relevance")params.set("sort",sort);
  if(limit!==20)params.set("limit",String(limit));
  for(const [key,value]of Object.entries(rest))if(value!==undefined)params.set(key,String(value));
  return `/search?${params}`;
}
export const PUBLIC_QUERY_OPTIONS={staleTime:0,gcTime:0,retry:false as const,refetchOnWindowFocus:true,placeholderData:()=>undefined};
export type PublicScope=PublicSearchQuery["scope"];
export function publicMediaUrl(path:string){
  if(!/^\/api\/v1\/media\/[0-9a-f-]{36}\/download$/i.test(path))throw new Error("Invalid public media path.");
  return new URL(path,new URL(apiConfig.baseUrl).origin).toString();
}
export function publicEntryMedia(entry:PublicFeedEntry):MediaItem[]{
  return [
    ...entry.media.map((file,index)=>({position:file.position??index,type:file.kind,src:publicMediaUrl(file.downloadPath),name:file.name,alt:file.alt})),
    ...(entry.externalVideos??[]).map(file=>({position:file.position,type:"video" as const,src:file.url,name:file.name,alt:file.alt})),
  ].sort((a,b)=>a.position-b.position).map(({position,...file})=>{void position;return file;});
}
export function publicShareUrl(path:string,origin:string){
  const checked=publicResourcePathSchema.parse(path),site=new URL(origin);
  if(!["http:","https:"].includes(site.protocol)||site.username||site.password)throw new Error("Invalid site address.");
  return new URL(checked,site.origin).toString();
}
