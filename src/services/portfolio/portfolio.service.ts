import type { Id, PortfolioConfig, Project, WorkUpdate } from "@/types/domain";
import type { PublicProfessional } from "@/services/talent/public-profile";

export interface PortfolioView {
  person: PublicProfessional;
  config: PortfolioConfig;
  /** Featured public projects. */
  projects: Project[];
  /** Latest three public work updates. */
  updates: WorkUpdate[];
}

export interface PortfolioSettingsInput {
  title: string;
  headline: string;
  slug: string;
  theme: string;
  public: boolean;
}

export interface PortfolioService {
  getPortfolio(ownerId: Id): Promise<PortfolioView | null>;
  getPortfolioBySlug(slug: string): Promise<PortfolioView | null>;
  /** Live builder update; `ok:false` when the slug belongs to another profile. */
  saveSettings(input: PortfolioSettingsInput): Promise<{ ok: boolean; persisted: boolean }>;
  setSectionVisible(index: number, visible: boolean): Promise<void>;
  moveSection(index: number, offset: -1 | 1): Promise<void>;
  saveSharing(ownerId: Id, input: { public: boolean; otp: boolean; expiry: string }): Promise<boolean>;
}
