import type { PersonSummary } from "@/types/api";
import type { Company, DemoSession, DemoSettings, Role } from "@/types/domain";

export interface ProfessionalShellData {
  person: PersonSummary & { email: string; location: string; complete: number };
  unreadConversations?: number;
}

export interface RecruiterShellData {
  identity: PersonSummary;
  companyName: string;
  title: string;
  unreadConversations?: number;
  savedCount?: number;
}

export interface ProfessionalSummary {
  person: PersonSummary & { location: string; complete: number };
  pulseDays?: number;
  followingCount?: number;
  savedCount?: number;
}

export type SettingKey = "profile-public" | "portfolio-public" | "updates-public" | "notifications";

export interface WorkspaceSettings extends DemoSettings {
  moderationHidden?:boolean;
  profilePublic: boolean;
  portfolioPublic: boolean;
  name: string;
  email: string;
}

/**
 * Session and workspace context.
 *
 * AUTHENTICATION IS SIMULATED. `setRole` exists because the prototype switches role by URL; it is
 * not authorization. Real sign-in, tokens and route protection belong to the future backend.
 */
export interface WorkspaceService {
  getSession(): Promise<DemoSession | null>;
  setRole(role: Role): Promise<void>;
  signIn(role: Role): Promise<void>;
  signUp(role: Role, name: string): Promise<void>;
  signOut(): Promise<void>;
  getProfessionalShell(): Promise<ProfessionalShellData>;
  getRecruiterShell(): Promise<RecruiterShellData>;
  getProfessionalSummary(): Promise<ProfessionalSummary>;
  /** The signed-in recruiter's company record. */
  getHomeCompany(): Promise<Company>;
  getSettings(): Promise<WorkspaceSettings>;
  updateSetting(key: SettingKey, value: boolean): Promise<boolean>;
  resetDemo(): Promise<void>;
}
