import type {Metadata} from "next";
import {PublicSearchScreen} from "@/features/public-browsing/public-search-screen";
import type {PublicRouteInput} from "@/features/public-browsing/public-routing";
export const metadata:Metadata={title:"Search"};
export default async function SearchPage({searchParams}:{searchParams:Promise<PublicRouteInput>}){return <PublicSearchScreen input={await searchParams}/>;}
