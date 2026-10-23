import {z} from "zod";
import type {components} from "@/types/generated/api";
import type {Role} from "@/types/domain";
import type {HttpClient} from "../api/client";
import type {AuthService} from "../auth/auth.service";
import type {ConversationView,MessagingService} from "./messaging.service";
import {conversationFlagSchema,inboxSchema,messageSchema,reportSchema} from "@/lib/validation/communication";
import {socialRoleSchema} from "@/lib/validation/social";

export async function communicationPath(auth:AuthService,role?:Role){if(role)socialRoleSchema.parse(role);const session=await auth.me();const identity=session.workspaces.find((w)=>w.id===session.selected_identity_id);if(!identity||role&&identity.kind!==role)throw new Error("Select the matching workspace before continuing.");return `me/communications/${identity.id}`;}
export function createHttpMessagingService(http:HttpClient,auth:AuthService):MessagingService&{reset():void}{
 const views=new Map<string,ConversationView>(),sequences=new Map<string,number>(),attempts=new Map<string,string>();
 const key=(role:Role,id:string)=>`${role}:${id}`;
 function remember(role:Role,c:ConversationView){views.set(key(role,c.id),c);if(c.readSequence!==undefined)sequences.set(key(role,c.id),c.readSequence);return c;}
 return {
  reset(){views.clear();sequences.clear();attempts.clear();},
  async getUnreadCount(role){return (await http.get<{data:{unreadCount:number}}>(`${await communicationPath(auth,role)}/unread-count`)).data.unreadCount;},
  async getInbox(role,query){socialRoleSchema.parse(role);const v=inboxSchema.parse(query);const data=(await http.get<{data:components["schemas"]["Inbox"]}>(`${await communicationPath(auth,role)}/inbox`,{q:v.q,filter:v.filter,selectedId:v.selectedId??undefined})).data;for(const t of data.threads)sequences.set(key(role,t.id),t.lastSequence);if(data.selected)remember(role,data.selected);return data;},
  async getEarlier(role,id,before){socialRoleSchema.parse(role);z.uuid().parse(id);z.number().int().min(1).max(2147483647).parse(before);return (await http.get<{data:components["schemas"]["ConversationView"]}>(`${await communicationPath(auth,role)}/conversations/${id}`,{before})).data;},
  async getHistory(role,id,limit){socialRoleSchema.parse(role);z.uuid().parse(id);z.number().int().min(50).max(500).parse(limit);const path=`${await communicationPath(auth,role)}/conversations/${id}`;const first=(await http.get<{data:components["schemas"]["ConversationView"]}>(path)).data;let before=first.nextBefore;while(before&&first.messages.length<limit){const page=(await http.get<{data:components["schemas"]["ConversationView"]}>(path,{before})).data;first.messages.unshift(...page.messages);before=page.nextBefore;}first.nextBefore=before;return first;},
  async listRecipients(role){return (await http.get<{data:components["schemas"]["SocialPerson"][]}>(`${await communicationPath(auth,role)}/recipients`)).data;},
  async start(role,targetId){socialRoleSchema.parse(role);z.uuid().parse(targetId);return (await http.post<{data:{id:string}}>(`${await communicationPath(auth,role)}/conversations`,{targetId})).data.id;},
  async send(role,id,text,attachments){socialRoleSchema.parse(role);z.uuid().parse(id);const values=messageSchema.parse({text,attachments});const path=await communicationPath(auth,role),signature=JSON.stringify([path,id,values]);const clientMessageId=attempts.get(signature)??crypto.randomUUID();attempts.set(signature,clientMessageId);await http.post(`${path}/conversations/${id}/messages`,{text:values.text,assetIds:values.attachments.map((a)=>a.id),clientMessageId});attempts.delete(signature);return true;},
  async markRead(role,id,observed){socialRoleSchema.parse(role);z.uuid().parse(id);if(observed!==undefined)z.number().int().min(0).parse(observed);const path=await communicationPath(auth,role);let sequence=observed??sequences.get(key(role,id));if(sequence===undefined){const c=(await http.get<{data:ConversationView}>(`${path}/conversations/${id}`)).data;remember(role,c);sequence=c.readSequence;}z.number().int().min(0).parse(sequence);await http.patch(`${path}/conversations/${id}/read`,{sequence});},
  async markUnread(role,id){socialRoleSchema.parse(role);z.uuid().parse(id);await http.patch(`${await communicationPath(auth,role)}/conversations/${id}/read`,{sequence:null});},
  async toggleFlag(role,id,flag){socialRoleSchema.parse(role);z.uuid().parse(id);conversationFlagSchema.parse(flag);const path=await communicationPath(auth,role);let c=views.get(key(role,id));if(!c)c=remember(role,(await http.get<{data:ConversationView}>(`${path}/conversations/${id}`)).data);const field=({jobLabelBy:"jobLabel",mutedBy:"muted",archivedBy:"archived",blockedBy:"blocked",starredBy:"starred",deletedBy:"hidden"} as const)[flag];const enabled=field==="hidden"?true:!c.flags[field];const result=(await http.patch<{data:{enabled:boolean}}>(`${path}/conversations/${id}/flags`,{flag,enabled})).data.enabled;if(field!=="hidden")c.flags[field]=result;return result;},
  async report(role,id,reason,details){socialRoleSchema.parse(role);z.uuid().parse(id);const value=reportSchema.parse({reason,details});const path=await communicationPath(auth,role),signature=JSON.stringify([path,id,value]);const creationKey=attempts.get(signature)??crypto.randomUUID();attempts.set(signature,creationKey);await http.post(`${path}/reports`,{...value,targetKind:"conversation",targetId:id,creationKey});attempts.delete(signature);},
 };
}
