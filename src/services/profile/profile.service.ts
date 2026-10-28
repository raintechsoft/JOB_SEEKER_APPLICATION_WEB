import type { Id, Professional, ProfessionalDetails, ProfileCollection, ProfileRecord, Project } from "@/types/domain";
import type { CompletionItem } from "@/lib/domain/profile";

export interface ProfileView {
  version?: number;
  onboardingStep?: number;
  person: Professional;
  details: ProfessionalDetails;
  completion: { percent: number; items: CompletionItem[] };
  projects: Project[];
}

export type ProfileSection = "identity" | "headline" | "summary" | "career" | "personal" | "diversity";

export type SaveResult = { ok: true } | { ok: false; error: string };

export interface ProfileService {
  getProfile(): Promise<ProfileView>;
  saveRecord(collection: ProfileCollection, record: ProfileRecord, revision?: number): Promise<SaveResult>;
  deleteRecord(collection: ProfileCollection, id: Id, revision?: number, confirmJourneyDelete?: boolean): Promise<void>;
  moveRecord(collection: ProfileCollection | "projects", id: Id, offset: -1 | 1, revision?: number): Promise<void>;
  toggleFeaturedSkill(id: Id, revision?: number): Promise<void>;
  saveSection(section: ProfileSection, values: Record<string, string | boolean>, revision?: number): Promise<SaveResult>;
  setPhoto(file: File, revision?: number): Promise<SaveResult>;
  useDefaultPhoto(revision?: number): Promise<void>;
  setCover(file: File, revision?: number): Promise<SaveResult>;
  removeCover(revision?: number): Promise<void>;
  uploadResume(file: File, revision?: number): Promise<SaveResult>;
  downloadResume(): Promise<{ name: string; blob: Blob } | null>;
  removeResume(revision?: number): Promise<SaveResult>;
}
