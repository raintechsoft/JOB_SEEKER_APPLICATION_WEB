import { z } from "zod";
import rules from "../../../../../contracts/validation/job-import.json";
import { jobV2DraftSchema } from "./job-v2";

/** Pure J1 input contracts; upload, parsing and draft creation are not connected yet. */
const revision = z.number().int().min(1);
const key = z.string().trim().min(1).max(rules.sourcePositionKeyMax);
const resolution = z.strictObject({issue: z.enum(rules.issueCodes as [string, ...string[]]), kind: z.enum(rules.resolutionKinds as [string, ...string[]]), note: z.string().trim().min(10).max(rules.reviewNoteMax)});
export const importStartSchema = z.strictObject({sourceAssetId: z.uuid(), idempotencyKey: z.uuid()});
export const importMappingSchema = z.strictObject({version: revision, sheet: z.string().trim().min(1).max(31), headerRow: z.number().int().min(1).max(rules.headerRowMax), preset: z.enum(rules.presets as [string, ...string[]]), timezone: z.string().trim().min(1).max(100), columns: z.partialRecord(z.enum(rules.mappingTargets as [string, ...string[]]), z.number().int().min(1).max(rules.maxColumns))}).superRefine((v, ctx) => {
  if (!v.columns.title) ctx.addIssue({code: "custom", path: ["columns", "title"], message: "Map the position title column."});
  try { if (!(v.timezone === "UTC" || /^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+$/.test(v.timezone))) throw new Error(); new Intl.DateTimeFormat("en", {timeZone: v.timezone}); } catch { ctx.addIssue({code: "custom", path: ["timezone"], message: "Choose an IANA timezone."}); }
});
export const importPositionReviewSchema = z.strictObject({version: revision, values: jobV2DraftSchema, resolutions: z.array(resolution).max(rules.issueCodes.length)}).refine(v => new Set(v.resolutions.map(r => r.issue)).size === v.resolutions.length, "Resolve each issue once.");
export const importSplitsSchema = z.strictObject({version: revision, rowId: z.uuid(), positions: z.array(z.strictObject({sourcePositionKey: key, values: jobV2DraftSchema})).min(1).max(rules.selectionMax)}).refine(v => new Set(v.positions.map(p => p.sourcePositionKey)).size === v.positions.length, "Use distinct position identities.");
export const importDraftSelectionSchema = z.strictObject({version: revision, idempotencyKey: z.uuid(), positions: z.array(z.strictObject({id: z.uuid(), version: revision})).min(1).max(rules.selectionMax)}).refine(v => new Set(v.positions.map(p => p.id)).size === v.positions.length, "Select distinct positions.");
export const importCancelSchema = z.strictObject({version: revision});
export const importFileSchema = z.strictObject({name: z.string().trim().min(1).max(180).refine(v => !/[\\/\u0000]/.test(v) && /\.xlsx$/i.test(v), "Choose an XLSX workbook."), bytes: z.number().int().min(1).max(rules.maxBytes)});
