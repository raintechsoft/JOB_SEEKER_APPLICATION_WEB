import { z } from "zod";
import contract from "../../../../../contracts/validation/communication.json";
import {validateMedia} from "./profile";

const text=(max:number)=>z.string().trim().refine((v)=>[...v].length<=max,`Use at most ${max} characters.`);
export const messageAttachmentSchema=z.object({id:z.uuid(),name:text(180).min(1).regex(/^[^\\/\u0000-\u001f]+$/),type:z.enum(["image/png","image/jpeg","image/webp","image/gif","application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/rtf","text/rtf","text/plain"]),size:z.number().int().min(1).max(contract.attachmentBytesMax),data:z.string().url().regex(/^https?:\/\/[^?#]+\/api\/v1\/media\/[0-9a-f-]{36}\/download$/i),image:z.boolean()}).superRefine((a,ctx)=>{if(a.image!==a.type.startsWith("image/")||a.image&&a.size>contract.imageBytesMax)ctx.addIssue({code:"custom",message:"Choose an image up to 1 MB, or a supported document up to 2 MB."});if(!a.data.endsWith(`/media/${a.id}/download`))ctx.addIssue({code:"custom",path:["id"],message:"Select this attachment again."});});
export const messageSchema=z.object({text:text(contract.messageMax),attachments:z.array(messageAttachmentSchema).max(contract.attachmentMax)}).superRefine((v,ctx)=>{if(!v.text&&!v.attachments.length)ctx.addIssue({code:"custom",path:["text"],message:"Write a message or attach a file."});if(new Set(v.attachments.map((a)=>a.id)).size!==v.attachments.length)ctx.addIssue({code:"custom",path:["attachments"],message:"Choose each attachment once."});});
export const reportSchema=z.object({reason:z.enum(["Spam or unwanted messages","Harassment","Misleading job or identity","Other"]),details:text(contract.reportDetailsMax)}).superRefine((v,ctx)=>{if(v.reason==="Other"&&!v.details)ctx.addIssue({code:"custom",path:["details"],message:"Describe the issue you are reporting."});});
export const inboxSchema=z.object({q:text(200),filter:z.enum(["all","jobs","unread","starred","archived"]),selectedId:z.uuid().nullable()});
export const conversationFlagSchema=z.enum(["jobLabelBy","mutedBy","archivedBy","blockedBy","starredBy","deletedBy"]);
export const notificationPreferenceSchema=z.object({category:z.enum(["messages","applications","job_alerts"]),channel:z.enum(["in_app","email","sms"]),enabled:z.boolean()});
export const outreachSendSchema=z.object({id:z.uuid(),version:z.number().int().min(1),confirmed:z.literal(true,{error:"Confirm the reviewed recipients and message before queuing delivery."})});
export const exportRequestSchema=z.object({ids:z.array(z.uuid()).min(1).max(5000).refine((ids)=>new Set(ids).size===ids.length,"Choose each response once.")});
export const administrativeActionSchema=z.object({id:z.uuid(),version:z.number().int().min(1),action:z.enum(["hide_profile","restore_profile","suspend","restore"]),reason:text(1500).min(10,"Explain this action in at least 10 characters.")});
export const verificationReviewSchema=z.object({id:z.uuid(),version:z.number().int().min(1),decision:z.enum(["verified","action_required"]),reason:text(1500).min(10,"Record the verification decision and reason.")});
export function validateMessageFile(file:File,currentCount:number,image:boolean) {
 if(currentCount>=contract.attachmentMax)return "Attach up to three files per message.";
 const error=validateMedia(file,"message_attachment");if(error)return error;
 if(image!==file.type.startsWith("image/")||image&&file.size>contract.imageBytesMax)return "Choose an image up to 1 MB, or a supported document up to 2 MB.";
 return null;
}
