import { expect, it, vi } from "vitest";
import { organizationSchema, recruiterSchema, verificationSchema } from "@/lib/validation/organization";
import { onboardingSchema } from "@/lib/validation/onboarding";
import { createHttpOrganizationService, organizationInviteSchema } from "@/services/organization/organization.http";
import { createHttpOnboardingService } from "@/services/onboarding/onboarding.http";
import { createHttpClient } from "@/services/api/client";
import { createHttpAuthService } from "@/services/auth/auth.http";
import { getDb } from "@/mocks/store/demo-db";

it("rejects corrupted drafts without throwing and validates conditional verification/onboarding", () => {
  for (const draft of [null, {}, { socialLinks: null }, { workplaceImages: {} }]) expect(organizationSchema.safeParse(draft).success).toBe(false);
  expect(recruiterSchema.safeParse({ professionalLinks: null }).success).toBe(false);
  const verification = { registrationName: "Legal Name", registrationNumber: "123", jurisdiction: "India", representative: "Director", representativeTitle: "Founder", businessEmail: "contact@example.test", website: "https://example.test", documents: [] };
  expect(verificationSchema(false).safeParse(verification).success).toBe(true);
  expect(verificationSchema(true).safeParse(verification).success).toBe(false);
  expect(onboardingSchema(2).safeParse({ experience: "Engineer", education: "BSc", skills: ["PHP", "php"] }).success).toBe(false);
  expect(onboardingSchema(2).safeParse({ experience: "Engineer", education: "BSc", skills: ["PHP", "SQL"] }).success).toBe(true);
  expect(organizationInviteSchema.safeParse({ email: "wrong", fullName: "", role: "Owner", department: "" }).success).toBe(false);
});
it("invalid company, recruiter, invitation and onboarding data never reach transport", async () => {
  const client = createHttpClient("http://localhost:8000/api/v1");
  const post = vi.spyOn(client, "post"), patch = vi.spyOn(client, "patch"), get = vi.spyOn(client, "get");
  const organization = createHttpOrganizationService(client, createHttpAuthService(client));
  // Corrupted persisted state is untrusted even if a caller bypasses the forms.
  await expect(organization.saveOrganization({} as never, {} as never)).rejects.toThrow();
  await expect(organization.saveRecruiter({} as never)).rejects.toThrow();
  await expect(organization.invite({ fullName: "", email: "bad", role: "Recruiter", department: "" })).rejects.toThrow();
  await expect(createHttpOnboardingService(client, vi.fn()).saveStage(0, {}, 1)).rejects.toThrow();
  expect(post).not.toHaveBeenCalled(); expect(patch).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled();
});

it("requires only company identity fields and validates optional values only when supplied", () => {
  const organization = { ...structuredClone(getDb().organizationWorkspace.organization), version: 1, logoUrl:"",coverImageUrl:"",workplaceImages:[], companySize:"", headquartersCountry:"",headquartersCity:"",description:"" };
  expect(organizationSchema.safeParse(organization).success).toBe(true);
  for (const field of ["name","slug","industry"]) expect(organizationSchema.safeParse({...organization,[field]:""}).success).toBe(false);
  for (const patch of [{websiteUrl:"invalid-url"},{companySize:"unsupported"},{description:"x".repeat(2501)}]) expect(organizationSchema.safeParse({...organization,...patch}).success).toBe(false);
});
