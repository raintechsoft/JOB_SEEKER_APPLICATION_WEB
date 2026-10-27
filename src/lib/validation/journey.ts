import { z } from "zod";
import rules from "../../../contracts/validation/career-journey.json";
import type {
  JourneyChapter,
  MemoryInput,
} from "@/services/journey/journey.service";
import { today } from "@/lib/utils/date";

export const JOURNEY_RULES = rules;
export const hasEmploymentDates = (c: JourneyChapter) =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(c.start) &&
  (c.current || /^\d{4}-(0[1-9]|1[0-2])$/.test(c.end));
export const memoryInEmployment = (
  date: string,
  c: Pick<JourneyChapter, "start" | "end" | "current">,
) => date.slice(0, 7) >= c.start && (c.current || date.slice(0, 7) <= c.end);
const text = (max: number) =>
  z
    .string()
    .trim()
    .refine((v) => [...v].length <= max, `Use at most ${max} characters.`);
export const memorySchema = z
  .object({
    employmentId: z.string().min(1),
    title: text(rules.titleMax).min(1, "Add a title."),
    story: text(rules.storyMax),
    type: z.enum(["Moment", "Milestone", "Reflection"]),
    date: z
      .string()
      .refine(
        (v) =>
          /^\d{4}-\d{2}-\d{2}$/.test(v) &&
          Number.isFinite(Date.parse(v)) &&
          new Date(v).toISOString().slice(0, 10) === v &&
          v >= "1800-01-01" &&
          v <= today(),
        "Choose a valid date through today.",
      ),
    public: z.boolean().default(false),
    photos: z
      .array(
        z.object({
          id: z.string().min(1),
          url: z.string().min(1),
          alt: text(rules.altMax),
          name: z.string(),
          bytes: z.number().int().min(1).max(rules.photoBytesMax),
        }),
      )
      .max(rules.photosMax),
    colleagueIds: z
      .array(z.string().min(1))
      .max(rules.colleaguesMax)
      .default([]),
  })
  .superRefine((v, ctx) => {
    if (new Set(v.photos.map((p) => p.id)).size !== v.photos.length)
      ctx.addIssue({
        code: "custom",
        path: ["photos"],
        message: "Choose each photo once.",
      });
    if (new Set(v.colleagueIds).size !== v.colleagueIds.length)
      ctx.addIssue({
        code: "custom",
        path: ["colleagueIds"],
        message: "Choose each colleague once.",
      });
    if (v.public && v.photos.some((p) => !p.alt.trim()))
      ctx.addIssue({
        code: "custom",
        path: ["photos"],
        message: "Describe each photo before publishing.",
      });
  });
export function validateMemory(
  input: MemoryInput,
  chapters: JourneyChapter[],
  profilePublic: boolean,
): MemoryInput {
  const value = memorySchema.parse(input);
  const chapter = chapters.find((c) => c.id === value.employmentId);
  if (!chapter || !hasEmploymentDates(chapter))
    throw new Error("Add employment dates before adding memories.");
  if (!memoryInEmployment(value.date, chapter))
    throw new Error("Choose a date within this employment period.");
  if (value.public && (!profilePublic || !chapter.public))
    throw new Error(
      "Make your profile and this employment public before publishing.",
    );
  if (
    value.colleagueIds.some(
      (id) => !chapter.colleagues?.some((c) => c.id === id),
    )
  )
    throw new Error("Choose colleagues from this workplace.");
  return value;
}
export const colleagueSchema = z.object({
  employmentId: z.string().min(1),
  personId: z.string().trim().min(1, "Choose someone you follow on Skillora."),
  role: text(rules.roleMax),
});
