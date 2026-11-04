import type {Metadata} from "next";
import {PublicEntryScreen} from "@/features/public-browsing/public-feed-screen";
import type {PublicRouteInput} from "@/features/public-browsing/public-routing";
export const metadata:Metadata={title:"Community post"};
export default async function EntryPage({params,searchParams}:{params:Promise<{entry:string}>;searchParams:Promise<PublicRouteInput>}){return <PublicEntryScreen id={(await params).entry} input={await searchParams}/>;}
