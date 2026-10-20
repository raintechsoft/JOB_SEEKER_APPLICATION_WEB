import type { Professional, ProfessionalDetails } from "@/types/domain";
import { safeUrl } from "@/lib/utils/url";

export const ACCOMPLISHMENT_TYPES = {
  onlineProfiles: "Online profiles",
  workSamples: "Work samples",
  publications: "Publications & research",
  presentations: "Presentations",
  patents: "Patents",
  certifications: "Certifications",
} as const;

export type AccomplishmentType = keyof typeof ACCOMPLISHMENT_TYPES;

export interface CompletionItem {
  label: string;
  weight: number;
  done: boolean;
  section: string;
}

/** Nine professional essentials (prototype `profileCompletion`). Sensitive fields never count. */
export function profileCompletion(p: Professional, details: ProfessionalDetails | undefined, projectCount: number) {
  const d = details;
  const items: CompletionItem[] = [
    { label: "Photo", weight: 10, done: !!p.picture || (!d?.photoRemoved && p.id === "p0"), section: "identity" },
    { label: "Headline", weight: 10, done: !!p.headline?.trim(), section: "headline" },
    { label: "Professional summary", weight: 10, done: !!p.summary?.trim(), section: "summary" },
    { label: "Key skills", weight: 10, done: !!p.skills.length, section: "skills" },
    { label: "Employment", weight: 15, done: d ? d.employment.length > 0 : !!p.experience, section: "employment" },
    { label: "Education", weight: 10, done: d ? d.education.length > 0 : !!p.education, section: "education" },
    { label: "Project", weight: 15, done: projectCount > 0, section: "projects" },
    { label: "Professional link", weight: 10, done: d ? d.onlineProfiles.some((r) => !!safeUrl(String(r.url ?? ""))) : !!safeUrl(p.website), section: "accomplishments" },
    { label: "Career preferences", weight: 10, done: d ? !!(d.career.roles || d.career.interests) : !!p.interests, section: "career" },
  ];
  return { percent: items.reduce((n, i) => n + (i.done ? i.weight : 0), 0), items };
}

export const skillKey = (v: string) => v.trim().toLocaleLowerCase();
