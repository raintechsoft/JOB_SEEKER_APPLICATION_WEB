import { getDb } from "@/mocks/store/demo-db";
import { blockedInMock, mockFeedService, professionalItems, recruiterItems } from "@/services/feed/feed.mock";
import { personSummary } from "@/mocks/store/presenters";
import { scopedSearchSchema } from "@/lib/search/scopes";
import type { SearchResult, SearchService } from "./search.service";

export const mockSearchService: SearchService = { async query(input) {
  const values = scopedSearchSchema.parse(input), db = getDb();
  const matches = (value: string) => values.q.toLocaleLowerCase().split(/\s+/u).every(term => value.toLocaleLowerCase().includes(term));
  const items: SearchResult[] = [];
  if (values.scope === "people" || values.scope === "all") {
    const page = await mockFeedService.searchPeople(values.role, values.q, 1000);
    items.push(...page.items.map(p => ({ id: p.id, kind: "person" as const, title: p.name, subtitle: p.headline ?? "", slug: p.slug ?? null, picture: p.picture ?? "", recruiter: !!p.recruiter })));
  }
  if (values.scope === "companies" || values.scope === "all") {
    const company = db.organizationWorkspace.organization;
    if (company.profileVisibility === "Public" && matches(`${company.name} ${company.industry}`)) items.push({ id: company.id, kind: "company", title: company.name, subtitle: company.industry, slug: company.slug, picture: company.logoUrl, recruiter: false });
  }
  if (values.scope === "talent" || values.scope === "skills") {
    items.push(...db.professionals.filter(p => p.public && !blockedInMock(db, values.role, p.id) && matches(values.scope === "skills" ? p.skills.join(" ") : `${p.name} ${p.headline} ${p.skills.join(" ")} ${db.projects.filter(project => project.owner === p.id && project.visibility === "Public").map(project => `${project.title} ${project.description}`).join(" ")}`)).map(p => ({ id: p.id, kind: "talent" as const, title: p.name, subtitle: p.headline, slug: p.slug, picture: personSummary(p).picture ?? "", recruiter: false })));
  }
  if (values.scope === "projects" || values.role === "recruiter" && values.scope === "all") for (const project of db.projects) {
    const owner = db.professionals.find(p => p.id === project.owner);
    if (owner?.public && !blockedInMock(db, values.role, owner.id) && project.visibility === "Public" && matches(`${project.title} ${project.description} ${project.skills.join(" ")}`)) items.push({ id: project.id, kind: "project", title: project.title, subtitle: project.description, slug: owner.slug, picture: "", recruiter: false, ownerId: owner.id });
  }
  if (["all", "posts", "jobs", "updates"].includes(values.scope)) {
    const raw = values.role === "professional" ? professionalItems(db) : recruiterItems(db);
    const wanted = values.scope === "posts" ? "post" : values.scope === "jobs" ? "job" : values.scope === "updates" ? "update" : null;
    const entries = await Promise.all(raw.filter(item => !wanted || item.type === wanted).map(item => mockFeedService.getEntry(values.role, item.id)));
    items.push(...entries.flatMap(entry => entry && matches(`${entry.title} ${entry.body} ${entry.type === "job" && !entry.company?.confidential ? entry.company?.name ?? "" : ""}`) ? [{ id: entry.id, kind: entry.type, title: entry.title, subtitle: entry.type === "job" ? entry.company?.name ?? "Job" : entry.kind, slug: null, picture: "", recruiter: false }] : []));
  }
  items.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  let offset = 0;
  if (values.cursor) {
    const cursor = JSON.parse(values.cursor);
    if (cursor.q !== values.q || cursor.scope !== values.scope || cursor.role !== values.role || !Number.isInteger(cursor.offset) || cursor.offset < 0) throw new Error("Search again to load this page.");
    offset = cursor.offset;
  }
  const next = offset + values.limit;
  return { items: items.slice(offset, next), total: items.length, nextCursor: next < items.length ? JSON.stringify({ q: values.q, scope: values.scope, role: values.role, offset: next }) : null };
} };
