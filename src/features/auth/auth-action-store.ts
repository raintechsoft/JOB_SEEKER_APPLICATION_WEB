"use client";
import {create} from "zustand";
import type {AuthSession} from "@/services/auth/auth.service";
import type {GuestAction,GuestAccessDecision} from "@/lib/domain/guest-access";
import type {GuestIntent} from "@/lib/domain/guest-access";

export type ActionRequest={id:number;action:GuestAction;decision:GuestAccessDecision;anchor:HTMLElement|null;rect:{left:number;right:number;top:number;bottom:number};workspace?:"professional"|"recruiter";session?:AuthSession;intent?:GuestIntent|null;message?:string;retryAt?:number;reload?:boolean;retry:()=>void};
let sequence=0;
export const nextActionId=()=>++sequence;
export const useAuthActionStore=create<{request:ActionRequest|null;set:(request:ActionRequest|null)=>void}>((set)=>({request:null,set:request=>set({request})}));
export function closeAuthAction(restoreFocus=false){
  const request=useAuthActionStore.getState().request;useAuthActionStore.getState().set(null);
  if(restoreFocus&&request?.anchor?.isConnected){const anchor=request.anchor.getClientRects().length?request.anchor:request.anchor.closest('details')?.querySelector<HTMLElement>('summary')??request.anchor;anchor.focus();}
}
