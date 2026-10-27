import { z } from "zod";
import { today } from "@/lib/utils/date";
import contract from "../../../contracts/validation/portfolio.json";
export const portfolioSettingsSchema = z.object({
  title: z.string().trim().min(1).refine((v) => [...v].length <= 120, "Use at most 120 characters."),
  headline: z.string().trim().min(1).refine((v) => [...v].length <= 200, "Use at most 200 characters."),
  slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens."),
  theme: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a six-digit color."), public: z.boolean(),
});
export const portfolioSharingSchema = z.object({ public: z.boolean(), otp: z.literal(false, "OTP sharing is not enabled."), expiry: z.string().refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v && v >= today() && Date.parse(v)-Date.parse(today()) <= contract.shareExpiryMaxDays*86400000, "Choose a valid expiry within the next 365 days (UTC).") });
