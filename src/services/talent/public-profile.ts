import type { DemoDatabase, Id, IsoDate, Professional, ProfileRecord, ProfileSkill } from "@/types/domain";
import { PORTRAITS } from "@/mocks/data/professionals";

export interface CredentialRecord {
  title: string;
  source?: string;
  description?: string;
  url?: string;
  linkLabel?: string;
}

export interface PublicCredentials {
  groups: { label: string; records: CredentialRecord[] }[];
  breaks: { start: string; end: string; current: boolean; description: string }[];
  contact: { email?: string; phone?: string };
}

export type PublicSkillRecord = {
  id: string;
  name: string;
  category?: string;
  level?: string;
  years?: string;
  featured?: boolean;
};

export type PublicTimelineRecord = {
  id: string;
  title?: string;
  degree?: string;
  company?: string;
  institution?: string;
  type?: string;
  start?: string;
  end?: string;
  current?: boolean;
  public?: boolean;
  location?: string;
  arrangement?: string;
  field?: string;
  description?: string;
  responsibilities?: string;
  achievements?: string;
  coursework?: string;
  grade?: string;
  skills?: string;
  companyLogo?: string | null;
  projects?: string[];
};

/** Professional fields that may be shown on public pages, portfolios and talent search. */
export interface PublicProfessional {
  id: Id;
  slug: string;
  name: string;
  headline: string;
  category: Professional["category"];
  location: string;
  years: number;
  skills: string[];
  /** Structured key skills for the public profile layout; falls back to `skills` names. */
  skillRecords?: PublicSkillRecord[];
  summary: string;
  experience: string;
  education: string;
  /** Public employment timeline records (own-profile layout). */
  employmentRecords?: PublicTimelineRecord[];
  /** Public education timeline records (own-profile layout). */
  educationRecords?: PublicTimelineRecord[];
  interests: string;
  arrangement: string;
  available: boolean;
  complete: number;
  public: boolean;
  website: string;
  picture?: string;
  /** Directory-profile banner only; never part of portfolio shares or application snapshots. */
  cover?: string;
  color: string;
  lastActive: IsoDate;
  credentials: PublicCredentials;
  followerCount: number;
}

const KINDS = {
  onlineProfiles: "Professional links",
  workSamples: "Work samples",
  publications: "Publications",
  presentations: "Presentations",
  patents: "Patents",
  certifications: "Certifications",
} as const;

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

function publicSkillRecords(skills: ProfileSkill[] | undefined): PublicSkillRecord[] {
  return (skills ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category || undefined,
    level: s.level || undefined,
    years: s.years || undefined,
    featured: !!s.featured,
  }));
}

function publicTimelineRecords(
  records: ProfileRecord[] | undefined,
  kind: "employment" | "education",
): PublicTimelineRecord[] {
  return (records ?? [])
    .filter((r) => r.public)
    .map((r) => {
      const base: PublicTimelineRecord = {
        id: r.id,
        type: str(r.type),
        start: str(r.start),
        end: str(r.end),
        current: !!r.current,
        location: str(r.location),
        arrangement: str(r.arrangement),
        description: str(r.description),
        skills: str(r.skills),
      };
      if (kind === "employment") {
        return {
          ...base,
          title: str(r.title),
          company: str(r.company),
          responsibilities: str(r.responsibilities),
          achievements: str(r.achievements),
          companyLogo: str(r.companyLogo) ?? null,
          projects: Array.isArray(r.projects) ? r.projects.map(String) : [],
        };
      }
      return {
        ...base,
        degree: str(r.degree),
        institution: str(r.institution),
        field: str(r.field),
        coursework: str(r.coursework),
        grade: str(r.grade),
      };
    });
}

export function publicCredentials(p: Professional): PublicCredentials {
  const d = p.professionalDetails;
  if (!d) return { groups: [], breaks: [], contact: {} };
  const groups = (Object.keys(KINDS) as (keyof typeof KINDS)[])
    .map((key) => ({
      label: KINDS[key],
      records: (d[key] || [])
        .filter((r) => r.public)
        .map((r) => ({ title: String(r.title ?? ""), source: str(r.issuer) || str(r.publisher) || str(r.event), description: str(r.description), url: str(r.url), linkLabel: str(r.label) })),
    }))
    .filter((g) => g.records.length);
  const breaks = (d.careerBreaks || []).filter((r) => r.public).map((r) => ({ start: String(r.start ?? ""), end: String(r.end ?? ""), current: !!r.current, description: String(r.description ?? "") }));
  const contact = { email: d.privacy?.email ? p.email : undefined, phone: d.privacy?.phone && d.phone ? d.phone : undefined };
  return { groups, breaks, contact };
}

export function toPublicProfessional(p: Professional, followerCount = 0): PublicProfessional {
  const details = p.professionalDetails;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    headline: p.headline,
    category: p.category,
    location: p.location,
    years: p.years,
    skills: p.skills,
    skillRecords: publicSkillRecords(details?.skills),
    summary: p.summary,
    experience: p.experience,
    education: p.education,
    employmentRecords: publicTimelineRecords(details?.employment, "employment"),
    educationRecords: publicTimelineRecords(details?.education, "education"),
    interests: p.interests,
    arrangement: p.arrangement,
    available: p.available,
    complete: p.complete,
    public: p.public,
    website: p.website,
    picture: p.picture ?? PORTRAITS[p.id],
    cover: p.cover ?? "",
    color: p.color,
    lastActive: p.lastActive,
    credentials: publicCredentials(p),
    followerCount: p.followerCount ?? followerCount,
  };
}

export const publicProjects = (db: DemoDatabase, id: Id) => db.projects.filter((pr) => pr.owner === id && pr.visibility === "Public");
