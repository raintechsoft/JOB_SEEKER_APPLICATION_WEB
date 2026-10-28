import { z } from "zod";
import contract from "../../../contracts/validation/talent-discovery.json";

/** Shared limits for recruiter talent discovery; Laravel validates the same contract. */
export const TALENT_DISCOVERY = contract;

export const discoverySectionSchema = z.enum(contract.sections as ["jobMatches", "peopleYouMayKnow", "interests", "suggestions"]);

/** Job seeker people discovery rows. */
export const peopleSectionSchema = z.enum(contract.peopleSections as ["peopleYouMayKnow", "skills", "suggestions"]);

export const interestSkillsSchema = z
  .array(z.string().trim().min(1, "Enter a skill.").max(contract.skillLength, `Use at most ${contract.skillLength} characters per skill.`))
  .max(contract.interestSkillsMax, `Choose up to ${contract.interestSkillsMax} skills.`)
  .refine((skills) => new Set(skills.map((s) => s.toLowerCase())).size === skills.length, "Each skill can be added once.");

export const discoveryRequestSchema = z
  .object({ section: discoverySectionSchema.optional(), job: z.uuid().optional() })
  .refine((v) => (v.section === "jobMatches") === !!v.job, "Job matches need their job.");
