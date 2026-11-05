import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ServicesContext } from "@/hooks/use-services";
import type { Services } from "@/services";
import type { ResponseItem, ResponseParams } from "@/services/recruiting/recruiting.service";
import { responseFiltersSchema } from "@/lib/validation/recruiting";
import { ApplicantSearchField, type ApplicantPick } from "../applicant-search-field";

vi.mock("next/navigation", () => ({ usePathname: () => "/recruiter/applications", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));

const JOB_A = "11111111-1111-4111-8111-111111111111";
const JOB_B = "22222222-2222-4222-8222-222222222222";

function item(id: string, candidate: string, job: string, name: string, designation: string, jobTitle: string): ResponseItem {
  return {
    application: { id, job, candidate, createdAt: "2026-10-01T10:00:00.000Z", note: "", portfolio: false, status: "New", recruiterNote: "", followUp: "", viewedAt: "" },
    profile: {
      id: candidate, name, headline: designation, summary: "", skills: [], email: "", location: "", locality: "", years: 3, expectedSalary: null, notice: null, joining: null,
      industry: "", designation, department: "", educationText: "", currentRole: "", previousRole: "", preferredLocations: "", phone: "",
    },
    jobTitle,
    fit: { score: 50, matched: [] },
    distance: null,
  };
}

const all = [
  item("a1", "c1", JOB_A, "Asha Rao", "Frontend Engineer", "Senior Engineer"),
  item("a2", "c2", JOB_A, "Bimal Sen", "Product Designer", "Senior Engineer"),
  item("a3", "c3", JOB_B, "Chitra Iyer", "UI/UX Designer", "Designer"),
  // Same person applied twice: must appear once in the list.
  item("a4", "c1", JOB_B, "Asha Rao", "Frontend Engineer", "Designer"),
];

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((c) => c.clear());
});

function mount(jobId: string, initialPick: ApplicantPick | null = null) {
  const listResponses = vi.fn(async (params: ResponseParams) => {
    const items = all.filter((i) => (!params.job || i.application.job === params.job) && (!params.q || i.profile.name.toLowerCase().includes(params.q.toLowerCase())));
    return { items, total: items.length, page: 1, pages: 1, pageSize: 40, stage: "all", tabCounts: {}, jobs: [], sort: "newest" };
  });
  const services = { recruiting: { listResponses }, auth: { inspect: vi.fn(async () => null), me: vi.fn(async () => null) } } as unknown as Services;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  const picks: (ApplicantPick | null)[] = [];
  function Host() {
    const [pick, setPick] = useState<ApplicantPick | null>(initialPick);
    return (
      <form data-testid="form">
        <ApplicantSearchField jobId={jobId} pick={pick} onPickChange={(next) => { picks.push(next); setPick(next); }} />
      </form>
    );
  }
  render(
    <QueryClientProvider client={client}>
      <ServicesContext.Provider value={services}>
        <Host />
      </ServicesContext.Provider>
    </QueryClientProvider>,
  );
  return { listResponses, picks };
}

const hidden = () => document.querySelector('input[name="applicant"]') as HTMLInputElement;

describe("ApplicantSearchField", () => {
  it("lists only the selected job's applicants as avatar cards and narrows them by the typed term", async () => {
    const { listResponses } = mount(JOB_A);
    const input = screen.getByRole("combobox", { name: "Search applicants" });
    fireEvent.focus(input);
    const list = await screen.findByRole("listbox", { name: "Applicants" });
    await waitFor(() => expect(within(list).getAllByRole("option")).toHaveLength(2));
    expect(listResponses).toHaveBeenLastCalledWith(expect.objectContaining({ job: JOB_A, stage: "all", size: "40" }), expect.anything());
    expect(within(list).queryByText("Chitra Iyer")).toBeNull();
    const option = within(list).getByRole("option", { name: /Bimal Sen/ });
    expect(option.querySelector(".avatar")).not.toBeNull();
    expect(within(option).getByText("Product Designer")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "bim" } });
    await waitFor(() => expect(listResponses).toHaveBeenLastCalledWith(expect.objectContaining({ job: JOB_A, q: "bim" }), expect.anything()));
    await waitFor(() => expect(within(screen.getByRole("listbox", { name: "Applicants" })).getAllByRole("option")).toHaveLength(1));
  });

  it("choosing a card fills the hidden applicant id, shows the pick and clears it again", async () => {
    const { picks } = mount(JOB_A);
    const input = screen.getByRole("combobox", { name: "Search applicants" });
    fireEvent.focus(input);
    const option = await screen.findByRole("option", { name: /Asha Rao/ });
    fireEvent.click(option);
    expect(hidden().value).toBe("c1");
    expect(input).toHaveValue("Asha Rao");
    expect(picks.at(-1)).toEqual({ id: "c1", name: "Asha Rao" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByText(/Showing only/)).toBeNull();

    // Clearing the field (native search clear or deleting the text) drops the pick.
    fireEvent.change(input, { target: { value: "" } });
    expect(hidden().value).toBe("");
    expect(input).toHaveValue("");
    expect(picks.at(-1)).toBeNull();
  });

  it("typing after a pick drops the pick so the text becomes a plain search", async () => {
    mount(JOB_A, { id: "c1", name: "Asha Rao" });
    const input = screen.getByRole("combobox", { name: "Search applicants" });
    expect(hidden().value).toBe("c1");
    fireEvent.change(input, { target: { value: "Ash" } });
    expect(hidden().value).toBe("");
    expect(input).toHaveValue("Ash");
  });

  it("supports arrow keys + Enter without submitting the form, and lists every job's applicants once when no job is chosen", async () => {
    const submit = vi.fn((e: Event) => e.preventDefault());
    mount("");
    document.querySelector("form")!.addEventListener("submit", submit);
    const input = screen.getByRole("combobox", { name: "Search applicants" });
    fireEvent.focus(input);
    const list = await screen.findByRole("listbox", { name: "Applicants" });
    await waitFor(() => expect(within(list).getAllByRole("option")).toHaveLength(3));
    expect(within(list).getByRole("option", { name: /Chitra Iyer/ })).toHaveTextContent("UI/UX Designer · Designer");
    await act(async () => {
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowDown" });
    });
    expect(input).toHaveAttribute("aria-activedescendant", expect.stringMatching(/-option-1$/));
    fireEvent.keyDown(input, { key: "Enter" });
    expect(hidden().value).toBe("c2");
    expect(submit).not.toHaveBeenCalled();
  });
});

describe("responseFiltersSchema applicant", () => {
  it("accepts a candidate uuid and rejects anything else", () => {
    expect(responseFiltersSchema.safeParse({ applicant: "33333333-3333-4333-8333-333333333333" }).success).toBe(true);
    const bad = responseFiltersSchema.safeParse({ applicant: "asha" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0].message).toBe("Choose an applicant from the list.");
  });
});
