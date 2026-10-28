import { phoneE164 } from "@/lib/validation/auth";
import { commit, getDb } from "@/mocks/store/demo-db";
import { slugify } from "@/lib/utils/text";
import { uid } from "@/lib/utils/id";
import type { OtpChallenge, RegistrationService } from "./registration.service";

interface StoredChallenge extends OtpChallenge {
  code: string;
  attempts: number;
  verified: boolean;
}

/** Challenges live in memory only, like the prototype's module-level `challenge`. */
const challenges = new Map<string, StoredChallenge>();

const verifiedTarget = (kind: "whatsapp" | "email", target: string) => [...challenges.values()].some((c) => c.kind === kind && c.target === target && c.verified);

export const mockRegistrationService: RegistrationService = {
  async requestOtp(kind, target) {
    for (const [id, c] of challenges) if (c.kind === kind) challenges.delete(id);
    const code = String((crypto.getRandomValues(new Uint32Array(1))[0] % 9e5) + 1e5);
    const challenge: StoredChallenge = { id: uid(), kind, target, sentAt: Date.now(), expiresAt: Date.now() + 3e5, code, attempts: 0, verified: false };
    challenges.set(challenge.id, challenge);
    return { id: challenge.id, kind, target, sentAt: challenge.sentAt, expiresAt: challenge.expiresAt, demoCode: code };
  },

  async verifyOtp(challengeId, target, code) {
    const c = challenges.get(challengeId);
    if (!c || c.target !== target) return { ok: false, error: "Request a new OTP to continue." };
    if (Date.now() > c.expiresAt) return { ok: false, error: "This OTP has expired. Resend OTP to get a new code." };
    if (c.attempts >= 5) return { ok: false, error: "Too many attempts. Resend OTP to try again." };
    c.attempts++;
    if (code !== c.code) return { ok: false, error: "That OTP is incorrect. Check the 6-digit demo code below and try again." };
    c.verified = true;
    return { ok: true };
  },

  async registerEmployer(input) {
    const phone = phoneE164(input.country, input.mobile);
    if (!verifiedTarget("whatsapp", phone) || !verifiedTarget("email", input.email)) return { ok: false, error: "Verify your mobile number and email ID before creating an account." };
    const db = getDb();
    const old = db.organizationWorkspace.recruiters.find((r) => r.id === "r0") ?? db.organizationWorkspace.recruiters[0];
    const ok = commit(
      (d) => {
        const w = d.organizationWorkspace;
        Object.assign(w.organization, {
          name: input.companyName,
          slug: slugify(input.companyName) || "company-" + uid().slice(0, 8),
          industry: input.industry,
          companySize: input.employees,
          organizationType: input.accountType === "individual" ? "Self-employed" : "Privately held",
          companyAddress: input.address,
          pincode: input.pincode,
          hiringFor: input.hiringFor,
          headquartersCity: "",
          headquartersCountry: "",
          websiteUrl: "",
          workplaceLocations: [],
          hiringLocations: [],
          expertiseAreas: [],
          benefits: [],
          logoUrl: "",
          coverImageUrl: "",
          tagline: "",
          description: "",
          overview: "",
          mission: "",
          vision: "",
          publicContactEmail: "",
          publicPhone: "",
          verificationStatus: "Not started",
        });
        w.recruiters = [{ ...structuredClone(old), id: "r0", organizationId: w.organization.id, fullName: input.fullName, jobTitle: input.designation, workEmail: input.email, privateMobile: phone, accountType: input.accountType, avatarUrl: "", professionalBio: "", hiringDepartments: [], hiringLocations: [], professionalLinks: { linkedin: "" }, role: "Organization Admin", accountStatus: "Active", profileVisibility: "Public" }];
        w.currentRecruiterId = "r0";
        w.invitations = [];
        w.verification = { registrationName: input.companyName, registrationNumber: "", jurisdiction: "", representative: input.fullName, representativeTitle: input.designation, businessEmail: input.email, website: "", documents: [], submittedAt: "", reviewNote: "" };
        d.employerRegistrations.push({ id: uid(), fullName: input.fullName, email: input.email, mobile: phone, company: input.companyName, accountType: input.accountType, verificationMode: "demo", mobileVerified: true, emailVerified: true, createdAt: new Date().toISOString() });
        const c = d.companies.find((x) => x.id === w.organization.id);
        if (c) Object.assign(c, { name: w.organization.name, industry: w.organization.industry, website: "", summary: "", status: "Not verified", recruiter: input.fullName, title: input.designation, email: input.email });
        d.session = { role: "recruiter" };
      },
      { rollbackOnFailure: true },
    );
    if (!ok) return { ok: false, error: "Browser storage is full. Your account details were not saved. Free some space and try again." };
    challenges.clear();
    return { ok: true };
  },
};
