export interface OtpChallenge {
  id: string;
  kind: "sms" | "email";
  target: string;
  sentAt: number;
  expiresAt: number;
  /**
   * DEMO ONLY: the mock returns the code so the UI can display it ("No SMS is sent"). A real
   * backend never returns the code to the client.
   */
  demoCode?: string;
}

export type OtpResult = { ok: true } | { ok: false; error: string };

export interface EmployerRegistrationInput {
  country: string;
  mobile: string;
  accountType: "company" | "individual";
  fullName: string;
  email: string;
  hiringFor: "company" | "consultancy";
  companyName: string;
  industry: string;
  employees: string;
  designation: string;
  pincode: string;
  address: string;
}

export interface RegistrationService {
  requestOtp(kind: "sms" | "email", target: string): Promise<OtpChallenge>;
  verifyOtp(challengeId: string, target: string, code: string): Promise<OtpResult>;
  /** Requires both challenges to have been verified for the same mobile number and email. */
  registerEmployer(input: EmployerRegistrationInput): Promise<OtpResult>;
}

export const OTP_RESEND_AFTER_MS = 60_000;
