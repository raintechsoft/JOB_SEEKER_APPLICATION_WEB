import type { PublicCredentials } from "@/services/talent/public-profile";
import type { PublicOrganization } from "@/lib/domain/organization";
import { workPulseUiEnabled } from "@/features/work/work-pulse-ui-policy";

export type PublicProfileTabId =
  | "overview"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "credentials"
  | "activity"
  | "company"
  | "culture"
  | "details"
  | "jobs";

export type PublicProfileTabDef = { id: PublicProfileTabId; label: string };

const CERTIFICATIONS_LABEL = "Certifications";
/** Surfaced in the public header badges; not a Credentials tab section on its own. */
const HEADER_LINK_GROUP = "Professional links";

export function certificationRecords(credentials: PublicCredentials) {
  return credentials.groups.find((g) => g.label === CERTIFICATIONS_LABEL)?.records ?? [];
}

export function otherCredentialGroups(credentials: PublicCredentials) {
  return credentials.groups.filter(
    (g) => g.label !== CERTIFICATIONS_LABEL && g.label !== HEADER_LINK_GROUP && g.records.length > 0,
  );
}

export function hasOtherCredentials(credentials: PublicCredentials, includeContact = true) {
  return (
    otherCredentialGroups(credentials).length > 0 ||
    credentials.breaks.length > 0 ||
    (includeContact && !!(credentials.contact.email?.trim() || credentials.contact.phone?.trim()))
  );
}

export function publicSkills(skills: string[]) {
  return skills.map((s) => s.trim()).filter(Boolean);
}

export function seekerPublicTabDefs(input: {
  experience: string;
  education: string;
  skills: string[];
  skillRecords?: { name?: string }[];
  employmentRecords?: unknown[];
  educationRecords?: unknown[];
  projects: unknown[];
  portfolioSlug: string;
  /** When false, portfolio CTA/slug alone must not invent a Projects tab. */
  portfolioUiEnabled?: boolean;
  credentials: PublicCredentials;
  updates: unknown[];
}): PublicProfileTabDef[] {
  const skills = publicSkills(
    input.skillRecords?.length
      ? input.skillRecords.map((s) => String(s.name ?? ""))
      : input.skills,
  );
  const hasEmployment = (input.employmentRecords?.length ?? 0) > 0 || !!input.experience.trim();
  const hasEducation = (input.educationRecords?.length ?? 0) > 0 || !!input.education.trim();
  const portfolioEligible = !!input.portfolioUiEnabled && !!input.portfolioSlug.trim();
  const tabs: PublicProfileTabDef[] = [{ id: "overview", label: "Overview" }];
  if (hasEmployment) tabs.push({ id: "experience", label: "Employment" });
  if (hasEducation) tabs.push({ id: "education", label: "Education" });
  if (skills.length) tabs.push({ id: "skills", label: "Key skills" });
  if (input.projects.length || portfolioEligible) tabs.push({ id: "projects", label: "Projects" });
  if (certificationRecords(input.credentials).length) tabs.push({ id: "certifications", label: "Certifications" });
  if (hasOtherCredentials(input.credentials)) tabs.push({ id: "credentials", label: "Credentials" });
  if (workPulseUiEnabled() && input.updates.length) tabs.push({ id: "activity", label: "Activity" });
  return tabs;
}

export function hasPublicCompanyDetails(o: PublicOrganization) {
  return !!(
    o.name.trim() &&
    (o.description?.trim() ||
      o.overview?.trim() ||
      o.tagline?.trim() ||
      o.industry?.trim() ||
      o.companySize?.trim() ||
      o.organizationType?.trim() ||
      o.foundingYear?.trim() ||
      o.headquartersCity?.trim() ||
      o.headquartersCountry?.trim() ||
      o.mission?.trim() ||
      o.vision?.trim() ||
      o.hiringStatus?.trim())
  );
}

export function hasPublicCulture(o: PublicOrganization) {
  return !!(
    o.cultureDescription?.trim() ||
    o.workEnvironment?.trim() ||
    o.workModes?.length ||
    o.workplaceLocations?.length ||
    o.workplaceImages?.length ||
    o.benefits?.length ||
    o.cultureHighlights?.trim() ||
    o.candidateExpectations?.trim()
  );
}

export function hasPublicOrgConnect(o: PublicOrganization) {
  return !!(
    o.publicContactEmail?.trim() ||
    o.publicPhone?.trim() ||
    o.socialLinks?.linkedin?.trim() ||
    o.socialLinks?.other?.trim() ||
    o.careersUrl?.trim()
  );
}

export function hasPublicOrgDetails(o: PublicOrganization) {
  return !!(
    o.industry?.trim() ||
    o.companySize?.trim() ||
    o.organizationType?.trim() ||
    o.foundingYear?.trim() ||
    o.headquartersCity?.trim() ||
    o.headquartersCountry?.trim() ||
    o.hiringStatus?.trim() ||
    hasPublicOrgConnect(o)
  );
}

/** Public organization profile tabs (Stage 2), matching professional header+tabs layout. */
export function organizationPublicTabDefs(input: {
  organization: PublicOrganization;
  jobCount: number;
}): PublicProfileTabDef[] {
  const tabs: PublicProfileTabDef[] = [{ id: "overview", label: "Overview" }];
  if (hasPublicCulture(input.organization)) tabs.push({ id: "culture", label: "Culture" });
  if (input.jobCount > 0) tabs.push({ id: "jobs", label: "Jobs" });
  if (hasPublicOrgDetails(input.organization)) tabs.push({ id: "details", label: "Details" });
  return tabs;
}

export function recruiterPublicTabDefs(input: {
  organization: PublicOrganization;
  jobCount: number;
}): PublicProfileTabDef[] {
  const tabs: PublicProfileTabDef[] = [{ id: "overview", label: "Overview" }];
  if (hasPublicCompanyDetails(input.organization)) tabs.push({ id: "company", label: "Company" });
  if (input.jobCount > 0) tabs.push({ id: "jobs", label: "Jobs" });
  return tabs;
}

/** Keep a stable selection when the profile or available tabs change. */
export function resolvePublicProfileTab(
  tabs: PublicProfileTabDef[],
  selected: string | undefined,
): PublicProfileTabId {
  if (!tabs.length) return "overview";
  if (selected && tabs.some((tab) => tab.id === selected)) return selected as PublicProfileTabId;
  return tabs[0].id;
}
