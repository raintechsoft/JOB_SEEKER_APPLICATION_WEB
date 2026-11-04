"use client";
import type {ReactNode} from "react";
import {ApiError} from "@/services/api/client";
import type {IconName} from "@/components/ui/icon";
import {LinkButton} from "@/components/ui/primitives";
import {StatePanel} from "@/components/ui/state-panel";
import {ErrorState,EmptyPanel} from "@/components/ui/state-views";

/** Empty public results: say what is missing and offer a next step. */
export function PublicEmpty({icon="search",title,description,action,compact}:{icon?:IconName;title:ReactNode;description?:ReactNode;action?:ReactNode;compact?:boolean}){
  return <EmptyPanel icon={icon} title={title} description={description} action={action} compact={compact}/>;
}

/**
 * Status-aware public failure. Unavailable (503), missing (404), rate limited (429, with a
 * countdown) and stale filter (422) failures each explain themselves; guests always stay on public pages.
 */
export function PublicFailure({error,onRetry,compact,resetHref="/",resetLabel="Start over",what="this content"}:{error:unknown;onRetry?:()=>unknown;compact?:boolean;resetHref?:string;resetLabel?:string;what?:string}){
  const status=error instanceof ApiError?error.status:0;
  if(status===422)return <StatePanel role="alert" compact={compact} icon="sliders" tone="info" title="This page needs a refresh" description="Check the search or filters and try again." actions={<LinkButton href={resetHref} variant="primary">{resetLabel}</LinkButton>}/>;
  const title=status===503?"Public browsing is unavailable":`We couldn’t load ${what}`;
  const description=status===503?"Public browsing is unavailable right now. Please try again in a moment.":"Something interrupted the request. Please try again.";
  return <ErrorState error={error} onRetry={onRetry} compact={compact} title={title} description={description} homeHref={resetHref} homeLabel={resetLabel}/>;
}

/** Invalid public links or filters; the action depends on where the visitor came from. */
export function PublicInvalid({title="This link isn’t valid",message="Check the link or selected filters.",reset="/",resetLabel="Reset filters"}:{title?:string;message?:string;reset?:string;resetLabel?:string}){
  return <StatePanel role="alert" icon="link" tone="info" title={title} description={message} actions={<LinkButton href={reset} variant="primary">{resetLabel}</LinkButton>}/>;
}
