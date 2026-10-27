import { z } from "zod";
import fields from "../../../contracts/validation/onboarding.json";
import { profileFieldsSchema } from "./profile";
export const onboardingSchema = (step: number) => step === 0 ? profileFieldsSchema(fields.basic) : step === 2 ? profileFieldsSchema(fields.background).and(z.object({ skills: z.array(z.string().trim().min(1).max(100)).min(1).max(30).refine((skills) => new Set(skills.map((s) => s.toLowerCase())).size === skills.length, "Use distinct skills.") })) : step === 3 ? z.object({ public: z.boolean() }) : z.object({});
