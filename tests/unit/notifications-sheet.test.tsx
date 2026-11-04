import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RealNotificationsSheet } from "@/features/workspace/notifications-sheet";
import { ServicesContext } from "@/hooks/use-services";
import { createServices } from "@/services";
import type { NotificationRecord } from "@/services/notifications/notifications.service";
const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
const items: NotificationRecord[] = [
  { id: "application", category: "applications", segments: [], avatar: { type: "company", id: "northstar", name: "Northstar Labs", picture: "https://example.test/logo.png", confidential: false }, title: "Your application was updated", href: "/app/applications", read: false, createdAt: new Date().toISOString() },
  { id: "message", category: "messages", segments: [], avatar: { type: "person", id: "maya", name: "Maya Recruiter", picture: "", confidential: false }, title: "You have a new message", href: "/app/messages?conversation=thread", read: false, createdAt: new Date().toISOString() },
  { id: "job", category: "job_alerts", segments: [], avatar: null, title: "An open role matches your alert", href: "/jobs/job", read: true, createdAt: new Date().toISOString() },
];
beforeEach(() => { navigation.push.mockReset(); });
function setup() {
  const services = createServices();
  const list = vi.spyOn(services.notifications, "list").mockResolvedValue({ items: structuredClone(items), unreadCount: 2, newCount: 3, seenToken: "snapshot" });
  const markSeen = vi.spyOn(services.notifications, "markSeen").mockResolvedValue();
  const remove = vi.spyOn(services.notifications, "delete").mockResolvedValue();
  const markRead = vi.spyOn(services.notifications, "markRead").mockResolvedValue();
  const preferences = vi.spyOn(services.notifications, "preferences").mockResolvedValue([{ category: "messages", channel: "in_app", enabled: true }]);
  const savePreference = vi.spyOn(services.notifications, "savePreference").mockResolvedValue();
  render(<ServicesContext.Provider value={services}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RealNotificationsSheet /></QueryClientProvider></ServicesContext.Provider>);
  return { list, markRead, markSeen, remove, preferences, savePreference };
}
it("acknowledges new notifications separately while category filters preserve unread state", async () => {
  const { preferences, markRead, markSeen } = setup();
  await screen.findByRole("button", { name: /Open notification: Your application/ });
  const filters = screen.getByRole("group", { name: "Filter notifications" });
  for (const [label, count] of [["All", 3], ["Unread", 2], ["Applications", 1], ["Messages", 1], ["Job alerts", 1]] as const) {
    fireEvent.click(within(filters).getByRole("button", { name: label }));
    expect(screen.getAllByRole("article")).toHaveLength(count);
  }
  expect(screen.getByRole("button", { name: /Open notification: An open role/ })).toBeVisible();
  expect(preferences).not.toHaveBeenCalled(); expect(markRead).not.toHaveBeenCalled();
  await waitFor(() => expect(markSeen).toHaveBeenCalledExactlyOnceWith("snapshot"));
  expect(screen.queryByText("Notification preferences")).not.toBeInTheDocument();
});
it("marks an unread item without navigating and refreshes its unread status", async () => {
  const { markRead, list } = setup();
  fireEvent.click(await screen.findByRole("button", { name: "More options for You have a new message" }));
  const menu = screen.getByRole("group", { name: "Notification actions" });
  list.mockResolvedValue({ items: items.map(item => ({ ...item, read: item.id === "message" || item.read })), unreadCount: 1, newCount: 0, seenToken: "seen" });
  fireEvent.click(within(menu).getByRole("button", { name: "Mark as read" }));
  await waitFor(() => expect(markRead).toHaveBeenCalledExactlyOnceWith("message"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Open notification: You have a new message" })).toBeVisible());
  expect(navigation.push).not.toHaveBeenCalled();
});
it("deletes through the service and keeps an item visible when deletion fails", async () => {
  const { remove, list } = setup();
  remove.mockRejectedValueOnce(new Error("Delete unavailable"));
  const trigger = await screen.findByRole("button", { name: "More options for You have a new message" });
  fireEvent.click(trigger); fireEvent.click(screen.getByRole("button", { name: "Delete notification" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Please try again");
  expect(screen.getAllByRole("article")).toHaveLength(3);
  list.mockResolvedValue({ items: items.filter(item => item.id !== "message"), unreadCount: 1, newCount: 0, seenToken: "seen" });
  fireEvent.click(trigger); fireEvent.click(screen.getByRole("button", { name: "Delete notification" }));
  await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2));
  expect(remove).toHaveBeenNthCalledWith(2, "message");
  expect(navigation.push).not.toHaveBeenCalled();
});
it("keeps failed unread opens in the sheet and navigates only after a confirmed read", async () => {
  const { markRead } = setup(); markRead.mockRejectedValueOnce(new Error("Read unavailable"));
  fireEvent.click(await screen.findByRole("button", { name: /Open notification: Your application/ }));
  expect(await screen.findByRole("alert")).toBeVisible(); expect(navigation.push).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Open notification: Your application/ }));
  await waitFor(() => expect(navigation.push).toHaveBeenCalledExactlyOnceWith("/app/applications"));
});
it("dismisses row options with Escape and preserves keyboard focus", async () => {
  setup(); const trigger = await screen.findByRole("button", { name: "More options for You have a new message" });
  fireEvent.click(trigger); const action = screen.getByRole("button", { name: "Mark as read" });
  expect(action).toHaveFocus(); fireEvent.keyDown(action, { key: "Escape" });
  expect(trigger).toHaveFocus(); expect(trigger).toHaveAttribute("aria-expanded", "false");
});
it("uses the supplied company image and consistent person initials when no photo is available", async () => {
  setup(); await screen.findByRole("button", { name: /Open notification: Your application/ });
  expect(document.querySelector('.notification-avatar .company-avatar img')).toHaveAttribute("src", "https://example.test/logo.png");
  expect(document.querySelector('.notification-avatar .avatar')).toHaveTextContent("MR");
  expect(document.querySelector('.notification-avatar .avatar')).toHaveStyle({color: "rgb(255, 255, 255)"});
  expect(document.querySelectorAll('.notification-category-icon')).toHaveLength(1);
});
