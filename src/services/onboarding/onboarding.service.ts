export interface OnboardingProfileInput {
  name?: string;
  headline?: string;
  location?: string;
  experience?: string;
  education?: string;
  interests?: string;
  years?: number;
  skills?: string[];
  public?: boolean;
  complete?: boolean;
}

export interface RecruiterOnboardingInput {
  recruiter: string;
  email: string;
  name: string;
  title: string;
  website: string;
  interests: string;
}

export interface OnboardingService {
  saveStage(step: number, input: Record<string, unknown>, version: number): Promise<import("../profile/profile.service").ProfileView>;
  saveProfessionalStep(input: OnboardingProfileInput): Promise<void>;
  /** SIMULATED CV PARSING: loads fixed sample details; the selected file is never read. */
  loadSampleCv(): Promise<void>;
  completeRecruiterOnboarding(input: RecruiterOnboardingInput): Promise<void>;
}
