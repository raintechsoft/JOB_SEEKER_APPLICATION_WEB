import type {Metadata} from "next";
import {PlatformHomeScreen} from "@/features/public-browsing/platform-home";
import type {PublicRouteInput} from "@/features/public-browsing/public-routing";

export const metadata:Metadata={title:"Discover work and opportunities"};
export default async function PlatformHome({searchParams}:{searchParams:Promise<PublicRouteInput>}){
  return <PlatformHomeScreen input={await searchParams}/>;
}
