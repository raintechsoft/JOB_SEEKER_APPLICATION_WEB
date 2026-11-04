import {z} from "zod";
import type {components} from "@/types/generated/api";
import type {Role} from "@/types/domain";
import {ApiError} from "../api/client";
import type {ReadScope} from "../realtime/realtime.http";
import type {HttpClient} from "../api/client";
import type {AuthService} from "../auth/auth.service";
import type {ConversationView,MessagingService} from "./messaging.service";
import {conversationFlagSchema,deliveredSchema,inboxSchema,messageSchema,reportSchema} from "@/lib/validation/communication";
import {socialRoleSchema} from "@/lib/validation/social";
import contract from "../../../contracts/validation/communication.json";

export async function communicationPath(auth:AuthService,role?:Role,scope?:ReadScope){if(role)socialRoleSchema.parse(role);const session=await auth.me();scope?.signal?.throwIfAborted();if(scope?.userId&&session.user.id!==scope.userId||scope?.identityId&&session.selected_identity_id!==scope.identityId)throw new ApiError("Workspace changed.",412);const identity=session.workspaces.find((w)=>w.id===session.selected_identity_id);if(!identity||role&&identity.kind!==role)throw new Error("Select the matching workspace before continuing.");return `me/communications/${identity.id}`;}
function incomingUnacked(messages:{id:string;own:boolean;deliveredAt?:string|null}[]){return [...new Set(messages.filter((m)=>!m.own&&m.id&&!m.id.startsWith("pending-")&&!m.deliveredAt).map((m)=>m.id))];}
export function createHttpMessagingService(http:HttpClient,auth:AuthService):MessagingService&{reset():void}{
 let epoch=0;
 const guard=(version:number,scope?:ReadScope)=>{scope?.signal?.throwIfAborted();if(epoch!==version)throw new ApiError("Workspace changed.",412);};
 const views=new Map<string,ConversationView>(),sequences=new Map<string,number>(),attempts=new Map<string,string>();
 const deliveredAcked=new Set<string>(),deliveredPending=new Set<string>();
 const key=(role:Role,id:string)=>`${role}:${id}`;
 function remember(role:Role,c:ConversationView){views.set(key(role,c.id),c);if(c.readSequence!==undefined)sequences.set(key(role,c.id),c.readSequence);return c;}
 async function ackDelivered(role:Role,id:string,messages:{id:string;own:boolean;deliveredAt?:string|null}[],version:number,scope?:ReadScope){
  const ids=incomingUnacked(messages).filter((messageId)=>!deliveredAcked.has(messageId)&&!deliveredPending.has(messageId));
  if(!ids.length)return;
  ids.forEach((messageId)=>deliveredPending.add(messageId));
  try{
   const path=await communicationPath(auth,role,scope);
   guard(version,scope);
   for(let i=0;i<ids.length;i+=contract.deliveredIdsMax){
    const messageIds=ids.slice(i,i+contract.deliveredIdsMax);
    deliveredSchema.parse({messageIds});
    await http.patch(`${path}/conversations/${id}/delivered`,{messageIds});
    messageIds.forEach((messageId)=>deliveredAcked.add(messageId));
    guard(version,scope);
   }
  }finally{ids.forEach((messageId)=>deliveredPending.delete(messageId));}
 }
 return {
  reset(){epoch++;views.clear();sequences.clear();attempts.clear();deliveredAcked.clear();deliveredPending.clear();},
  async getUnreadCount(role,scope){const version=epoch;const data=(await http.get<{data:{unreadCount:number}}>(`${await communicationPath(auth,role,scope)}/unread-count`,undefined,scope)).data;guard(version,scope);return data.unreadCount;},
  async getInbox(role,query,scope){const version=epoch;socialRoleSchema.parse(role);const v=inboxSchema.parse(query);const data=(await http.get<{data:components["schemas"]["Inbox"]}>(`${await communicationPath(auth,role,scope)}/inbox`,{q:v.q,filter:v.filter,selectedId:v.selectedId??undefined},scope)).data;guard(version,scope);for(const t of data.threads)sequences.set(key(role,t.id),t.lastSequence);if(data.selected)remember(role,data.selected);if(data.selected)void ackDelivered(role,data.selected.id,data.selected.messages,version,scope).catch(()=>{});for(const t of data.threads)if(t.lastMessage)void ackDelivered(role,t.id,[t.lastMessage],version,scope).catch(()=>{});return data;},
  async getEarlier(role,id,before,scope){const version=epoch;socialRoleSchema.parse(role);z.uuid().parse(id);z.number().int().min(1).max(2147483647).parse(before);const data=(await http.get<{data:components["schemas"]["ConversationView"]}>(`${await communicationPath(auth,role,scope)}/conversations/${id}`,{before},scope)).data;guard(version,scope);void ackDelivered(role,id,data.messages,version,scope).catch(()=>{});return data;},
  async getHistory(role,id,limit,scope){const version=epoch;socialRoleSchema.parse(role);z.uuid().parse(id);z.number().int().min(50).max(500).parse(limit);const path=`${await communicationPath(auth,role,scope)}/conversations/${id}`;const first=(await http.get<{data:components["schemas"]["ConversationView"]}>(path,undefined,scope)).data;guard(version,scope);let before=first.nextBefore;while(before&&first.messages.length<limit){const page=(await http.get<{data:components["schemas"]["ConversationView"]}>(path,{before},scope)).data;guard(version,scope);first.messages.unshift(...page.messages);before=page.nextBefore;}first.nextBefore=before;remember(role,first);void ackDelivered(role,id,first.messages,version,scope).catch(()=>{});return first;},
  async listRecipients(role,scope){const version=epoch;const data=(await http.get<{data:components["schemas"]["SocialPerson"][]}>(`${await communicationPath(auth,role,scope)}/recipients`,undefined,scope)).data;guard(version,scope);return data;},
    async start(role,targetId){socialRoleSchema.parse(role);z.uuid().parse(targetId);return (await http.post<{data:{id:string}}>(`${await communicationPath(auth,role)}/conversations`,{targetId})).data.id;},
  async send(role,id,text,attachments){socialRoleSchema.parse(role);z.uuid().parse(id);const values=messageSchema.parse({text,attachments});const path=await communicationPath(auth,role),signature=JSON.stringify([path,id,values]);const clientMessageId=attempts.get(signature)??crypto.randomUUID();attempts.set(signature,clientMessageId);await http.post(`${path}/conversations/${id}/messages`,{text:values.text,assetIds:values.attachments.map((a)=>a.id),clientMessageId});attempts.delete(signature);return true;},
  async markRead(role,id,observed){socialRoleSchema.parse(role);z.uuid().parse(id);if(observed!==undefined)z.number().int().min(0).parse(observed);const path=await communicationPath(auth,role);let sequence=observed;if(sequence===undefined){const c=(await http.get<{data:ConversationView}>(`${path}/conversations/${id}`)).data;remember(role,c);sequence=c.readSequence;}z.number().int().min(0).parse(sequence);await http.patch(`${path}/conversations/${id}/read`,{sequence});},
  async markDelivered(role,id,messageIds){socialRoleSchema.parse(role);z.uuid().parse(id);const payload=deliveredSchema.parse({messageIds});await http.patch(`${await communicationPath(auth,role)}/conversations/${id}/delivered`,payload);},
  async markUnread(role,id){socialRoleSchema.parse(role);z.uuid().parse(id);await http.patch(`${await communicationPath(auth,role)}/conversations/${id}/read`,{sequence:null});},
  async toggleFlag(role,id,flag){socialRoleSchema.parse(role);z.uuid().parse(id);conversationFlagSchema.parse(flag);const path=await communicationPath(auth,role);let c=views.get(key(role,id));if(!c)c=remember(role,(await http.get<{data:ConversationView}>(`${path}/conversations/${id}`)).data);const field=({jobLabelBy:"jobLabel",mutedBy:"muted",archivedBy:"archived",blockedBy:"blocked",starredBy:"starred",deletedBy:"hidden"} as const)[flag];const enabled=field==="hidden"?true:!c.flags[field];const result=(await http.patch<{data:{enabled:boolean}}>(`${path}/conversations/${id}/flags`,{flag,enabled})).data.enabled;if(field!=="hidden")c.flags[field]=result;return result;},
  async report(role,id,reason,details){socialRoleSchema.parse(role);z.uuid().parse(id);const value=reportSchema.parse({reason,details});const path=await communicationPath(auth,role),signature=JSON.stringify([path,id,value]);const creationKey=attempts.get(signature)??crypto.randomUUID();attempts.set(signature,creationKey);await http.post(`${path}/reports`,{...value,targetKind:"conversation",targetId:id,creationKey});attempts.delete(signature);},
 };
}
