import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationBell } from "@/features/workspace/notification-bell";
import { NotificationPreferences } from "@/features/settings/notification-preferences";
import { ServicesContext } from "@/hooks/use-services";
import { createServices } from "@/services";
import { createHttpNotificationsService } from "@/services/notifications/notifications.http";
import type { HttpClient } from "@/services/api/client";
import type { AuthService } from "@/services/auth/auth.service";

vi.mock("@/services/api/config", () => ({ apiConfig: { dataSource: "http", baseUrl: "http://api.example.test/api/v1" } }));
const open = vi.hoisted(() => vi.fn());
vi.mock("@/features/workspace/dialogs", () => ({ workspaceDialogs: { notifications: open } }));

it("shows new count rather than unread, caps the badge and hides it after acknowledgment", async () => {
  const services = createServices();
  vi.spyOn(services.notifications, "counts").mockResolvedValue({ newCount: 105, unreadCount: 4 });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  cache.setQueryData(["auth","session"],{user:{id:"test-user",email_verified:true},selected_identity_id:"test-identity"});
  render(<ServicesContext.Provider value={services}><QueryClientProvider client={cache}><NotificationBell role="professional" /></QueryClientProvider></ServicesContext.Provider>);
  expect(await screen.findByText("99+")).toBeVisible();
  expect(screen.getByRole("button", { name: "Notifications" })).toHaveAccessibleDescription("105 new notifications");
  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
  expect(open).toHaveBeenCalledOnce();
  cache.setQueryData(["notification-counts", "test-user", "test-identity", "professional"], { newCount: 0, unreadCount: 4 });
  await waitFor(() => expect(screen.queryByText("99+")).not.toBeInTheDocument());
});

it("saves notification preferences from Settings and preserves them when saving fails", async () => {
  const services = createServices();
  const preferences = vi.spyOn(services.notifications, "preferences").mockResolvedValue([{ category: "messages", channel: "in_app", enabled: true }]);
  const save = vi.spyOn(services.notifications, "savePreference").mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValue();
  render(<ServicesContext.Provider value={services}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><NotificationPreferences /></QueryClientProvider></ServicesContext.Provider>);
  const checkbox = await screen.findByRole("checkbox", { name: "In Skillora" });
  fireEvent.click(checkbox);
  expect(await screen.findByRole("alert")).toBeVisible(); expect(checkbox).toBeChecked();
  preferences.mockResolvedValue([{ category: "messages", channel: "in_app", enabled: false }]);
  fireEvent.click(checkbox);
  await waitFor(() => expect(checkbox).not.toBeChecked());
  expect(save).toHaveBeenLastCalledWith({ category: "messages", channel: "in_app", enabled: false });
});

it("rejects invalid deletion IDs, seen receipts and preferences before any session or transport call", async () => {
  const http = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } as unknown as HttpClient;
  const auth = { me: vi.fn() } as unknown as AuthService;
  const service = createHttpNotificationsService(http, auth);
  for (const id of ["", "other-user", "../notifications"]) await expect(service.delete(id)).rejects.toThrow();
  for (const token of ["", "a".repeat(4097)]) await expect(service.markSeen(token)).rejects.toThrow();
  await expect(service.savePreference({ category: "messages", channel: "in_app", enabled: "yes" } as never)).rejects.toThrow();
  expect(auth.me).not.toHaveBeenCalled();
  for (const method of [http.get, http.post, http.patch, http.delete]) expect(method).not.toHaveBeenCalled();
});
