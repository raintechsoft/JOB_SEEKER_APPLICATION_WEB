import type {Metadata} from "next";
import {PublicEntryScreen} from "@/features/public-browsing/public-feed-screen";
import type {PublicRouteInput} from "@/features/public-browsing/public-routing";
import {publicEntryMetadata} from "@/features/public-browsing/public-entry-metadata";
import {siteOrigin} from "@/lib/site-origin";
import {apiConfig} from "@/services/api/config";
import {publicEntryIdSchema,publicEntrySchema} from "@/lib/validation/public-browsing";

const FALLBACK:Metadata={title:"Community post"};

// Link previews are fetched by crawlers without a session, so the metadata reads the public entry
// through the same unauthenticated endpoint the page itself uses. Any failure keeps the generic title.
export async function generateMetadata({params}:{params:Promise<{entry:string}>}):Promise<Metadata>{
  const id=publicEntryIdSchema.safeParse((await params).entry);
  if(!id.success||apiConfig.dataSource!=="http"||!apiConfig.baseUrl)return FALLBACK;
  try{
    const site=await siteOrigin();
    if(!site)return FALLBACK;
    const api=new URL(apiConfig.baseUrl);
    const response=await fetch(new URL(`${api.pathname.replace(/\/$/,"")}/public/feed/${id.data}`,api.origin),{headers:{Accept:"application/json",Origin:site,Referer:site+"/"},next:{revalidate:60}});
    if(!response.ok)return FALLBACK;
    const entry=publicEntrySchema.parse((await response.json() as {data:unknown}).data);
    return publicEntryMetadata(entry,site);
  }catch{
    return FALLBACK;
  }
}

export default async function EntryPage({params,searchParams}:{params:Promise<{entry:string}>;searchParams:Promise<PublicRouteInput>}){return <PublicEntryScreen id={(await params).entry} input={await searchParams}/>;}
