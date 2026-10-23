import type { components } from "@/types/generated/api";
import { z } from "zod";
import type { HttpClient } from "../api/client";
import type { MediaService } from "../media/media.http";
import type { WorkService } from "./work.service";
import type { Project, WorkUpdate } from "@/types/domain";
import { projectInputSchema, updateInputSchema } from "@/lib/validation/work";
import { validateMedia } from "@/lib/validation/profile";

export function portfolioShareContext(): string | undefined {
  if (typeof window === "undefined" || !window.location.pathname.startsWith("/portfolio/")) return;
  const token = new URLSearchParams(window.location.search).get("share");
  return token && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}
export function createHttpWorkService(http: HttpClient, media: MediaService): WorkService & { reset(): void; moveProject(id: string, offset: -1 | 1): Promise<void> } {
  const projects = new Map<string, Project>(), updates = new Map<string, WorkUpdate>();
  const scope = (owner: string) => owner === "me" ? "me" : `professionals/${z.uuid().parse(owner)}`;
  const getProject = async (id: string) => { const result = (await http.get<{ data: components["schemas"]["WorkProject"] }>(`work/projects/${z.uuid().parse(id)}`, { share: portfolioShareContext() })).data; projects.set(id, result); return result; };
  const getUpdate = async (id: string) => { const result = (await http.get<{ data: components["schemas"]["WorkUpdate"] }>(`work/updates/${z.uuid().parse(id)}`, { share: portfolioShareContext() })).data; updates.set(id, result); return result; };
  const pages = async <T>(path: string, query: Record<string, string | number | boolean | undefined>, limit?: number) => {
    const result: T[] = []; let cursor: string | undefined;
    do { const page = await http.get<{ data: T[]; meta: { next_cursor: string | null } }>(path, { ...query, limit: limit ? Math.min(100, limit - result.length) : 100, cursor, share: portfolioShareContext() }); result.push(...page.data); cursor = page.meta.next_cursor ?? undefined; } while (cursor && (!limit || result.length < limit));
    return result;
  };
  const revision = (value: number | undefined) => z.number().int().min(1).parse(value);
  const change = async (kind: "projects" | "updates", id: string, action: "delete" | "featured" | "move", body: object = {}) => {
    z.uuid().parse(id);
    const record = kind === "projects" ? projects.get(id) ?? await getProject(id) : updates.get(id) ?? await getUpdate(id);
    const data = { ...body, version: revision(record!.version) };
    if (action === "delete") { await http.delete(`me/${kind}/${id}`, data); (kind === "projects" ? projects : updates).delete(id); }
    else if (action === "featured") { await http.patch(`me/projects/${id}/featured`, data); projects.delete(id); }
    else { await http.post(`me/projects/${id}/move`, data); projects.clear(); }
  };
  return {
    async featuredProjects(){return (await http.get<{data:Project[]}>("work/featured-projects")).data;},
    reset() { projects.clear(); updates.clear(); },
    getProject, getUpdate,
    async listProjects(query) {
      z.object({ category: z.enum(["", "Design", "Engineering", "Data", "Business"]).optional(), visibility: z.enum(["", "Public", "Private"]).optional(), q: z.string().max(200).optional() }).parse(query);
      const rows = await pages<Project>(`${scope(query.ownerId)}/projects`, { category: query.category, visibility: query.visibility, q: query.q });
      for (const row of rows) projects.set(row.id, row); return rows;
    },
    async getProjects(ids) { z.array(z.uuid()).max(50).parse(ids); if (!ids.length) return []; const rows = (await http.get<{ data: components["schemas"]["WorkProject"][] }>("work/projects", { ids, share: portfolioShareContext() })).data; for (const row of rows) projects.set(row.id, row); return rows; },
    async saveProject(input) {
      const data = projectInputSchema.parse(input);
      if (input.id) { z.uuid().parse(input.id); revision(input.version); }
      if (input.coverFile) { const error = validateMedia(input.coverFile, "project_cover"); if (error) return { ok: false, error }; }
      const asset = input.coverFile ? await media.upload(input.coverFile, "project_cover") : undefined;
      const row = (await http.post<{ data: Project }>("me/projects", { ...data, ...(input.id ? { id: input.id, version: input.version } : {}), ...(asset ? { cover_asset_id: asset.id } : {}) })).data;
      projects.set(row.id, row); return { ok: true, persisted: true };
    },
    deleteProject: (id) => change("projects", id, "delete"),
    setProjectFeatured: (id, featured) => { z.boolean().parse(featured); return change("projects", id, "featured", { featured }); },
    moveProject: (id, offset) => { z.union([z.literal(-1), z.literal(1)]).parse(offset); return change("projects", id, "move", { offset }); },
    async listUpdates(owner, options = {}) { z.object({ limit: z.number().int().min(1).max(100).optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), publicOnly: z.boolean().optional() }).parse(options); const rows = await pages<WorkUpdate>(`${scope(owner)}/updates`, { date: options.date, publicOnly: options.publicOnly }, options.limit); for (const row of rows) updates.set(row.id, row); return rows; },
    async saveUpdate(input) {
      const values = updateInputSchema.parse(input);
      if (input.id) { z.uuid().parse(input.id); revision(input.version); }
      if (values.project && values.visibility === "Public") { const project = await getProject(values.project); if (project?.visibility !== "Public") throw new Error("Publish the related project or keep this update private."); }
      const row = (await http.post<{ data: WorkUpdate }>("me/updates", { ...values, ...(input.id ? { id: input.id, version: input.version } : {}) })).data;
      updates.set(row.id, row); return true;
    },
    deleteUpdate: (id) => change("updates", id, "delete"),
    async getPulse(owner, days) { z.union([z.literal(91), z.literal(365)]).parse(days); return (await http.get<{ data: Awaited<ReturnType<WorkService["getPulse"]>> }>(`${scope(owner)}/pulse`, { days, share: portfolioShareContext() })).data; },
  };
}
