import type { Company, Id, Professional } from "@/types/domain";
import type {components} from "@/types/generated/api";

export interface AdminOverview {
  professionals: number;
  companies: number;
  pendingVerification: number;
  reportedContent: number;
}

/** Lightweight administration demo. No real users or companies are managed. */
export interface AdminService {
  session?():Promise<{id:string;name:string}>;
  downloadEvidence?(id:string):Promise<Blob>;
  getProfessionals?():Promise<components["schemas"]["AdminProfessional"][]>;
  profileAction?(id:string,input:components["schemas"]["AdminProfileAction"]):Promise<void>;
  verifications?():Promise<components["schemas"]["VerificationReviewItem"][]>;
  reviewVerification?(id:string,input:components["schemas"]["VerificationDecision"]):Promise<void>;
  reports?():Promise<components["schemas"]["AdminReport"][]>;
  reviewReport?(id:string,input:components["schemas"]["ReportDecision"]):Promise<void>;
  deliveries?():Promise<components["schemas"]["DeliveryStatus"][]>;
  retryDelivery?(id:string,expectedAttempts:number,reason:string):Promise<void>;
  /** Live recommendation quality per surface and strategy (platform administrators). */
  recommendationQuality?(days: number): Promise<components["schemas"]["RecommendationQuality"]>;
  getOverview(): Promise<AdminOverview>;
  listProfessionals(): Promise<Pick<Professional, "id" | "name" | "headline" | "public">[]>;
  toggleProfessionalVisibility(id: Id): Promise<boolean>;
  listCompanies(): Promise<Pick<Company, "id" | "name" | "recruiter" | "status">[]>;
  markCompanyVerified(id: Id): Promise<boolean>;
}
