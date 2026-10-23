import { commit } from "@/mocks/store/demo-db";
import { safeUrl } from "@/lib/utils/url";
import type { OnboardingService } from "./onboarding.service";

export const mockOnboardingService: OnboardingService = {
  async saveStage() { throw new Error("Use the prototype onboarding flow in demo mode."); },
  async saveProfessionalStep(input) {
    commit((db) => {
      const p = db.professionals[0];
      for (const k of ["name", "headline", "location", "experience", "education", "interests"] as const) if (input[k] !== undefined) p[k] = input[k]!;
      if (input.years !== undefined) p.years = input.years;
      if (input.skills) p.skills = input.skills;
      db.portfolios.p0.title = p.name;
      db.portfolios.p0.headline = p.headline;
      if (input.complete) {
        p.public = !!input.public;
        p.complete = 100;
        db.session = { role: "professional" };
      }
    });
  },

  async loadSampleCv() {
    commit((db) => {
      const p = db.professionals[0];
      p.skills = ["Product design", "Figma", "UX research", "Design systems"];
      p.experience = "Product Designer at Forma Studio · 2022–Present";
      p.education = "B.Des, Communication Design · Srishti Institute";
    });
  },

  async completeRecruiterOnboarding(input) {
    commit((db) => {
      Object.assign(db.companies[0], { ...input, website: safeUrl(input.website) });
      db.session = { role: "recruiter" };
    });
  },
};
