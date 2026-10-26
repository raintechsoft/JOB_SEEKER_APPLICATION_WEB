import type { CompanySummary, PersonSummary } from "@/types/api";
import type { Company, DemoDatabase, Id, Job, Professional, Project } from "@/types/domain";
import { displayJobCompany } from "@/lib/domain/jobs";
import { PORTRAITS } from "../data/professionals";
import { person, RECRUITER_ID, recruiterIdentity } from "./selectors";

export const personSummary = (p: Professional): PersonSummary => ({
  id: p.id,
  name: p.name,
  headline: p.headline,
  picture: p.picture ?? PORTRAITS[p.id],
  color: p.color,
  slug: p.slug,
});

/** Author of feed content: the recruiter identity or a professional. */
export const feedPerson = (db: DemoDatabase, id: Id): PersonSummary => (id === RECRUITER_ID ? recruiterIdentity(db) : personSummary(person(db, id)));

export function companySummary(db: DemoDatabase, c: Company): CompanySummary {
  const org = db.organizationWorkspace.organization;
  const own = c.id === org.id;
  return {
    id: c.id,
    name: c.name,
    industry: c.industry,
    logoUrl: own && org.logoUrl ? org.logoUrl : undefined,
    slug: own ? org.slug : undefined,
    description: own ? org.description : c.summary,
    companySize: own ? org.companySize : undefined,
  };
}

export function jobCompany(db: DemoDatabase, job: Job): CompanySummary {
  const company = db.companies.find((c) => c.id === job.company) ?? db.companies[0];
  const shown = displayJobCompany(job, company);
  if (shown.confidential) return { id: company.id, name: shown.name, industry: shown.industry, confidential: true };
  return { ...companySummary(db, company), name: shown.name };
}

export interface ProjectSummary {
  id: Id;
  title: string;
  art: number;
  cover: string;
  visibility: Project["visibility"];
}

export const projectSummary = (p: Project): ProjectSummary => ({ id: p.id, title: p.title, art: p.art, cover: p.cover, visibility: p.visibility });
