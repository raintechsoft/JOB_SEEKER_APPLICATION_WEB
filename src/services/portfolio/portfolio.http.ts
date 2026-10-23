import type { components } from "@/types/generated/api";
import { z } from "zod";
import type { HttpClient } from "../api/client";
import type { PortfolioService, PortfolioView } from "./portfolio.service";
import { portfolioSettingsSchema, portfolioSharingSchema } from "@/lib/validation/portfolio";
import { portfolioShareContext } from "../work/work.http";
export function createHttpPortfolioService(http: HttpClient): PortfolioService & { reset(): void } {
  let current: PortfolioView | null = null;
  const getPortfolio = async (owner: string) => { if (owner !== "me") throw new Error("Use a public portfolio address to view another person's portfolio."); current = (await http.get<{ data: components["schemas"]["PortfolioView"] }>("me/portfolio")).data; return current; };
  const version = async () => z.number().int().min(1).parse((current ?? await getPortfolio("me"))?.config.version);
  const section = async (index: number, values: object) => { z.number().int().min(0).max(8).parse(index); current = (await http.patch<{ data: components["schemas"]["PortfolioView"] }>(`me/portfolio/sections/${index}`, { ...values, version: await version() })).data; };
  return {
    reset() { current = null; }, getPortfolio,
    async getPortfolioBySlug(slug) { z.string().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).parse(slug); return (await http.get<{ data: components["schemas"]["PortfolioView"] }>(`portfolios/${encodeURIComponent(slug)}`, { share: portfolioShareContext() })).data; },
    async saveSettings(input) { const values = portfolioSettingsSchema.parse(input); const revision = z.number().int().min(1).parse(input.version ?? await version()); current = (await http.patch<{ data: components["schemas"]["PortfolioView"] }>("me/portfolio", { ...values, version: revision })).data; return { ok: true, persisted: true, version: current.config.version }; },
    setSectionVisible: (index, visible) => { z.boolean().parse(visible); return section(index, { visible }); },
    moveSection: (index, offset) => { z.union([z.literal(-1), z.literal(1)]).parse(offset); return section(index, { offset }); },
    async saveSharing(owner, input) { if (owner !== "me") throw new Error("Only your portfolio can be changed."); const values = portfolioSharingSchema.parse(input); const existing = current ?? await getPortfolio("me"); if (!existing) throw new Error("Load your portfolio first."); current = (await http.patch<{ data: components["schemas"]["PortfolioView"] }>("me/portfolio", { ...existing.config, public: values.public, version: await version() })).data; return true; },
    async createShare(input, revision) { const values = portfolioSharingSchema.parse(input); z.number().int().min(1).parse(revision); const result = (await http.post<{ data: { id: string; url: string; expiresAt: string | null; version: number } }>("me/portfolio/shares", { ...values, version: revision })).data; current = null; return result; },
    async revokeShare(id, revision) { z.uuid().parse(id); z.number().int().min(1).parse(revision); await http.delete(`me/portfolio/shares/${id}`, { version: revision }); current = null; },
  };
}
