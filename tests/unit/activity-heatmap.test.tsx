import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServicesContext } from "@/hooks/use-services";
import type { Services } from "@/services";
import { activityLevel, currentPeriod, daysInMonth, formatCalendarDate, isoDate, levelRanges, monthGrid, parsePeriod, shiftPeriod, weekdayIndex, type ActivityCalendarMonth } from "@/lib/activity/activity-calendar";
import { ActivityHeatmap } from "@/features/feed/activity-heatmap";

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => nav.params, usePathname: () => "/app/dashboard", useRouter: () => ({ push: nav.push, replace: nav.replace }) }));

const flat = (y: number, m: number) => monthGrid(y, m).flat();

it("places every date of a month in its Monday-first weekday column", () => {
  // October 2026 starts on Thursday (column 3) and ends on Saturday.
  const october = monthGrid(2026, 10);
  expect(october[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
  expect(october.at(-1)).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", null]);
  for (let year = 2023; year <= 2028; year++)
    for (let month = 1; month <= 12; month++) {
      const cells = flat(year, month);
      const dates = cells.filter(Boolean) as string[];
      expect(dates).toEqual(Array.from({ length: daysInMonth(year, month) }, (_, i) => isoDate(year, month, i + 1)));
      dates.forEach((date) => expect(cells.indexOf(date) % 7).toBe(weekdayIndex(date)));
      expect(cells.length % 7).toBe(0);
    }
});

it("handles every month length, leap years and four to six rows", () => {
  expect(daysInMonth(2024, 2)).toBe(29);
  expect(daysInMonth(2025, 2)).toBe(28);
  expect(daysInMonth(2000, 2)).toBe(29);
  expect(daysInMonth(2100, 2)).toBe(28);
  expect(daysInMonth(2026, 4)).toBe(30);
  expect(daysInMonth(2026, 12)).toBe(31);
  expect(monthGrid(2021, 2)).toHaveLength(4); // 28 days starting Monday
  expect(monthGrid(2026, 10)).toHaveLength(5);
  expect(monthGrid(2026, 8)).toHaveLength(6); // starts Saturday, 31 days
  // Months beginning on each weekday.
  const starts = new Set<number>();
  for (let m = 1; m <= 12; m++) starts.add(weekdayIndex(isoDate(2026, m, 1)));
  expect(starts.size).toBe(7);
});

it("derives periods safely from the URL and the policy time zone", () => {
  const latest = { year: 2026, month: 10 };
  expect(parsePeriod("9", "2026", latest)).toEqual({ year: 2026, month: 9 });
  for (const [m, y] of [["13", "2026"], ["0", "2026"], ["x", "2026"], ["1", "1999"], ["11", "2026"], [null, "2026"], ["10", null], ["1.5", "2026"]]) expect(parsePeriod(m, y, latest)).toBeNull();
  expect(shiftPeriod({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  expect(shiftPeriod({ year: 2025, month: 12 }, 1)).toEqual({ year: 2026, month: 1 });
  // 31 Oct 19:00 UTC is already 1 November in Asia/Kolkata.
  expect(currentPeriod(new Date("2026-10-31T19:00:00Z"))).toEqual({ year: 2026, month: 11 });
  expect(currentPeriod(new Date("2026-10-31T18:00:00Z"))).toEqual({ year: 2026, month: 10 });
  expect(formatCalendarDate("2026-10-01")).toBe("October 1, 2026");
});

it("applies one central threshold policy", () => {
  expect([0, 1, 2, 3, 5, 6, 10, 11, 99].map(activityLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  expect(levelRanges()).toEqual(["No activity", "1–2 activities", "3–5 activities", "6–10 activities", "11+ activities"]);
});

function month(year: number, m: number, counts: Record<number, [string, number][]> = {}): ActivityCalendarMonth {
  const labels: Record<string, string> = { post_published: "Posts published", comment_added: "Comments added", work_update_recorded: "Work updates recorded" };
  const days = Array.from({ length: daysInMonth(year, m) }, (_, i) => {
    const activities = (counts[i + 1] ?? []).map(([type, count]) => ({ type, label: labels[type], count })) as ActivityCalendarMonth["days"][number]["activities"];
    const count = activities.reduce((n, a) => n + a.count, 0);
    return { date: isoDate(year, m, i + 1), count, level: activityLevel(count), activities };
  });
  return { year, month: m, timezone: "Asia/Kolkata", total: days.reduce((n, d) => n + d.count, 0), days, range: { earliest: "2026-01", latest: "2026-10" } };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T06:30:00Z"));
  nav.params = new URLSearchParams();
  nav.push.mockReset();
});
afterEach(() => vi.useRealTimers());

function mount(getActivityCalendar = vi.fn(async (_role: string, y: number, m: number) => month(y, m, y === 2026 && m === 10 ? { 14: [["post_published", 1], ["comment_added", 2], ["work_update_recorded", 1]] } : {}))) {
  const services = { feed: { getActivityCalendar } } as unknown as Services;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<ServicesContext.Provider value={services}><QueryClientProvider client={client}><ActivityHeatmap role="professional" /></QueryClientProvider></ServicesContext.Provider>);
  return { ...view, getActivityCalendar };
}

it("opens on the current month without writing history, with real cells and padding", async () => {
  const { getActivityCalendar, container } = mount();
  expect(await screen.findByText("activities in October 2026", { exact: false })).toHaveTextContent("4 activities in October 2026");
  expect(getActivityCalendar).toHaveBeenCalledWith("professional", 2026, 10);
  expect(nav.push).not.toHaveBeenCalled();
  expect(container.querySelectorAll("button.activity-cell")).toHaveLength(31);
  expect(container.querySelectorAll("td.activity-pad")).toHaveLength(4);
  expect(container.querySelector("td.activity-pad button")).toBeNull();
  const first = container.querySelectorAll("tbody tr")[0].querySelectorAll("td");
  expect(within(first[3]).getByRole("button")).toHaveAccessibleName("October 1, 2026: No activity");
  expect(screen.getByRole("button", { name: /^October 14, 2026: 4 activities/ })).toHaveClass("l2");
  expect(screen.getByRole("button", { name: "Next month, November 2026" })).toBeDisabled();
  // Every date of the month is visibly numbered, and today is marked.
  expect([...container.querySelectorAll("button.activity-cell")].map((b) => b.textContent)).toEqual(Array.from({ length: 31 }, (_, i) => String(i + 1)));
  expect(screen.getByRole("button", { name: "October 15, 2026: No activity" })).toHaveAttribute("aria-current", "date");
});

it("shows the full date and breakdown on hover, focus and tap", async () => {
  mount();
  const busy = await screen.findByRole("button", { name: /^October 14, 2026/ });
  fireEvent.mouseEnter(busy);
  const tip = screen.getByRole("tooltip");
  expect(tip).toHaveTextContent("October 14, 2026");
  expect(tip).toHaveTextContent("4 activities");
  expect(tip).toHaveTextContent("Posts published: 1");
  expect(tip).toHaveTextContent("Comments added: 2");
  expect(busy).toHaveAttribute("aria-describedby", tip.id);
  fireEvent.mouseLeave(busy);
  expect(screen.queryByRole("tooltip")).toBeNull();

  const quiet = screen.getByRole("button", { name: "October 15, 2026: No activity" });
  fireEvent.focus(quiet);
  expect(screen.getByRole("tooltip")).toHaveTextContent("October 15, 2026No activity");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).toBeNull();

  fireEvent.click(quiet);
  fireEvent.mouseLeave(quiet);
  expect(screen.getByRole("tooltip")).toHaveTextContent("October 15, 2026");
  fireEvent.click(quiet);
  expect(screen.queryByRole("tooltip")).toBeNull();
});

it("changes month only through explicit controls and keeps other URL parameters", async () => {
  nav.params = new URLSearchParams("view=saved&q=design");
  mount();
  await screen.findByText("4", { selector: "strong" });
  fireEvent.click(screen.getByRole("button", { name: "Previous month, September 2026" }));
  expect(nav.push).toHaveBeenLastCalledWith("/app/dashboard?view=saved&q=design&activityMonth=9&activityYear=2026", { scroll: false });
  fireEvent.change(screen.getByRole("combobox", { name: "Month" }), { target: { value: "2" } });
  expect(nav.push).toHaveBeenLastCalledWith(expect.stringContaining("activityMonth=2&activityYear=2026"), { scroll: false });
  // Choosing an earlier year keeps the month, clamped to the first permitted month.
  expect(screen.getByRole("option", { name: "November" })).toBeDisabled();
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(nav.push).toHaveBeenCalledTimes(2);
});

it("restores the URL period, falls back on invalid values and shows correct month lengths", async () => {
  nav.params = new URLSearchParams("activityMonth=2&activityYear=2026");
  const { getActivityCalendar, container, unmount } = mount();
  await screen.findByText("No activity recorded in February 2026");
  expect(getActivityCalendar).toHaveBeenCalledWith("professional", 2026, 2);
  expect(container.querySelectorAll("button.activity-cell")).toHaveLength(28);
  expect(screen.getByRole("button", { name: "Previous month, January 2026" })).toBeEnabled();
  unmount();

  nav.params = new URLSearchParams("activityMonth=14&activityYear=2026");
  const fallback = mount();
  await screen.findByText(/in October 2026/);
  expect(fallback.getActivityCalendar).toHaveBeenLastCalledWith("professional", 2026, 10);
});

it("distinguishes a failed request from an empty month and retries the same period", async () => {
  nav.params = new URLSearchParams("activityMonth=9&activityYear=2026");
  const getActivityCalendar = vi.fn().mockRejectedValueOnce(new Error("offline")).mockImplementation(async (_r: string, y: number, m: number) => month(y, m));
  const { container } = mount(getActivityCalendar);
  expect(await screen.findByRole("alert")).toHaveTextContent("Activity for September 2026 could not be loaded.");
  expect(container.querySelectorAll("button.activity-cell")).toHaveLength(0);
  expect(screen.queryByText(/No activity recorded/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("No activity recorded in September 2026")).toBeInTheDocument();
  await waitFor(() => expect(getActivityCalendar).toHaveBeenLastCalledWith("professional", 2026, 9));
});
