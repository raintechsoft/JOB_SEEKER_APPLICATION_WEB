import { z } from "zod";
import type { components } from "@/types/generated/application-wizard-v2";
import {
  applicationContactChallengeSchema, applicationContactVerifySchema, applicationDraftCreateSchema, applicationDraftDiscardSchema,
  applicationDraftSaveSchema, applicationSubmitRequestSchema, applicationWizardStageSchema,
  type ApplicationWizardValidationContext, type ApplicationWizardValues,
} from "@/lib/validation/application-wizard";

export type ApplicationDraftSave = z.infer<typeof applicationDraftSaveSchema>;
export type ApplicationWizardSubmit = z.infer<typeof applicationSubmitRequestSchema>;
type Responses = components["schemas"];
/** Typed command port and validators, shared with the HTTP adapter and contract checks. */
export interface ApplicationWizardTransport {
  create(jobId: string, input: z.infer<typeof applicationDraftCreateSchema>): Promise<Responses["ApplicationDraft"]>;
  save(draftId: string, input: ApplicationDraftSave): Promise<Responses["ApplicationDraft"]>;
  discard(draftId: string, input: z.infer<typeof applicationDraftDiscardSchema>): Promise<void>;
  challenge(draftId: string, input: z.infer<typeof applicationContactChallengeSchema>): Promise<Responses["ApplicationChallengeStatus"]>;
  verify(draftId: string, challengeId: string, input: z.infer<typeof applicationContactVerifySchema>): Promise<Responses["ApplicationProofStatus"]>;
  submit(jobId: string, input: ApplicationWizardSubmit): Promise<Responses["ApplicationReceipt"]>;
}
function currentVersions(input: {requirementsVersion: number; questionsVersion: number; jobVersion: number}, context: ApplicationWizardValidationContext) {
  const current = context.requirements;
  if (input.requirementsVersion !== current.version || input.questionsVersion !== current.questionsVersion || input.jobVersion !== current.jobVersion) throw new Error("The application requirements changed. Review them before continuing.");
}
export function validateApplicationDraftSave(draftId: string, input: unknown, context: ApplicationWizardValidationContext): ApplicationDraftSave {
  z.uuid().parse(draftId);
  const parsed = applicationDraftSaveSchema.parse(input);
  if (parsed.intent === "advance") {
    currentVersions(parsed, context);
    if (parsed.step === "questions" && !context.requirements.questions.length) throw new Error("This job has no screening questions.");
    applicationWizardStageSchema(context, parsed.step).parse(parsed.values);
  }
  return parsed;
}
export function validateApplicationSubmission(jobId:string,input:unknown,values:ApplicationWizardValues,context:ApplicationWizardValidationContext):ApplicationWizardSubmit {
  z.uuid().parse(jobId);
  const parsed=applicationSubmitRequestSchema.parse(input);
  if(jobId!==context.jobId)throw new Error("Reload this job before applying.");
  currentVersions(parsed,context);
  applicationWizardStageSchema(context,"review").parse(values);
  if(parsed.reviewHash!==context.reviewHash)throw new Error("Review the current shared information before submitting.");
  return parsed;
}
/** Runtime validation always precedes transport. Cached checks only support UX; Laravel repeats all checks. */
export function createApplicationWizardCommands(transport: ApplicationWizardTransport) {
  return {
    create(jobId: string, input: unknown) { return transport.create(z.uuid().parse(jobId), applicationDraftCreateSchema.parse(input)); },
    save(draftId: string, input: unknown, context: ApplicationWizardValidationContext) {
      return transport.save(draftId, validateApplicationDraftSave(draftId, input, context));
    },
    discard(draftId: string, input: unknown) { return transport.discard(z.uuid().parse(draftId), applicationDraftDiscardSchema.parse(input)); },
    challenge(draftId: string, input: unknown) { return transport.challenge(z.uuid().parse(draftId), applicationContactChallengeSchema.parse(input)); },
    verify(draftId: string, challengeId: string, input: unknown) { return transport.verify(z.uuid().parse(draftId), z.uuid().parse(challengeId), applicationContactVerifySchema.parse(input)); },
    submit(jobId: string, input: unknown, values: ApplicationWizardValues, context: ApplicationWizardValidationContext) {
      const parsed=validateApplicationSubmission(jobId,input,values,context);
      return transport.submit(jobId, parsed);
    },
  };
}
