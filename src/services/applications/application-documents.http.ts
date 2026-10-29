import {z} from "zod";
import type {components} from "@/types/generated/application-wizard-v2";
import type {HttpClient} from "../api/client";
import type {MediaService} from "../media/media.http";
import {validateMedia} from "@/lib/validation/profile";

export type ApplicationDocumentContext = components["schemas"]["ApplicationDocumentContext"];
export function validateApplicationResume(files: readonly File[]): string | null {
  if (files.length !== 1) return "Choose one resume.";
  return validateMedia(files[0], "resume");
}

/** A4 reuses managed uploads; it never replaces the profile resume or publishes an application. */
export function createApplicationDocumentService(http: HttpClient, media: MediaService) {
  return {
    async context(draftId: string): Promise<ApplicationDocumentContext> {
      z.uuid().parse(draftId);
      return (await http.get<{data: ApplicationDocumentContext}>(`me/application-drafts/${draftId}/documents`)).data;
    },
    async uploadResume(files: readonly File[]) {
      const issue = validateApplicationResume(files);
      if (issue) throw new Error(issue);
      return media.upload(files[0], "resume");
    },
    /** Removes a resume from the owner's library; the server deletes it from storage unless something else still uses it. */
    async removeResume(assetId: string): Promise<{deleted: boolean}> {
      z.uuid().parse(assetId);
      return (await http.delete<{data: {deleted: boolean}}>(`me/resume-library/${assetId}`)).data;
    },
    async previewResume(assetId: string) {
      z.uuid().parse(assetId);
      return http.blob(`media/${assetId}/download`);
    },
    async applicantDownload(applicationId: string, attachmentId: string) {
      z.uuid().parse(applicationId);
      z.uuid().parse(attachmentId);
      return http.blob(`me/applications/${applicationId}/attachments/${attachmentId}/download`);
    },
    async reviewerDownload(organizationId: string, applicationId: string, attachmentId: string) {
      for (const id of [organizationId, applicationId, attachmentId]) z.uuid().parse(id);
      return http.blob(`organizations/${organizationId}/hiring/responses/${applicationId}/attachments/${attachmentId}/download`);
    },
  };
}
