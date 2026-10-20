import type { Organization, RecruiterMember, VerificationStatus } from "@/types/domain";
import { isValidEmail, safeUrl } from "@/lib/utils/url";

export const ORGANIZATION_SECTIONS = {
  overview: "Company Overview",
  about: "About Organization",
  culture: "Workplace & Culture",
  hiring: "Hiring & Opportunities",
  verification: "Verification",
  team: "Team & Recruiters",
  contact: "Contact & Preferences",
} as const;

export type OrganizationSection = keyof typeof ORGANIZATION_SECTIONS;

export const ORGANIZATION_SECTION_DESCRIPTIONS: Record<OrganizationSection, string> = {
  overview: "The essentials that help candidates recognize your company.",
  about: "Tell candidates what your organization does and what drives it.",
  culture: "Show how your team works, learns, and connects.",
  hiring: "Shape your hiring presence and preview your active opportunities.",
  verification: "Manage private registration details and demo review requests.",
  team: "Manage the people who represent your organization on Skillora.",
  contact: "Control public contact details and private communication preferences.",
};

export const ORGANIZATION_ROLES = ["Organization Admin", "Recruiter", "Hiring Manager"] as const;

export const isOrganizationSection = (v: string | null): v is OrganizationSection => !!v && Object.hasOwn(ORGANIZATION_SECTIONS, v);

export function organizationCompletion(o: Organization) {
  const items: [key: string, label: string, done: boolean, section: OrganizationSection][] = [
    ["name", "Organization name", !!o.name.trim(), "overview"],
    ["logo", "Organization logo", !!o.logoUrl, "overview"],
    ["industry", "Industry", !!o.industry, "overview"],
    ["description", "Company description", !!o.description.trim(), "overview"],
    ["contact", "Website or public contact", !!(o.websiteUrl || (o.showPublicContact && o.publicContactEmail)), "contact"],
    ["headquarters", "Headquarters", !!(o.headquartersCountry && o.headquartersCity), "overview"],
    ["size", "Company size", !!o.companySize, "overview"],
    ["hiring", "Hiring preferences", !!(o.hiringStatus && o.hiringDepartments.length && o.hiringLocations.length && o.employmentTypes.length), "hiring"],
  ];
  return { percent: Math.round((items.filter((i) => i[2]).length / items.length) * 100), items };
}

const REQUIRED_LABELS: Record<string, string> = {
  name: "an organization name",
  slug: "a profile slug",
  industry: "an industry",
  headquartersCountry: "a headquarters country",
  headquartersCity: "a headquarters city",
  description: "a company description",
  companySize: "the company size",
};

export type FieldErrors = Record<string, string>;

export function validateOrganization(o: Organization): FieldErrors {
  const e: FieldErrors = {};
  for (const key of Object.keys(REQUIRED_LABELS) as (keyof Organization)[]) if (!String(o[key] || "").trim()) e[key] = "Add " + REQUIRED_LABELS[key] + ".";
  if (o.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(o.slug)) e.slug = "Use lowercase letters, numbers, and single hyphens.";
  if (o.foundingYear && (!/^\d{4}$/.test(o.foundingYear) || Number(o.foundingYear) < 1800 || Number(o.foundingYear) > new Date().getFullYear())) e.foundingYear = "Use a year from 1800 to the current year.";
  const urls: [string, string][] = [["websiteUrl", o.websiteUrl], ["careersUrl", o.careersUrl], ["socialLinks.linkedin", o.socialLinks.linkedin], ["socialLinks.other", o.socialLinks.other]];
  for (const [key, value] of urls) if (value && !safeUrl(value)) e[key] = "Use a complete HTTP or HTTPS URL.";
  for (const key of ["publicContactEmail", "applicationContact"] as const) if (o[key] && !isValidEmail(o[key])) e[key] = "Enter a valid email address.";
  if (o.publicPhone && !/^[+()\d\s.-]{7,25}$/.test(o.publicPhone)) e.publicPhone = "Use 7–25 characters with numbers and standard phone punctuation.";
  return e;
}

const VERIFICATION_FIELDS = ["registrationName", "registrationNumber", "jurisdiction", "representative", "representativeTitle", "businessEmail", "website"];

/** Section that contains the first error, used to send the user to the right editor panel. */
export function errorSection(errors: FieldErrors): OrganizationSection {
  const keys = Object.keys(errors);
  if (keys.some((k) => VERIFICATION_FIELDS.includes(k))) return "verification";
  if (keys.some((k) => ["publicContactEmail", "applicationContact", "publicPhone", "careersUrl"].includes(k) || k.startsWith("socialLinks"))) return "contact";
  return "overview";
}

/** Fields that may appear on the public organization page. */
export function publicOrganization(o: Organization) {
  return {
    ...o,
    careersUrl: o.showCareers ? o.careersUrl : "",
    publicContactEmail: o.showPublicContact ? o.publicContactEmail : "",
    publicPhone: o.showPublicContact ? o.publicPhone : "",
    applicationContact: undefined,
  };
}

export type PublicOrganization = ReturnType<typeof publicOrganization>;

/** Public recruiter identity: no account email, internal role or permissions. */
export function publicRecruiter(r: RecruiterMember) {
  const { id, organizationId, fullName, avatarUrl, jobTitle, professionalBio, hiringDepartments, hiringLocations, professionalLinks, profileVisibility } = r;
  return { id, organizationId, fullName, avatarUrl, jobTitle, professionalBio, hiringDepartments, hiringLocations, professionalLinks, profileVisibility };
}

export type PublicRecruiter = ReturnType<typeof publicRecruiter>;

export const VERIFICATION_NEXT_STEP: Record<VerificationStatus, string> = {
  "Not started": "Add your registration and representative details to start.",
  "In progress": "Complete the details, then submit a demo request.",
  "Pending review": "Your demo request is awaiting a simulated review. You can still correct the details.",
  Verified: "This sample state represents a completed demo review. No real organization was verified.",
  "Action required": "Update the requested information and resubmit your demo request.",
};
