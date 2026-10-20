import { z } from "zod";
import { today } from "@/lib/utils/date";
import { parseSkills } from "@/lib/utils/text";

const optionalUrl = z.union([z.literal(""), z.url({ message: "Use a complete HTTP or HTTPS URL." })]);
const pastDate = (label: string) =>
  z
    .string()
    .min(1, `Add the ${label}.`)
    .refine((v) => v <= today(), `The ${label} cannot be in the future.`);

export const projectSchema = z.object({
  title: z.string().trim().min(1, "Add a project title.").max(120),
  category: z.enum(["Design", "Engineering", "Data", "Business"]),
  description: z.string().trim().min(1, "Add a project overview.").max(2000),
  contribution: z.string().trim().min(1, "Describe your role and contribution.").max(1200),
  skills: z.string().trim().min(1, "Add at least one skill."),
  url: optionalUrl,
  repository: optionalUrl,
  start: pastDate("start date"),
  date: pastDate("completion date"),
  visibility: z.enum(["Public", "Private"]),
  featured: z.boolean(),
  coverFile: z.custom<FileList | null>().optional(),
});
export type ProjectFormValues = z.input<typeof projectSchema>;

export const updateSchema = z.object({
  title: z.string().trim().min(1, "Add an update title.").max(150),
  description: z.string().trim().min(1, "Tell the story behind it.").max(2000),
  category: z.string().min(1),
  date: pastDate("date"),
  skills: z.string().trim().refine((v) => parseSkills(v).length > 0, "Add at least one skill."),
  project: z.string(),
  visibility: z.enum(["Public", "Private"]),
});
export type UpdateFormValues = z.input<typeof updateSchema>;
