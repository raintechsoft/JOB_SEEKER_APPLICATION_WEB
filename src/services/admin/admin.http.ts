import {z} from "zod";
import type {HttpClient} from "../api/client";
import type {AdminService} from "./admin.service";
import type {components} from "@/types/generated/api";
import {administrativeActionSchema,verificationReviewSchema} from "@/lib/validation/communication";
export const reportDecisionSchema=z.object({id:z.uuid(),version:z.number().int().min(1),action:z.enum(["review","dismiss","remove_content"]),reason:z.string().trim().min(10).max(1500)});
export const deliveryRetrySchema=z.object({id:z.uuid(),expectedAttempts:z.number().int().min(0).max(999995),reason:z.string().trim().min(10).max(1500)});
export function createHttpAdminService(http:HttpClient):AdminService{return {
 async downloadEvidence(id){z.uuid().parse(id);return http.blob(`media/${id}/download`);},
 session:async()=>(await http.get<{data:{id:string;name:string}}>("admin/session")).data,
 getOverview:async()=>(await http.get<{data:components["schemas"]["AdminOverview"]}>("admin/overview")).data,
 getProfessionals:async()=>(await http.get<{data:components["schemas"]["AdminProfessional"][]}>("admin/professionals")).data,
 listProfessionals:async()=>(await http.get<{data:components["schemas"]["AdminProfessional"][]}>("admin/professionals")).data,
 async profileAction(id,input){const v=administrativeActionSchema.parse({id,...input});const {id:target,...body}=v;await http.patch(`admin/professionals/${target}`,body);},
 verifications:async()=>(await http.get<{data:components["schemas"]["VerificationReviewItem"][]}>("admin/verifications")).data,
 async reviewVerification(id,input){const {id:target,...v}=verificationReviewSchema.parse({id,...input});await http.patch(`admin/verifications/${target}`,v);},
 reports:async()=>(await http.get<{data:components["schemas"]["AdminReport"][]}>("admin/reports")).data,
 async reviewReport(id,input){const {id:target,...v}=reportDecisionSchema.parse({id,...input});await http.patch(`admin/reports/${target}`,v);},
 deliveries:async()=>(await http.get<{data:components["schemas"]["DeliveryStatus"][]}>("admin/deliveries")).data,
 async retryDelivery(id,expectedAttempts,reason){const {id:target,...v}=deliveryRetrySchema.parse({id,expectedAttempts,reason});await http.post(`admin/deliveries/${target}/retry`,v);},
 async toggleProfessionalVisibility(){throw new Error("Choose a reviewed platform action and record its reason.");},
 async listCompanies(){throw new Error("Review specific pending verification submissions.");},
 async markCompanyVerified(){throw new Error("Review a specific pending verification submission and its evidence.");},
};}
