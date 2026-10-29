import { z } from "zod";
import type { components } from "@/types/generated/application-wizard-v2";
import { applicationContactChallengeSchema, applicationContactVerifySchema, applicationDraftCreateSchema, applicationDraftDiscardSchema, applicationDraftListSchema, type ApplicationWizardValidationContext } from "@/lib/validation/application-wizard";
import { validateApplicationDraftSave, validateApplicationSubmission } from "./application-wizard.service";
import type {ApplicationWizardValues} from "@/lib/validation/application-wizard";
import type { HttpClient } from "../api/client";

type Schema = components["schemas"];
/** Typed application draft, contact, review and submission transport. Laravel remains authoritative. */
export function createHttpApplicationDraftService(http: HttpClient, onSubmitted:()=>void=()=>{}) {
  return {
    async context(jobId: string): Promise<Schema["ApplicationContext"]> {
      z.uuid().parse(jobId);
      return (await http.get<{data: Schema["ApplicationContext"]}>(`jobs/${jobId}/application-context`)).data;
    },
    async read(draftId: string): Promise<Schema["ApplicationDraft"]> {
      z.uuid().parse(draftId);
      return (await http.get<{data: Schema["ApplicationDraft"]}>(`me/application-drafts/${draftId}`)).data;
    },
    async list(input: unknown = {}): Promise<Schema["ApplicationDraftPage"]> {
      const query = applicationDraftListSchema.parse(input);
      return (await http.get<{data: Schema["ApplicationDraftPage"]}>("me/application-drafts", query)).data;
    },
    async create(jobId: string, input: unknown): Promise<Schema["ApplicationDraft"]> {
      z.uuid().parse(jobId);
      const values = applicationDraftCreateSchema.parse(input);
      return (await http.post<{data: Schema["ApplicationDraft"]}>(`jobs/${jobId}/application-drafts`, values)).data;
    },
    async save(draftId: string, input: unknown, context: ApplicationWizardValidationContext): Promise<Schema["ApplicationDraft"]> {
      const values = validateApplicationDraftSave(draftId, input, context);
      return (await http.patch<{data: Schema["ApplicationDraft"]}>(`me/application-drafts/${draftId}`, values)).data;
    },
    async discard(draftId: string, input: unknown): Promise<void> {
      z.uuid().parse(draftId);
      const values = applicationDraftDiscardSchema.parse(input);
      await http.delete(`me/application-drafts/${draftId}`, values);
    },
    async challenge(draftId: string, input: unknown): Promise<Schema["ApplicationChallengeStatus"]> {
      z.uuid().parse(draftId);
      const values = applicationContactChallengeSchema.parse(input);
      return (await http.post<{data: Schema["ApplicationChallengeStatus"]}>(`me/application-drafts/${draftId}/contact-challenges`, values)).data;
    },
    async contactStatus(draftId: string, challengeId: string): Promise<Schema["ApplicationChallengeStatus"]> {
      z.uuid().parse(draftId);
      z.uuid().parse(challengeId);
      return (await http.get<{data: Schema["ApplicationChallengeStatus"]}>(`me/application-drafts/${draftId}/contact-challenges/${challengeId}`)).data;
    },
    async verify(draftId: string, challengeId: string, input: unknown): Promise<Schema["ApplicationProofStatus"]> {
      z.uuid().parse(draftId);
      z.uuid().parse(challengeId);
      const values = applicationContactVerifySchema.parse(input);
      return (await http.post<{data: Schema["ApplicationProofStatus"]}>(`me/application-drafts/${draftId}/contact-challenges/${challengeId}/verify`, values)).data;
    },
    async review(draftId:string):Promise<Schema["ApplicationReview"]> {
      z.uuid().parse(draftId);
      return (await http.get<{data:Schema["ApplicationReview"]}>(`me/application-drafts/${draftId}/review`)).data;
    },
    async receipt(applicationId:string):Promise<Schema["ApplicationReceipt"]> {
      z.uuid().parse(applicationId);
      return (await http.get<{data:Schema["ApplicationReceipt"]}>(`me/applications/${applicationId}/receipt`)).data;
    },
    async submit(jobId:string,input:unknown,values:ApplicationWizardValues,context:ApplicationWizardValidationContext):Promise<Schema["ApplicationReceipt"]> {
      const command=validateApplicationSubmission(jobId,input,values,context);
      const receipt=(await http.post<{data:Schema["ApplicationReceipt"]}>(`jobs/${jobId}/applications`,command,{headers:{"X-Skillora-Application-Schema":"2"}})).data;
      onSubmitted();return receipt;
    },
  };
}
