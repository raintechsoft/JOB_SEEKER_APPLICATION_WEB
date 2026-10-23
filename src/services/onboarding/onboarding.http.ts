import type { HttpClient } from "../api/client";
import type { OnboardingService } from "./onboarding.service";
import type { ProfileView } from "../profile/profile.service";
import { onboardingSchema } from "@/lib/validation/onboarding";
import { z } from "zod";
export function createHttpOnboardingService(http: HttpClient, reset: () => void): OnboardingService {
  const unavailable = async () => { throw new Error("Use the saved onboarding stages. Resume parsing is not available."); };
  return {
    async saveStage(step, input, version) {
      z.object({ step: z.number().int().min(0).max(3), version: z.number().int().min(1) }).parse({ step, version });
      const data = onboardingSchema(step).parse(input);
      const result = (await http.post<{ data: ProfileView }>(`me/onboarding/${step}`, { ...data, profile_version: version })).data;
      reset();
      return result;
    },
    saveProfessionalStep: unavailable, loadSampleCv: unavailable, completeRecruiterOnboarding: unavailable,
  };
}
