import type { Id, Professional, ProfessionalDetails, ProfileCollection, ProfileRecord, Project } from "@/types/domain";
import type { CompletionItem } from "@/lib/domain/profile";

export interface ProfileView {
  person: Professional;
  details: ProfessionalDetails;
  completion: { percent: number; items: CompletionItem[] };
  projects: Project[];
}

export type ProfileSection = "identity" | "headline" | "summary" | "career" | "personal" | "diversity";

export type SaveResult = { ok: true } | { ok: false; error: string };

export interface ProfileService {
  getProfile(): Promise<ProfileView>;
  saveRecord(collection: ProfileCollection, record: ProfileRecord): Promise<SaveResult>;
  deleteRecord(collection: ProfileCollection, id: Id): Promise<void>;
  moveRecord(collection: ProfileCollection | "projects", id: Id, offset: -1 | 1): Promise<void>;
  toggleFeaturedSkill(id: Id): Promise<void>;
  saveSection(section: ProfileSection, values: Record<string, string | boolean>): Promise<SaveResult>;
  setPhoto(file: File): Promise<SaveResult>;
  useDefaultPhoto(): Promise<void>;
  uploadResume(file: File): Promise<SaveResult>;
  downloadResume(): Promise<{ name: string; blob: Blob } | null>;
  removeResume(): Promise<SaveResult>;
}
