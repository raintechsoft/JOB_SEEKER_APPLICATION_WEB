import { z } from "zod";
import contract from "../../../contracts/validation/interactions.json";
import events from "../../../contracts/analytics/events.json";

export const INTERACTION_RULES = contract;
export const INTERACTION_SURFACES = events.surfaces;
export type InteractionAction = "view" | "dwell" | "click";
export type InteractionKind = "job" | "post" | "update" | "professional" | "organization";
const kindsFor = contract.actionKinds as Record<string, string[]>;

export const interactionEventSchema = z.object({
  id: z.uuid(),
  action: z.enum(contract.clientActions as [InteractionAction, ...InteractionAction[]]),
  itemKind: z.enum(contract.itemKinds as [InteractionKind, ...InteractionKind[]]),
  itemId: z.uuid(),
  surface: z.enum(events.surfaces).optional(),
  position: z.number().int().min(0).max(contract.positionMax).optional(),
  dwellMs: z.number().int().min(1).max(contract.dwellMsMax).optional(),
  requestId: z.uuid().optional(),
  occurredAt: z.iso.datetime({ offset: true }),
}).strict().refine((e) => kindsFor[e.action].includes(e.itemKind), { message: "This action does not apply to that kind of item." })
  .refine((e) => (e.action === "dwell") === (e.dwellMs !== undefined), { path: ["dwellMs"], message: "Dwell time belongs only to dwell events." });

export type InteractionEvent = z.infer<typeof interactionEventSchema>;
export const interactionBatchSchema = z.object({ identityId: z.uuid(), events: z.array(interactionEventSchema).min(1).max(contract.batchMax) }).strict();
