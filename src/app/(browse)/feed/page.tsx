import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {readPublicFeed} from "@/features/public-browsing/public-routing";
import {PublicInvalid} from "@/features/public-browsing/public-feedback";
import type {PublicRouteInput} from "@/features/public-browsing/public-routing";
export const metadata:Metadata={title:"Explore the community"};
export default async function FeedPage({searchParams}:{searchParams:Promise<PublicRouteInput>}){
  const input=await searchParams,checked=readPublicFeed(input);
  if(!checked.success)return <PublicInvalid reset="/"/>;
  const params=checked.success?new URLSearchParams(Object.entries(input).filter((entry):entry is [string,string]=>typeof entry[1]==="string")):null;
  redirect(params?.size?`/?${params}`:"/");
}
