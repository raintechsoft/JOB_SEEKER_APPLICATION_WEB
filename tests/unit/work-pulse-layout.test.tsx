import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Heatmap, pulseLayout } from "@/components/work/pulse";
import type { Pulse } from "@/services/work/work.service";

vi.mock("@/features/work/dialogs", () => ({ useUpdateDialogs: () => ({ day: vi.fn() }) }));

const days = (end: string, count: number) =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date(end + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - (count - 1 - i));
    return { date: d.toISOString().slice(0, 10), count: 0 };
  });

it("offsets the first day to its weekday row and labels months on their columns", () => {
  // 30 July 2026 is a Thursday: four Sunday-first rows precede it.
  const cells = days("2026-10-28", 91);
  expect(cells[0].date).toBe("2026-07-30");
  expect(pulseLayout(cells)).toEqual({ offset: 4, months: [{ column: 0, label: "Aug" }, { column: 5, label: "Sep" }, { column: 9, label: "Oct" }] });
  expect(pulseLayout(days("2026-10-28", 365)).months[0]).toEqual({ column: 0, label: "Nov" });
});

it("renders padding cells, row-accurate weekday labels and one button per day", () => {
  const pulse: Pulse = { cells: days("2026-10-28", 91), months: [], totalDays: 91, updateCount: 0, activeDays: 0, projectCount: 0, recentDays: [] };
  const { container } = render(<Heatmap pulse={pulse} ownerId="me" />);
  const grid = container.querySelector(".heat-grid")!;
  expect(grid.querySelectorAll(".heat-pad")).toHaveLength(4);
  expect(grid.querySelectorAll("button.heat-cell")).toHaveLength(91);
  expect([...container.querySelectorAll(".weekdays > span")].map((s) => s.textContent)).toEqual(["", "Mon", "", "Wed", "", "Fri", ""]);
  expect([...grid.querySelectorAll<HTMLElement>(".heat-month")].map((m) => [m.textContent, m.style.gridColumn])).toEqual([["Aug", "1"], ["Sep", "6"], ["Oct", "10"]]);
  // Wednesday 28 October is the last cell: row 4 (Sunday-first) of the final column.
  const index = 4 + 90;
  expect(index % 7).toBe(3);
});
