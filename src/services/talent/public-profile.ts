import type { DemoDatabase, Id, IsoDate, Professional } from "@/types/domain";
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
  summary: string;
  experience: string;
  education: string;
  interests: string;
  arrangement: string;
  available: boolean;
  complete: number;
  public: boolean;
  website: string;
  picture?: string;
  color: string;
  lastActive: IsoDate;
  credentials: PublicCredentials;
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

export function toPublicProfessional(p: Professional): PublicProfessional {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    headline: p.headline,
    category: p.category,
    location: p.location,
    years: p.years,
    skills: p.skills,
    summary: p.summary,
    experience: p.experience,
    education: p.education,
    interests: p.interests,
    arrangement: p.arrangement,
    available: p.available,
    complete: p.complete,
    public: p.public,
    website: p.website,
    picture: p.picture || PORTRAITS[p.id],
    color: p.color,
    lastActive: p.lastActive,
    credentials: publicCredentials(p),
  };
}

export const publicProjects = (db: DemoDatabase, id: Id) => db.projects.filter((pr) => pr.owner === id && pr.visibility === "Public");
