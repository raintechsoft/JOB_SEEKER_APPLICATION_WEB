import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatchBadge, type MatchBadgeData } from "@/components/jobs/match-badge";

const badge: MatchBadgeData = {
  level: "good", label: "Good match", summary: "4 of 5 skills",
  matchedSkills: ["php", "laravel", "go", "docker"], requiredSkills: 5, missingSkills: ["kubernetes"], missingEssential: ["kubernetes"],
  experience: "fit", reasons: ["4 of 5 skills", "Missing essential: kubernetes", "Experience fits"],
  job: { id: "00000000-0000-4000-8000-000000000001", title: "Backend Engineer" },
};

describe("MatchBadge", () => {
  it("shows the level and the skill summary, and explains itself on request", async () => {
    const { container } = render(<MatchBadge match={badge} />);
    expect(container.querySelector(".match-badge.match-good")).not.toBeNull();
    expect(screen.getByText("Good match")).toBeInTheDocument();
    expect(container.textContent).toContain("Good match · 4 of 5 skills");
    expect(container.textContent).not.toContain("Backend Engineer");
    await userEvent.click(screen.getByRole("button", { name: "Why good match" }));
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toContain("Missing essential: kubernetes");
    expect(tip.textContent).toContain("Matching: php, laravel, go, docker");
    expect(tip.textContent).toContain("Missing: kubernetes");
  });

  it("names the role for recruiters and renders nothing without a match", () => {
    const { container, rerender } = render(<MatchBadge match={badge} showJob />);
    expect(container.textContent).toContain("Good match for Backend Engineer · 4 of 5 skills");
    rerender(<MatchBadge match={null} />);
    expect(container.innerHTML).toBe("");
  });
});
