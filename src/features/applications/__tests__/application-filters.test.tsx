import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApplicationFilters } from "@/features/applications/application-filters";
import type { ApplicationCounts } from "@/services/applications/applications.service";

const counts: ApplicationCounts = {
  all: 4, inProgress: 2, other: 1,
  statuses: { Applied: 1, "In review": 0, Shortlisted: 1, Interview: 1, Offer: 0, Hired: 0, Rejected: 1, Withdrawn: 0 },
};

describe("ApplicationFilters", () => {
  it("shows counts on the pills and reports the chosen filter", async () => {
    const onSelect = vi.fn();
    render(<ApplicationFilters counts={counts} value="" onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: "Filter applications" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "All, 4 applications" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("group", { name: "Application status" })).getByRole("button", { name: "Interview" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Interview, 1 application" }));
    expect(onSelect).toHaveBeenCalledWith("Interview");
  });
});
