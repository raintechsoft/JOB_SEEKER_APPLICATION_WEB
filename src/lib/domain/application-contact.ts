import type {components} from "@/types/generated/application-wizard-v2";

export type ApplicationChallengeStatus = components["schemas"]["ApplicationChallengeStatus"];
/** Anchor to server time and a monotonic local clock, independent of the device's wall clock. */
export function contactCountdown(status: ApplicationChallengeStatus, receivedAt: number, now: number) {
  const elapsed = Math.max(0, now - receivedAt);
  const remaining = (value: string) => Math.max(0, Math.ceil((Date.parse(value) - Date.parse(status.serverTime) - elapsed) / 1000));
  const expires = remaining(status.expiresAt), resend = remaining(status.resendAt);
  return {expires, resend, expired: status.status === "expired" || (status.status !== "verified" && expires === 0), canResend: resend === 0 && status.status !== "verified"};
}
