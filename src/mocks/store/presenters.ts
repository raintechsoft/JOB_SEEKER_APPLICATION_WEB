import type { CompanySummary, PersonSummary } from "@/types/api";
import type { Company, DemoDatabase, Id, Job, Professional, Project } from "@/types/domain";
import { displayJobCompany } from "@/lib/domain/jobs";
import { PORTRAITS } from "../data/professionals";
import { ME_ID, person, RECRUITER_ID, recruiterIdentity } from "./selectors";

function personFollowerCount(db: DemoDatabase, id: Id) {
  if (id === ME_ID) return db.social.followers.length;
  if (id === RECRUITER_ID) return db.recruiterSocial.followers.length;
  return [db.social, db.recruiterSocial].filter((graph) => graph.following.includes(id)).length;
}

function companyFollowerCount(db: DemoDatabase, id: Id) {
  return [db.social, db.recruiterSocial].filter((graph) => graph.followingCompanies.includes(id)).length;
}

export const personSummary = (p: Professional, db?: DemoDatabase): PersonSummary => ({
  id: p.id,
  name: p.name,
  headline: p.headline,
  picture: p.picture ?? PORTRAITS[p.id],
  color: p.color,
  slug: p.slug,
  ...(db ? { followerCount: personFollowerCount(db, p.id) } : {}),
});

/** Author of feed content: the recruiter identity or a professional. */
export const feedPerson = (db: DemoDatabase, id: Id): PersonSummary => {
  if (id === RECRUITER_ID) return { ...recruiterIdentity(db), followerCount: personFollowerCount(db, id) };
  return personSummary(person(db, id), db);
};

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
    followerCount: companyFollowerCount(db, c.id),
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
