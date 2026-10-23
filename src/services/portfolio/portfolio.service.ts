import type { Id, PortfolioConfig, Project, WorkUpdate } from "@/types/domain";
import type { PublicProfessional } from "@/services/talent/public-profile";

export interface PortfolioView {
  accessGranted?: boolean;
  shareLink?: { id: string; expiresAt: string | null } | null;
  person: PublicProfessional;
  config: PortfolioConfig;
  /** Featured public projects. */
  projects: Project[];
  /** Latest three public work updates. */
  updates: WorkUpdate[];
}

export interface PortfolioSettingsInput {
  version?: number;
  title: string;
  headline: string;
  slug: string;
  theme: string;
  public: boolean;
}

export interface PortfolioService {
  createShare?(input: { public: boolean; otp: false; expiry: string }, version: number): Promise<{ id: string; url: string; expiresAt: string | null; version: number }>;
  revokeShare?(id: string, version: number): Promise<void>;
  getPortfolio(ownerId: Id): Promise<PortfolioView | null>;
  getPortfolioBySlug(slug: string): Promise<PortfolioView | null>;
  /** Live builder update; `ok:false` when the slug belongs to another profile. */
  saveSettings(input: PortfolioSettingsInput): Promise<{ ok: boolean; persisted: boolean; version?: number }>;
  setSectionVisible(index: number, visible: boolean): Promise<void>;
  moveSection(index: number, offset: -1 | 1): Promise<void>;
  saveSharing(ownerId: Id, input: { public: boolean; otp: boolean; expiry: string }): Promise<boolean>;
}
