import {create} from "zustand";
import type {MessageAttachment} from "@/types/domain";
export interface MessageDraft{text:string;files:MessageAttachment[];busy:boolean}
export const EMPTY_DRAFT:MessageDraft={text:"",files:[],busy:false};
export const useDrafts=create<{drafts:Record<string,MessageDraft>;patch:(key:string,patch:Partial<MessageDraft>)=>void;clear:(key:string)=>void}>((set)=>({
 drafts:{},patch:(key,patch)=>set((s)=>({drafts:{...s.drafts,[key]:{...(s.drafts[key]??EMPTY_DRAFT),...patch}}})),
 clear:(key)=>set((s)=>{const drafts={...s.drafts};delete drafts[key];return {drafts};}),
}));
export function resetMessageDrafts(){useDrafts.setState({drafts:{}});}
