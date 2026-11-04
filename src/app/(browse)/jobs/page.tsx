import type {Metadata} from "next";
import {PublicFeedScreen} from "@/features/public-browsing/public-feed-screen";
import type {PublicRouteInput} from "@/features/public-browsing/public-routing";
export const metadata:Metadata={title:"Open opportunities"};
export default async function JobsPage({searchParams}:{searchParams:Promise<PublicRouteInput>}){return <PublicFeedScreen input={await searchParams} jobs/>;}
