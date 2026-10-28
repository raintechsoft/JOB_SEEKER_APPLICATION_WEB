import type { components } from "@/types/generated/api";

export type Challenge = components["schemas"]["Challenge"];
export type Workspace = components["schemas"]["Workspace"];
export type AuthSession = components["schemas"]["AuthSession"];
export type EmployerDetails = components["schemas"]["EmployerDetails"];
export type EmployerCompany = components["schemas"]["EmployerCompany"];
export type OrganizationAccess = components["schemas"]["OrganizationAccess"];
export type RecoveryStatus = { step: "email" | "code" | "password"; expires_at: string | null };

export interface AuthService {
  login(input: components["schemas"]["Login"], portal?: "professional" | "employer"): Promise<AuthSession>;
  register(input: components["schemas"]["Register"]): Promise<AuthSession>;
  me(): Promise<AuthSession>;
  logout(): Promise<void>;
  forgot(input: { email: string }): Promise<Challenge>;
  recovery(): Promise<RecoveryStatus>;
  recoveryNavigation(screen: "code" | "password" | "other"): Promise<void>;
  verifyReset(input: { code: string }): Promise<void>;
  reset(input: components["schemas"]["ResetPassword"]): Promise<void>;
  changePassword(input: components["schemas"]["ChangePassword"]): Promise<void>;
  requestEmailCode(): Promise<Challenge>;
  verifyEmail(input: { challenge_id: string; code: string }): Promise<AuthSession>;
  selectWorkspace(id: string): Promise<AuthSession>;
  startEmployer(input: { country: string; mobile: string }): Promise<{ intent_id: string; challenge: Challenge }>;
  employerDetails(intent: string, input: EmployerDetails): Promise<Challenge>;
  employerResend(intent: string, kind: "whatsapp" | "email"): Promise<Challenge>;
  employerVerify(intent: string, input: { challenge_id: string; code: string }): Promise<void>;
  employerFinalize(intent: string, input: EmployerCompany): Promise<AuthSession>;
  acceptInvitation(token: string): Promise<AuthSession>;
  /** Adopts a session Laravel established outside the SPA (Google sign-in redirect). */
  completeExternalSignIn(): Promise<AuthSession>;
  organization(id: string): Promise<OrganizationAccess>;
  invite(id: string, input: { email: string; role: NonNullable<Workspace["role"]> }): Promise<void>;
  updateMember(organization: string, member: string, input: { role: NonNullable<Workspace["role"]>; status: "active" | "inactive" }): Promise<void>;
}
