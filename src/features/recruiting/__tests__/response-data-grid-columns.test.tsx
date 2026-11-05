import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServicesContext } from "@/hooks/use-services";
import type { Services } from "@/services";
import type { ScreeningQuestion } from "@/types/domain";
import type { ResponseItem } from "@/services/recruiting/recruiting.service";
import { modal } from "@/stores/modal-store";
import { ResponseDataGrid, type ResponseGridActions } from "../response-data-grid";
import { normalizeResponseTablePrefs } from "../response-table-prefs";
import { defaultResponseTablePrefs, responseTableColumnLabel, responseTableQuestionColumnId } from "../response-table-types";

vi.mock("next/navigation", () => ({ usePathname: () => "/recruiter/applications/table", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => {
    void _prefetch;
    return <a href={String(href)} {...props}>{children}</a>;
  },
}));

const Q1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const Q2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const questions: ScreeningQuestion[] = [
  { id: Q1, text: "How many years have you worked with React in production?", type: "number", required: true, ideal: "" },
  { id: Q2, text: "Are you willing to relocate to Bengaluru?", type: "yesno", required: true, ideal: "" },
];

function item(id: string, name: string, answers: { id: string; question: string; answer: string }[], extra: Partial<ResponseItem> = {}): ResponseItem {
  return {
    application: {
      id,
      job: "job-1",
      candidate: "cand-" + id,
      createdAt: "2026-10-01T10:00:00.000Z",
      note: "I led the migration of a legacy monolith to a React front end.",
      portfolio: false,
      status: "New",
      recruiterNote: "",
      followUp: "",
      viewedAt: "",
      screeningAnswers: answers,
    },
    profile: {
      id: "cand-" + id,
      name,
      headline: "Frontend Engineer",
      summary: "",
      skills: ["React"],
      email: name.toLowerCase().replace(/\s+/g, ".") + "@example.test",
      location: "Pune",
      locality: "Baner",
      years: 5,
      expectedSalary: null,
      notice: 30,
      joining: 45,
      industry: "",
      designation: "",
      department: "",
      educationText: "B.Tech Computer Science · IIT Madras",
      currentRole: "Frontend Engineer",
      previousRole: "",
      preferredLocations: "Pune, Bengaluru",
      phone: "+919876543210",
    },
    jobTitle: "Senior Engineer",
    fit: { score: 60, matched: [] },
    distance: null,
    ...extra,
  };
}

const items = [
  item("a1", "Asha Rao", [
    { id: Q1, question: questions[0].text, answer: "4" },
    { id: Q2, question: questions[1].text, answer: "yes" },
  ], {
    sharing: {
      schemaVersion: 2,
      expectedCompensation: null,
      verification: { email: true, phone: true },
      attachments: [{ id: "file-1", kind: "resume", name: "asha-rao-resume.pdf", mime: "application/pdf", size: 1024, downloadPath: "/files/file-1" }],
      portfolio: null,
    } as unknown as ResponseItem["sharing"],
  }),
  item("a2", "Bimal Sen", [{ id: Q1, question: questions[0].text, answer: "2" }]),
];

const clients: QueryClient[] = [];
function mount(props: Partial<Parameters<typeof ResponseDataGrid>[0]> = {}) {
  const actions: ResponseGridActions = { markViewed: vi.fn(), contact: vi.fn(), status: vi.fn() };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  const services = { auth: { inspect: vi.fn(async () => null), me: vi.fn(async () => null) }, messaging: { start: vi.fn() }, talent: { getCandidate: vi.fn() } } as unknown as Services;
  return render(
    <QueryClientProvider client={client}>
      <ServicesContext.Provider value={services}>
        <ResponseDataGrid items={items} selection={[]} allChecked={false} onSelect={vi.fn()} onSelectAll={vi.fn()} actions={actions} sort="newest" onSortChange={vi.fn()} filterParams={{}} onFilterPatch={vi.fn()} {...props} />
      </ServicesContext.Provider>
    </QueryClientProvider>,
  );
}

const headerTexts = () => [...document.querySelectorAll("thead th .response-grid-header-label")].map((el) => el.textContent?.replace(/\s*[↑↓]\s*$/, "").trim());
const rowFor = (id: string) => document.querySelector(`tr[data-response-id="${id}"]`) as HTMLTableRowElement;
const cellByHeader = (rowId: string, header: string) => {
  const index = [...document.querySelectorAll("thead th")].findIndex((th) => th.querySelector(".response-grid-header-label")?.textContent?.trim().startsWith(header));
  return rowFor(rowId).querySelectorAll("td")[index] as HTMLTableCellElement; // thead and tbody both start with the row-number gutter
};

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((c) => c.clear());
  vi.restoreAllMocks();
});

describe("ResponseDataGrid submission columns", () => {
  it("shows the applicant's own submission data in the new fixed columns", () => {
    mount();
    const headers = headerTexts();
    for (const label of ["Can join in", "Preferred locations", "Phone", "Email", "Introduction", "Screening answers", "Resume"]) expect(headers).toContain(label);
    expect(cellByHeader("a1", "Can join in")).toHaveTextContent("45 days");
    expect(cellByHeader("a1", "Preferred locations")).toHaveTextContent("Pune, Bengaluru");
    expect(cellByHeader("a1", "Phone")).toHaveTextContent("+919876543210");
    expect(cellByHeader("a1", "Email")).toHaveTextContent("asha.rao@example.test");
    expect(cellByHeader("a1", "Introduction")).toHaveTextContent("I led the migration of a legacy monolith to a React front end.");
    expect(cellByHeader("a1", "Education")).toHaveTextContent("B.Tech Computer Science · IIT Madras");
    // No job filter: one summary column with "question: answer" pairs.
    expect(cellByHeader("a1", "Screening answers")).toHaveTextContent("How many years have you worked with React in production?: 4 · Are you willing to relocate to Bengaluru?: Yes");
    expect(cellByHeader("a2", "Screening answers")).toHaveTextContent("How many years have you worked with React in production?: 2");
  });

  it("opens the submitted resume in the existing document viewer, and shows a dash without one", () => {
    const show = vi.spyOn(modal, "show").mockImplementation(() => {});
    mount();
    const button = within(cellByHeader("a1", "Resume")).getByRole("button", { name: "View submitted resume: asha-rao-resume.pdf" });
    fireEvent.click(button);
    expect(show).toHaveBeenCalledTimes(1);
    expect(show.mock.calls[0][0]).toBe("Resume · Asha Rao");
    expect(cellByHeader("a2", "Resume")).toHaveTextContent("—");
    expect(within(cellByHeader("a2", "Resume")).queryByRole("button")).toBeNull();
  });

  it("adds one column per screening question of the filtered job, headed by the question text", () => {
    mount({ questions });
    const headers = headerTexts();
    expect(headers).toContain(questions[0].text);
    expect(headers).toContain(questions[1].text);
    expect(headers).not.toContain("Screening answers");
    expect(cellByHeader("a1", "How many years")).toHaveTextContent("4");
    expect(cellByHeader("a1", "Are you willing")).toHaveTextContent("Yes");
    expect(cellByHeader("a2", "How many years")).toHaveTextContent("2");
    expect(cellByHeader("a2", "Are you willing")).toHaveTextContent("—");
    // Question columns sit before Actions and support content expansion like other text columns.
    expect(headers.indexOf(questions[1].text)).toBeLessThan(headers.indexOf("Actions"));
    const cell = cellByHeader("a1", "How many years");
    expect(cell).toHaveClass("is-content-expandable");
    fireEvent.doubleClick(cell);
    expect(cell).toHaveClass("is-cell-expanded");
    // Column menu lists the question under its text so it can be hidden like any other column.
    fireEvent.click(screen.getByRole("button", { name: "Table options" }));
    expect(screen.getByRole("checkbox", { name: questions[1].text })).toBeChecked();
  });

  it("keeps question columns out of the sheet when the job changes and labels unknown ids safely", () => {
    expect(responseTableColumnLabel(responseTableQuestionColumnId(Q1), questions)).toBe(questions[0].text);
    expect(responseTableColumnLabel(responseTableQuestionColumnId("missing"), questions)).toBe("Screening question");
    expect(responseTableColumnLabel("phone")).toBe("Phone");
  });
});

describe("response table prefs with question columns", () => {
  it("keeps q: column ids (order, visibility, clamped width) and drops unknown ids", () => {
    const qid = responseTableQuestionColumnId(Q1);
    const prefs = normalizeResponseTablePrefs({
      ...defaultResponseTablePrefs(),
      columnOrder: ["select", "name", qid, "phone", "bogus", "actions"],
      columnVisibility: { [qid]: false, bogus: false },
      columnWidths: { [qid]: 9999, bogus: 10 },
    });
    expect(prefs.columnOrder.indexOf(qid)).toBe(2);
    expect(prefs.columnOrder).not.toContain("bogus");
    expect(prefs.columnVisibility[qid]).toBe(false);
    expect(prefs.columnVisibility.bogus).toBeUndefined();
    expect(prefs.columnWidths[qid]).toBe(420);
    expect(prefs.columnWidths.bogus).toBeUndefined();
  });
});
