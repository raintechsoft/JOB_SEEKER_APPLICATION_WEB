import type { Company, Id, Professional } from "@/types/domain";

export interface AdminOverview {
  professionals: number;
  companies: number;
  pendingVerification: number;
  reportedContent: number;
}

/** Lightweight administration demo. No real users or companies are managed. */
export interface AdminService {
  getOverview(): Promise<AdminOverview>;
  listProfessionals(): Promise<Pick<Professional, "id" | "name" | "headline" | "public">[]>;
  toggleProfessionalVisibility(id: Id): Promise<boolean>;
  listCompanies(): Promise<Pick<Company, "id" | "name" | "recruiter" | "status">[]>;
  markCompanyVerified(id: Id): Promise<boolean>;
}
