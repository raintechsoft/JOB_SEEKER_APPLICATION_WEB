import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ServicesContext } from "@/hooks/use-services";
import { createServices } from "@/services";
import { ApiError } from "@/services/api/client";
import type { AuthService, AuthSession } from "@/services/auth/auth.service";
import { Toaster } from "@/components/ui/toaster";
import { useToastStore } from "@/stores/toast-store";
import { AuthScreen, SignInForm, SignUpForm } from "@/features/auth/auth-screen";
import { useUiStore } from "@/stores/ui-store";
import { EmployerRegistrationScreen } from "@/features/auth/employer-registration";
import { ResetPasswordForm, ForgotPasswordForm, AccountActionScreen, AcceptInvitationForm } from "@/features/auth/account-screens";

const { push, replace } = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }), usePathname: () => "/login", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/services/api/config", () => ({ apiConfig: { dataSource: "http", baseUrl: "http://localhost:8000/api/v1" } }));

const session: AuthSession = { user: { id: "user", name: "Alex", email: "alex@example.test", email_verified: true }, workspaces: [], selected_identity_id: null, email_challenge: null };

function mount(ui: ReactNode, overrides: Partial<AuthService>) {
  const services = createServices();
  Object.assign(services.auth, overrides);
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<ServicesContext.Provider value={services}><QueryClientProvider client={cache}>{ui}<Toaster /></QueryClientProvider></ServicesContext.Provider>);
}

beforeEach(() => { vi.clearAllMocks(); useToastStore.setState({ toasts: [] }); Element.prototype.scrollIntoView = vi.fn(); });

describe("authentication forms block invalid requests", () => {
  it("keeps the default professional page independent of the remembered employer role", () => {
    useUiStore.setState({ authRole: "recruiter" });
    mount(<AuthScreen />, {});
    expect(screen.getByText("Sign in with your professional account.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Create a profile" })).toHaveAttribute("href", "/signup?role=professional");
    expect(screen.queryByText("Sign in with your employer account.")).toBeNull();
  });

  it("does not render the password step without backend recovery approval", async () => {
    const reset = vi.fn();
    mount(<AccountActionScreen mode="reset" />, { recovery: vi.fn().mockResolvedValue({ step: "code", expires_at: null }), reset });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/forgot-password?reason=reset-expired"));
    expect(screen.queryByLabelText(/^New password/)).toBeNull();
    expect(reset).not.toHaveBeenCalled();
  });

  it("blocks incomplete recovery codes and cannot advance after server rejection", async () => {
    const challenge = { id: "public-id", kind: "reset" as const, sent_at: new Date().toISOString(), expires_at: new Date(Date.now() + 300000).toISOString() };
    const verifyReset = vi.fn().mockRejectedValue(new ApiError("invalid", 422, { errors: { code: ["Incorrect reset code."] } }));
    const recovery = vi.fn();
    const user = userEvent.setup();
    mount(<ForgotPasswordForm />, { forgot: vi.fn().mockResolvedValue(challenge), verifyReset, recovery });
    await user.type(screen.getByRole("textbox", { name: "Email address" }), "alex@example.test");
    await user.click(screen.getByRole("button", { name: "SEND RESET CODE" }));
    await user.click(await screen.findByRole("button", { name: "VERIFY CODE" }));
    expect(await screen.findByText("Enter the complete 6-digit code.")).toBeVisible();
    expect(verifyReset).not.toHaveBeenCalled();
    for (let i = 1; i <= 6; i++) await user.type(screen.getByRole("textbox", { name: `OTP digit ${i}` }), "1");
    await user.click(screen.getByRole("button", { name: "VERIFY CODE" }));
    expect(await screen.findByText("Incorrect reset code.")).toBeVisible();
    expect(verifyReset).toHaveBeenCalledExactlyOnceWith({ code: "111111" });
    expect(recovery).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/^New password/)).toBeNull();
  });

  it("blocks malformed login, then submits normalized valid credentials once", async () => {
    const login = vi.fn().mockResolvedValue(session);
    const user = userEvent.setup();
    mount(<SignInForm role="professional" />, { login });
    fireEvent.submit(screen.getByRole("button", { name: "LOGIN" }).closest("form")!);
    expect(await screen.findByText("Enter a valid email address.")).toBeVisible();
    expect(login).not.toHaveBeenCalled();
    await user.type(screen.getByRole("textbox", { name: "Email address" }), " ALEX@EXAMPLE.TEST ");
    await user.type(screen.getByLabelText(/^Password/), "old");
    await user.click(screen.getByRole("button", { name: "LOGIN" }));
    await waitFor(() => expect(login).toHaveBeenCalledExactlyOnceWith({ email: "alex@example.test", password: "old" }, "professional"));
    expect(push).toHaveBeenCalledWith("/app/dashboard");
  });

  it("keeps values and maps server field errors without navigation", async () => {
    const login = vi.fn().mockRejectedValue(new ApiError("invalid", 422, { errors: { email: ["These credentials could not be verified."] } }));
    const user = userEvent.setup();
    mount(<SignInForm role="professional" />, { login });
    await user.type(screen.getByRole("textbox", { name: "Email address" }), "alex@example.test");
    await user.type(screen.getByLabelText(/^Password/), "password");
    await user.click(screen.getByRole("button", { name: "LOGIN" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("These credentials could not be verified.");
    expect(alert.closest("#toasts")).not.toBeNull();
    expect(screen.getByRole("button", { name: "LOGIN" }).closest("form")).not.toHaveTextContent("These credentials could not be verified.");
    expect(screen.getByRole("textbox", { name: "Email address" })).toHaveValue("alex@example.test");
    expect(push).not.toHaveBeenCalled();
  });

  it("uses the employer portal and stays on the form after a professional account is rejected", async () => {
    const login = vi.fn().mockRejectedValue(new ApiError("invalid", 422, { errors: { email: ["These credentials could not be verified."] } }));
    const user = userEvent.setup();
    mount(<SignInForm role="recruiter" />, { login });
    await user.click(screen.getByRole("button", { name: "LOGIN" }));
    expect(login).not.toHaveBeenCalled();
    await user.type(screen.getByRole("textbox", { name: "Email address" }), "professional@example.test");
    await user.type(screen.getByLabelText(/^Password/), "password");
    await user.click(screen.getByRole("button", { name: "LOGIN" }));
    await waitFor(() => expect(login).toHaveBeenCalledExactlyOnceWith({ email: "professional@example.test", password: "password" }, "employer"));
    expect(await screen.findByRole("alert")).toHaveTextContent("These credentials could not be verified.");
    expect(push).not.toHaveBeenCalled();
  });

  it("blocks whitespace signup names and short new passwords", async () => {
    const register = vi.fn();
    const user = userEvent.setup();
    mount(<SignUpForm role="professional" />, { register });
    await user.type(screen.getByRole("textbox", { name: "Full name" }), "  ");
    await user.type(screen.getByRole("textbox", { name: "Email address" }), "alex@example.test");
    await user.type(screen.getByLabelText(/^Password/), "short");
    await user.click(screen.getByRole("button", { name: "SUBMIT" }));
    expect(await screen.findByText("Add your full name.")).toBeVisible();
    expect(await screen.findByText("Use at least 8 characters.")).toBeVisible();
    expect(register).not.toHaveBeenCalled();
  });

  it("does not call reset or invitation endpoints for invalid input", async () => {
    const reset = vi.fn();
    const ui = mount(<ResetPasswordForm expiresAt={new Date(Date.now() + 300000).toISOString()} onExpired={vi.fn()} />, { reset });
    fireEvent.submit(screen.getByRole("button", { name: /^reset password$/i }).closest("form")!);
    expect(await screen.findByText("Use at least 8 characters.")).toBeVisible();
    expect(reset).not.toHaveBeenCalled();
    ui.unmount();
    const acceptInvitation = vi.fn();
    mount(<AcceptInvitationForm token="invalid" />, { acceptInvitation });
    await userEvent.click(screen.getByRole("button", { name: /^accept invitation$/i }));
    expect(await screen.findByText("Open the complete invitation link.")).toBeVisible();
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it("validates employer mobile and OTP locally before reaching their endpoints", async () => {
    const challenge = { id: "challenge", kind: "whatsapp" as const, sent_at: new Date().toISOString(), expires_at: new Date(Date.now() + 300000).toISOString() };
    const startEmployer = vi.fn().mockResolvedValue({ intent_id: "intent", challenge });
    const employerVerify = vi.fn();
    const user = userEvent.setup();
    mount(<EmployerRegistrationScreen />, { startEmployer, employerVerify });
    await user.type(screen.getByRole("textbox", { name: "Mobile number" }), "123");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(startEmployer).not.toHaveBeenCalled();
    expect(await screen.findByText("Enter a valid mobile number for the selected country, using digits only.")).toBeVisible();
    await user.clear(screen.getByRole("textbox", { name: "Mobile number" }));
    await user.type(screen.getByRole("textbox", { name: "Mobile number" }), "9876543210");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByRole("button", { name: "Verify & continue" });
    await user.click(screen.getByRole("button", { name: "Verify & continue" }));
    expect(employerVerify).not.toHaveBeenCalled();
    expect(await screen.findByText("Enter the complete 6-digit code.")).toBeVisible();
    expect(document.querySelector('[data-demo-code]')).toBeNull();
    expect(screen.getByText(/Check WhatsApp for the verification code/)).toBeVisible();
    for (let i = 0; i < 6; i++) await user.type(screen.getByRole("textbox", { name: "OTP digit " + (i + 1) }), "001234"[i]);
    expect(screen.getByText(/Code expires in 0[45]:/)).toBeVisible();
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse(challenge.expires_at) + 1);
    try {
      await user.click(screen.getByRole("button", { name: "Verify & continue" }));
      expect(employerVerify).not.toHaveBeenCalled();
      expect(await screen.findByText("This code has expired. Request a new code.")).toBeVisible();
    } finally { clock.mockRestore(); }
    await user.click(screen.getByRole("button", { name: "Verify & continue" }));
    await waitFor(() => expect(employerVerify).toHaveBeenCalledExactlyOnceWith("intent", { challenge_id: "challenge", code: "001234" }));
  });
});
