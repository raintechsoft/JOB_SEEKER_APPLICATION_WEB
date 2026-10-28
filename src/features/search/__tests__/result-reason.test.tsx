import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { SearchResultCopy } from "@/features/search/suggestion-row";
import type { SearchResult } from "@/services/search/search.service";

const company: SearchResult = { id: "00000000-0000-4000-8000-000000000001", kind: "company", title: "Nimbus Labs", subtitle: "Finance", slug: "nimbus", picture: "", recruiter: false, industry: "Finance" };

describe("search result reason", () => {
  it("shows why a result is shown, and nothing extra without a reason", () => {
    const { container, rerender } = render(<SearchResultCopy result={{ ...company, reason: "Hiring for React · You follow" }} query="react" detailed={false} />);
    expect(container.querySelector(".search-result-reason")?.textContent).toBe("Hiring for React · You follow");
    rerender(<SearchResultCopy result={company} query="react" detailed={false} />);
    expect(container.querySelector(".search-result-reason")).toBeNull();
  });
});
