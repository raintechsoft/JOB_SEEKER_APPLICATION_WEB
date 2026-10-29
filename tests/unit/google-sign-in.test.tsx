import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServicesContext } from "@/hooks/use-services";
import type { Services } from "@/services";
import { useToastStore } from "@/stores/toast-store";

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => nav.params, useRouter: () => ({ replace: nav.replace, push: vi.fn() }) }));
vi.mock("@/services/api/config", () => ({ apiConfig: { dataSource: "http", baseUrl: "http://localhost:8000/api/v1" } }));
vi.mock("@/features/auth/clear-identity-state", () => ({ clearIdentityState: vi.fn() }));

const { GoogleReturnNotice, GoogleSignInButton, googleRedirectUrl } = await import("@/features/auth/google-sign-in");

const assign = vi.fn();
beforeEach(() => {
  nav.params = new URLSearchParams();
  nav.replace.mockReset();
  assign.mockReset();
  useToastStore.setState({ toasts: [] });
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_SIGN_IN_ENABLED", "true");
  vi.stubGlobal("location", { ...window.location, assign });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function mount(ui: React.ReactNode, completeExternalSignIn = vi.fn()) {
  const services = { auth: { completeExternalSignIn } } as unknown as Services;
  render(<ServicesContext.Provider value={services}><QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider></ServicesContext.Provider>);
  return completeExternalSignIn;
}

it("starts Google sign-in with a full navigation to Laravel's OAuth entry point", () => {
  expect(googleRedirectUrl()).toBe("http://localhost:8000/auth/google/redirect");
  mount(<GoogleSignInButton />);
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  expect(assign).toHaveBeenCalledWith("http://localhost:8000/auth/google/redirect");
  expect(screen.getByRole("button", { name: "Redirecting to Google…" })).toBeDisabled();
});

it("does not navigate when Google sign-in is disabled", () => {
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_SIGN_IN_ENABLED", "false");
  mount(<GoogleSignInButton />);
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  expect(assign).not.toHaveBeenCalled();
});

it("adopts the Laravel session after a successful return and opens the job-seeker workspace", async () => {
  nav.params = new URLSearchParams("role=professional&google=success");
  const complete = mount(<GoogleReturnNotice />, vi.fn().mockResolvedValue({ user: { id: "u", email_verified: true }, selected_identity_id: "w", workspaces: [{ id: "w", kind: "professional" }] }));
  expect(screen.getByRole("status")).toHaveTextContent("Signing you in with Google…");
  await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/app/dashboard"));
  expect(complete).toHaveBeenCalledOnce();
});

it.each([
  ["use_password", "sign in with your email and password"],
  ["something_unknown", "couldn’t be completed"],
])("explains the %s error without signing in", (code, text) => {
  nav.params = new URLSearchParams(`role=professional&google_error=${code}`);
  const complete = mount(<GoogleReturnNotice />);
  expect(useToastStore.getState().toasts).toEqual([expect.objectContaining({ tone: "error", message: expect.stringContaining(text) })]);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(nav.replace).toHaveBeenCalledWith("/?role=professional");
  expect(complete).not.toHaveBeenCalled();
});

it("returns quietly to the form when the user cancels at Google", () => {
  nav.params = new URLSearchParams("role=professional&google_error=cancelled");
  const complete = mount(<GoogleReturnNotice />);
  expect(useToastStore.getState().toasts).toEqual([]);
  expect(complete).not.toHaveBeenCalled();
});
