import { getDb } from "@/mocks/store/demo-db";
import { blockedInMock, mockFeedService, professionalItems, recruiterItems } from "@/services/feed/feed.mock";
import { personSummary } from "@/mocks/store/presenters";
import { scopedSearchSchema, filterKeysFor } from "@/lib/search/scopes";
import type { SearchResult, SearchService } from "./search.service";
import { matchesJobDiscovery, jobPayReference } from "@/lib/domain/job-discovery";

export const mockSearchService: SearchService = { async query(input) {
  const values = scopedSearchSchema.parse(input), db = getDb();
  const related = values.mode === "related";
  const matches = (value: string) => related || values.q.toLocaleLowerCase().split(/\s+/u).every(term => value.toLocaleLowerCase().includes(term));
  const items: SearchResult[] = [];
  if (values.scope === "people" || values.scope === "all") {
    const page = related ? {items:db.professionals.filter(p => p.public && !blockedInMock(db, values.role, p.id)).map(p => personSummary(p, db))} : await mockFeedService.searchPeople(values.role, values.q, 1000);
    items.push(...page.items.map(p => {
      const full = db.professionals.find(profile => profile.id === p.id);
      return { id: p.id, kind: "person" as const, title: p.name, subtitle: p.headline ?? "", slug: p.slug ?? null, picture: p.picture ?? "", recruiter: !!p.recruiter, designation: full?.professionalDetails?.currentTitle || p.headline || "", bio: full?.summary ?? "", location: full?.location ?? "", followerCount: p.followerCount };
    }));
  }
  if (values.scope === "companies" || values.scope === "all") {
    const company = db.organizationWorkspace.organization;
    const location = [company.headquartersCity, company.headquartersCountry, ...company.workplaceLocations, ...company.hiringLocations].join(" ");
    if (company.profileVisibility === "Public" && matches(`${company.name} ${company.industry}`) && (!values.industry || company.industry.toLocaleLowerCase().includes(values.industry.toLocaleLowerCase())) && (!values.companyType || company.organizationType === values.companyType) && (!values.location || location.toLocaleLowerCase().includes(values.location.toLocaleLowerCase()))) items.push({ id: company.id, kind: "company", title: company.name, subtitle: company.industry, slug: company.slug, picture: company.logoUrl, recruiter: false, industry: company.industry, followerCount: [db.social, db.recruiterSocial].filter(graph => graph.followingCompanies.includes(company.id)).length });
  }
  if (values.scope === "talent" || values.scope === "skills") {
    items.push(...db.professionals.filter(p => p.public && !blockedInMock(db, values.role, p.id) && matches(values.scope === "skills" ? p.skills.join(" ") : `${p.name} ${p.headline} ${p.skills.join(" ")} ${db.projects.filter(project => project.owner === p.id && project.visibility === "Public").map(project => `${project.title} ${project.description}`).join(" ")}`)).map(p => ({ id: p.id, kind: "talent" as const, title: p.name, subtitle: p.headline, slug: p.slug, picture: personSummary(p, db).picture ?? "", recruiter: false, designation: p.professionalDetails?.currentTitle || p.headline, bio: p.summary, location: p.location, followerCount: personSummary(p, db).followerCount })));
  }
  if (values.scope === "projects" || values.role === "recruiter" && values.scope === "all") for (const project of db.projects) {
    const owner = db.professionals.find(p => p.id === project.owner);
    if (owner?.public && !blockedInMock(db, values.role, owner.id) && project.visibility === "Public" && matches(`${project.title} ${project.description} ${project.skills.join(" ")}`)) items.push({ id: project.id, kind: "project", title: project.title, subtitle: project.description, slug: owner.slug, picture: "", recruiter: false, ownerId: owner.id });
  }
  if (["all", "posts", "jobs", "updates"].includes(values.scope)) {
    const raw = values.role === "professional" ? professionalItems(db) : recruiterItems(db);
    const wanted = values.scope === "posts" ? "post" : values.scope === "jobs" ? "job" : values.scope === "updates" ? "update" : null;
    const entries = await Promise.all(raw.filter(item => !wanted || item.type === wanted).map(item => mockFeedService.getEntry(values.role, item.id)));
    items.push(...entries.flatMap(entry => {
      if (!entry || !matches(`${entry.title} ${entry.body} ${entry.type === "job" && !entry.company?.confidential ? entry.company?.name ?? "" : ""}`)) return [];
      if(entry.type==="job"&&values.scope==="jobs"){
        const job=db.social.jobs.find(job=>job.id===entry.id);if(!job||!matchesJobDiscovery(job,values))return [];
        if(values.location&&!job.location.toLocaleLowerCase().includes(values.location.toLocaleLowerCase()))return [];
        if(values.skill&&!job.skills.some(skill=>skill.toLocaleLowerCase().includes(values.skill!.toLocaleLowerCase())))return [];
        if(values.arrangement&&job.arrangement!==values.arrangement)return [];
      }
      if (values.scope === "posts" && values.contentType) {
        const media = entry.attachments ?? [];
        const type = values.contentType;
        if (type === "text" && (media.length || entry.project)) return [];
        if (type === "image" && !media.some(item => item.type === "image")) return [];
        if (type === "video" && !media.some(item => item.type === "video")) return [];
        if (type === "project" && !entry.project) return [];
      }
      return [{ id: entry.id, kind: entry.type, title: entry.title, subtitle: entry.type === "job" ? [entry.company?.name, entry.company?.confidential ? "" : entry.company?.industry].filter(Boolean).join(" · ") || "Job" : entry.kind, slug: null, picture: entry.type === "job" ? (entry.company?.confidential ? "" : entry.company?.logoUrl ?? "") : entry.author?.picture ?? "", recruiter: entry.type === "job" || !!entry.author?.recruiter, companyName: entry.type === "job" && !entry.company?.confidential ? entry.company?.name : entry.author?.recruiter ? entry.author.name : undefined, industry: entry.type === "job" && !entry.company?.confidential ? entry.company?.industry : undefined, followerCount: entry.type === "job" ? (entry.company?.confidential ? undefined : entry.company?.followerCount) : entry.author?.followerCount }];
    }));
  }
  const overlap = (item: SearchResult) => values.q.toLocaleLowerCase().split(/\s+/u).filter(term => `${item.title} ${item.subtitle}`.toLocaleLowerCase().includes(term)).length;
  items.sort((a, b) => {
    if(values.sort==="salary_asc"||values.sort==="salary_desc"){
      const left=db.social.jobs.find(job=>job.id===a.id),right=db.social.jobs.find(job=>job.id===b.id),l=left?jobPayReference(left,values):null,r=right?jobPayReference(right,values):null;
      if(l===null||r===null){if(l!==r)return l===null?1:-1;}else if(l!==r)return(values.sort==="salary_asc"?1:-1)*(l-r);
    }
    return (related ? overlap(b)-overlap(a) : 0) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id);
  });
  if (related) {
    if (!items.length && filterKeysFor(values.scope).some(key => values[key] !== undefined)) return mockSearchService.query({role:values.role,q:values.q,scope:values.scope,mode:"related",limit:values.limit});
    return {items:items.slice(0,values.limit),total:null,nextCursor:null};
  }
  let offset = 0;
  if (values.cursor) {
    const cursor = JSON.parse(values.cursor);
    if (cursor.q !== values.q || cursor.scope !== values.scope || cursor.role !== values.role || !Number.isInteger(cursor.offset) || cursor.offset < 0) throw new Error("Search again to load this page.");
    offset = cursor.offset;
  }
  const next = offset + values.limit;
  return { items: items.slice(offset, next), total: items.length, nextCursor: next < items.length ? JSON.stringify({ q: values.q, scope: values.scope, role: values.role, offset: next }) : null };
} };
