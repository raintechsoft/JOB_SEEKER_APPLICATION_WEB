import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ServicesContext } from "@/hooks/use-services";
import type { Services } from "@/services";
import type { ResponseItem } from "@/services/recruiting/recruiting.service";
import { ResponseDataGrid, type ResponseGridActions } from "../response-data-grid";

const nav = vi.hoisted(() => ({ path: "/recruiter/responses", push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.path,
  useRouter: () => nav,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => {
    void _prefetch;
    return (
      <a href={String(href)} {...props}>
        {children}
      </a>
    );
  },
}));

const LONG_DESIGNATION = "Senior Full-Stack Engineer · React · Laravel · PostgreSQL · Redis · TypeScript";

function item(id: string, name: string, designation: string, skills: string[]): ResponseItem {
  return {
    application: {
      id,
      job: "job-1",
      candidate: "cand-" + id,
      createdAt: "2026-10-01T10:00:00.000Z",
      note: "",
      portfolio: false,
      status: "New",
      recruiterNote: "",
      followUp: "",
      viewedAt: "",
    },
    profile: {
      id: "cand-" + id,
      name,
      headline: designation,
      summary: "",
      skills,
      email: name.toLowerCase().replace(/\s+/g, ".") + "@example.test",
      location: "Bengaluru",
      locality: "Indiranagar",
      years: 6,
      expectedSalary: 24,
      notice: 30,
      joining: null,
      industry: "Software",
      designation,
      department: "Engineering",
      educationText: "B.Tech Computer Science · IIT Madras",
      currentRole: designation,
      previousRole: "",
      preferredLocations: "",
      phone: "",
    },
    jobTitle: "Senior Full-Stack Engineer",
    fit: { score: 80, matched: [] },
    distance: null,
  };
}

const items = [
  item("a1", "Asha Rao", LONG_DESIGNATION, ["React", "Laravel", "PostgreSQL", "Redis", "TypeScript"]),
  item("a2", "Bimal Sen", "Product Designer", ["Figma"]),
  item("a3", "Chitra Iyer", "UI/UX Designer · Design Systems · Figma · Prototyping", ["Figma", "Design Systems"]),
];

const clients: QueryClient[] = [];
function services() {
  return {
    auth: { inspect: vi.fn(async () => null), me: vi.fn(async () => null) },
    messaging: { start: vi.fn() },
    talent: { getCandidate: vi.fn() },
  } as unknown as Services;
}

function mount(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <ServicesContext.Provider value={services()}>{ui}</ServicesContext.Provider>
    </QueryClientProvider>,
  );
}

function grid(overrides: Partial<Parameters<typeof ResponseDataGrid>[0]> = {}) {
  const actions: ResponseGridActions = { markViewed: vi.fn(), contact: vi.fn(), status: vi.fn() };
  const props: Parameters<typeof ResponseDataGrid>[0] = {
    items,
    selection: [],
    allChecked: false,
    onSelect: vi.fn(),
    onSelectAll: vi.fn(),
    actions,
    sort: "newest",
    onSortChange: vi.fn(),
    filterParams: {},
    onFilterPatch: vi.fn(),
    ...overrides,
  };
  return { props, actions, ...mount(<ResponseDataGrid {...props} />) };
}

function rowFor(id: string) {
  const row = document.querySelector(`tr[data-response-id="${id}"]`);
  if (!row) throw new Error("row " + id + " not rendered");
  return row as HTMLTableRowElement;
}

function cell(rowId: string, text: string | RegExp) {
  return within(rowFor(rowId)).getByText(text).closest("td") as HTMLTableCellElement;
}

function header(label: string) {
  return screen.getByText(label, { selector: ".response-grid-header-label *, .response-grid-header-label" }).closest("th") as HTMLTableCellElement;
}

function headerLabel(label: string) {
  return header(label).querySelector(".response-grid-header-label") as HTMLElement;
}

beforeEach(() => {
  window.localStorage.clear();
  // jsdom has no 2D canvas; auto-fit falls back to its character estimate.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
});

describe("ResponseDataGrid content expansion", () => {
  it("double-click expands an eligible cell in place, highlights it and toggles back", () => {
    grid();
    const designation = cell("a1", LONG_DESIGNATION);
    expect(designation).toHaveAttribute("aria-expanded", "false");
    expect(designation).toHaveAttribute("title", "Double-click to expand");
    expect(designation).not.toHaveClass("is-content-expanded");

    fireEvent.doubleClick(designation);
    expect(designation).toHaveClass("is-cell-expanded");
    expect(designation).toHaveClass("is-content-expanded");
    expect(designation).toHaveAttribute("aria-expanded", "true");
    expect(designation).toHaveAttribute("data-expanded", "cell");
    expect(designation).not.toHaveAttribute("title");
    // Full text stays inside the same cell: no modal, no popover.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(designation).getByText(LONG_DESIGNATION)).toBeInTheDocument();
    // Other cells in the row and column are untouched.
    expect(cell("a1", /B\.Tech/)).not.toHaveClass("is-content-expanded");
    expect(cell("a2", "Product Designer")).not.toHaveClass("is-content-expanded");

    fireEvent.doubleClick(designation);
    expect(designation).not.toHaveClass("is-content-expanded");
    expect(designation).toHaveAttribute("aria-expanded", "false");
  });

  it("double-clicking another cell replaces the previous expansion (single active selection)", () => {
    grid();
    const first = cell("a1", LONG_DESIGNATION);
    const second = cell("a3", /UI\/UX Designer/);
    fireEvent.doubleClick(first);
    fireEvent.doubleClick(second);
    expect(first).not.toHaveClass("is-content-expanded");
    expect(second).toHaveClass("is-cell-expanded");
    expect(document.querySelectorAll("td.is-content-expanded")).toHaveLength(1);
  });

  it("double-click on the header label expands the whole column, including the header, and toggles back", () => {
    grid();
    const th = header("Designation");
    const label = headerLabel("Designation");
    expect(th.querySelector(".response-grid-header-cell")).toHaveAttribute("title", "Double-click to expand column content");

    fireEvent.doubleClick(label);
    expect(th).toHaveClass("is-column-expanded");
    expect(th).toHaveAttribute("data-expanded", "column");
    for (const id of ["a1", "a2", "a3"]) {
      const td = rowFor(id).querySelector('td[data-expanded="column"]') as HTMLTableCellElement;
      expect(td).not.toBeNull();
      expect(td).toHaveClass("is-column-expanded");
      expect(td).toHaveClass("is-content-expanded");
      expect(td).not.toHaveClass("is-cell-expanded");
    }
    expect(document.querySelectorAll("td.is-content-expanded")).toHaveLength(3);
    // Column width is a layout concern of the table state, not the expansion: inline width is unchanged.
    expect(th.style.width).toBe("140px");
    expect(cell("a1", LONG_DESIGNATION).style.width).toBe("140px");

    fireEvent.doubleClick(label);
    expect(th).not.toHaveClass("is-column-expanded");
    expect(document.querySelectorAll("td.is-content-expanded")).toHaveLength(0);
  });

  it("switching between column and cell expansion keeps only one active target", () => {
    grid();
    fireEvent.doubleClick(headerLabel("Designation"));
    expect(document.querySelectorAll("td.is-column-expanded")).toHaveLength(3);
    fireEvent.doubleClick(headerLabel("Skills"));
    expect(header("Designation")).not.toHaveClass("is-column-expanded");
    expect(header("Skills")).toHaveClass("is-column-expanded");
    expect(document.querySelectorAll("td.is-column-expanded")).toHaveLength(3);

    const designation = cell("a2", "Product Designer");
    fireEvent.doubleClick(designation);
    expect(header("Skills")).not.toHaveClass("is-column-expanded");
    expect(document.querySelectorAll("td.is-column-expanded")).toHaveLength(0);
    expect(designation).toHaveClass("is-cell-expanded");

    fireEvent.doubleClick(headerLabel("Designation"));
    expect(designation).toHaveClass("is-column-expanded");
    expect(designation).not.toHaveClass("is-cell-expanded");
  });

  it("never expands status, actions or selection cells and keeps their controls working", () => {
    const { props, actions } = grid();
    const row = rowFor("a1");
    const checkbox = within(row).getByRole("checkbox", { name: "Select Asha Rao" });
    const status = within(row).getByRole("combobox", { name: "Status for Asha Rao" });
    const selectCell = checkbox.closest("td") as HTMLTableCellElement;
    const statusCell = status.closest("td") as HTMLTableCellElement;
    const actionsCell = row.querySelector("td.response-table-actions-cell") as HTMLTableCellElement;

    for (const td of [selectCell, statusCell, actionsCell]) {
      expect(td).not.toHaveClass("is-content-expandable");
      expect(td).not.toHaveAttribute("tabindex");
      expect(td).not.toHaveAttribute("aria-expanded");
      fireEvent.doubleClick(td);
      expect(td).not.toHaveClass("is-content-expanded");
    }
    fireEvent.doubleClick(checkbox);
    fireEvent.doubleClick(status);
    expect(document.querySelectorAll(".is-content-expanded")).toHaveLength(0);

    fireEvent.click(checkbox);
    expect(props.onSelect).toHaveBeenCalledWith("a1", true);
    fireEvent.change(status, { target: { value: "Shortlisted" } });
    expect(actions.status).toHaveBeenCalledWith(["a1"], "Shortlisted");
    // The Status header has no expansion affordance either.
    expect(header("Status").querySelector(".response-grid-header-cell.is-content-expandable")).toBeNull();
    fireEvent.doubleClick(headerLabel("Status"));
    expect(document.querySelectorAll(".is-content-expanded")).toHaveLength(0);
  });

  it("supports keyboard toggle on a focused eligible cell without stealing keys from controls", () => {
    const { props } = grid();
    const designation = cell("a1", LONG_DESIGNATION);
    expect(designation).toHaveAttribute("tabindex", "0");
    designation.focus();
    fireEvent.keyDown(designation, { key: "Enter" });
    expect(designation).toHaveClass("is-cell-expanded");
    fireEvent.keyDown(designation, { key: " " });
    expect(designation).not.toHaveClass("is-cell-expanded");

    const checkbox = within(rowFor("a1")).getByRole("checkbox", { name: "Select Asha Rao" });
    fireEvent.keyDown(checkbox, { key: "Enter" });
    fireEvent.keyDown(checkbox, { key: " " });
    expect(document.querySelectorAll(".is-content-expanded")).toHaveLength(0);
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it("exposes column expansion from the header menu for keyboard users", () => {
    grid();
    fireEvent.click(screen.getByRole("button", { name: "Column options for Skills" }));
    const menu = screen.getByRole("menu");
    const toggle = within(menu).getByRole("menuitemcheckbox", { name: "Expand column content" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(header("Skills")).toHaveClass("is-column-expanded");
    fireEvent.click(screen.getByRole("button", { name: "Column options for Skills" }));
    expect(within(screen.getByRole("menu")).getByRole("menuitemcheckbox", { name: "Collapse column content" })).toHaveAttribute("aria-checked", "true");
    // The Status menu offers no expansion entry.
    fireEvent.pointerDown(document.body);
    fireEvent.click(screen.getByRole("button", { name: "Column options for Status" }));
    expect(within(screen.getByRole("menu")).queryByRole("menuitemcheckbox")).toBeNull();
  });

  it("clears a cell expansion when its row leaves the page and keeps column expansion across row changes", () => {
    const { props, rerender } = grid();
    const wrap = (next: Partial<typeof props>) => (
      <QueryClientProvider client={clients[clients.length - 1]}>
        <ServicesContext.Provider value={services()}>
          <ResponseDataGrid {...props} {...next} />
        </ServicesContext.Provider>
      </QueryClientProvider>
    );
    fireEvent.doubleClick(cell("a1", LONG_DESIGNATION));
    expect(document.querySelectorAll("td.is-cell-expanded")).toHaveLength(1);
    rerender(wrap({ items: items.slice(1) }));
    expect(document.querySelectorAll(".is-content-expanded")).toHaveLength(0);

    fireEvent.doubleClick(headerLabel("Designation"));
    expect(document.querySelectorAll("td.is-column-expanded")).toHaveLength(2);
    rerender(wrap({ items }));
    expect(header("Designation")).toHaveClass("is-column-expanded");
    expect(document.querySelectorAll("td.is-column-expanded")).toHaveLength(3);
  });

  it("does not expand from the resize handle double-click", () => {
    grid();
    const th = header("Designation");
    const resizer = th.querySelector(".response-grid-resizer") as HTMLElement;
    fireEvent.doubleClick(resizer);
    expect(th).not.toHaveClass("is-column-expanded");
    expect(document.querySelectorAll(".is-content-expanded")).toHaveLength(0);
  });
});

describe("ResponseDataGrid row-number gutter", () => {
  it("numbers rows from the page offset and toggles the active row without touching checkbox selection", () => {
    const { props } = grid({ rowNumberStart: 11 });
    const first = screen.getByRole("button", { name: "Select row 11, Asha Rao" });
    const third = screen.getByRole("button", { name: "Select row 13, Chitra Iyer" });
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(first.closest("td")).toHaveClass("response-table-rownum");

    fireEvent.click(first);
    expect(rowFor("a1")).toHaveAttribute("data-active", "true");
    expect(first.closest("td")).toHaveClass("is-active");
    expect(screen.getByRole("button", { name: "Deselect row 11, Asha Rao" })).toHaveAttribute("aria-pressed", "true");
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(within(rowFor("a1")).getByRole("checkbox", { name: "Select Asha Rao" })).not.toBeChecked();

    fireEvent.click(third);
    expect(rowFor("a1")).not.toHaveAttribute("data-active");
    expect(rowFor("a3")).toHaveAttribute("data-active", "true");
    expect(document.querySelectorAll('tr[data-active="true"]')).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Deselect row 13, Chitra Iyer" }));
    expect(document.querySelectorAll('tr[data-active="true"]')).toHaveLength(0);
  });

  it("keeps the gutter sticky at the left edge and shifts pinned columns after it", () => {
    grid();
    const gutter = rowFor("a1").querySelector("td.response-table-rownum") as HTMLTableCellElement;
    expect(gutter.style.position).toBe("sticky");
    expect(gutter.style.left).toBe("0px");
    const selectCell = within(rowFor("a1")).getByRole("checkbox", { name: "Select Asha Rao" }).closest("td") as HTMLTableCellElement;
    expect(selectCell.style.left).toBe("44px");
    expect(screen.getByRole("columnheader", { name: "Row number" })).toBeInTheDocument();
  });

  it("clears the active row when it leaves the page", () => {
    const { props, rerender } = grid();
    fireEvent.click(screen.getByRole("button", { name: "Select row 1, Asha Rao" }));
    expect(rowFor("a1")).toHaveAttribute("data-active", "true");
    rerender(
      <QueryClientProvider client={clients[clients.length - 1]}>
        <ServicesContext.Provider value={services()}>
          <ResponseDataGrid {...props} items={items.slice(1)} />
        </ServicesContext.Provider>
      </QueryClientProvider>,
    );
    expect(document.querySelectorAll('tr[data-active="true"]')).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Select row 1, Bimal Sen" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("ResponseDataGrid row expansion from the gutter", () => {
  const rowNumberButton = (name: RegExp) => screen.getByRole("button", { name });

  it("double-click on the row number expands every eligible cell in that row and highlights it", () => {
    const { props } = grid();
    const button = rowNumberButton(/^Select row 1, Asha Rao/);
    expect(button).toHaveAttribute("aria-expanded", "false");
    // Browser sequence for a double-click: click(detail 1), click(detail 2), dblclick.
    fireEvent.click(button, { detail: 1 });
    fireEvent.click(button, { detail: 2 });
    fireEvent.doubleClick(button);

    const row = rowFor("a1");
    expect(row).toHaveAttribute("data-active", "true");
    const expanded = [...row.querySelectorAll("td.is-row-expanded")].filter((td) => !td.classList.contains("response-table-rownum"));
    // 15 expandable columns: every fixed column except select, status, resume and actions (screening summary included when no job is filtered).
    expect(expanded).toHaveLength(15);
    for (const td of expanded) expect(td).toHaveAttribute("data-expanded", "row");
    expect(row.querySelector("td.response-table-select")).not.toHaveClass("is-content-expanded");
    expect(row.querySelector("td.response-table-status-cell")).not.toHaveClass("is-content-expanded");
    expect(row.querySelector("td.response-table-actions-cell")).not.toHaveClass("is-content-expanded");
    expect(rowFor("a2").querySelectorAll(".is-content-expanded")).toHaveLength(0);
    expect(rowNumberButton(/^Deselect row 1, Asha Rao/)).toHaveAttribute("aria-expanded", "true");
    expect(props.onSelect).not.toHaveBeenCalled();

    // Double-click again collapses the content but keeps the row highlighted.
    fireEvent.click(button, { detail: 1 });
    fireEvent.click(button, { detail: 2 });
    fireEvent.doubleClick(button);
    expect(row.querySelectorAll(".is-content-expanded")).toHaveLength(0);
    expect(row).toHaveAttribute("data-active", "true");
  });

  it("row expansion replaces a column or cell expansion and vice versa", () => {
    grid();
    fireEvent.doubleClick(headerLabel("Skills"));
    expect(document.querySelectorAll("td.is-column-expanded")).toHaveLength(3);
    fireEvent.doubleClick(rowNumberButton(/^Select row 2, Bimal Sen/));
    expect(document.querySelectorAll("td.is-column-expanded")).toHaveLength(0);
    expect(rowFor("a2").querySelectorAll("td.is-row-expanded:not(.response-table-rownum)")).toHaveLength(15);
    fireEvent.doubleClick(cell("a3", /UI\/UX Designer/));
    expect(document.querySelectorAll("td.is-row-expanded")).toHaveLength(0);
    expect(document.querySelectorAll("td.is-cell-expanded")).toHaveLength(1);
  });

  it("single clicks on the row number still toggle the highlight on and off", () => {
    grid();
    const button = rowNumberButton(/^Select row 1, Asha Rao/);
    fireEvent.click(button, { detail: 1 });
    expect(rowFor("a1")).toHaveAttribute("data-active", "true");
    fireEvent.click(button, { detail: 1 });
    expect(rowFor("a1")).not.toHaveAttribute("data-active");
    expect(document.querySelectorAll(".is-content-expanded")).toHaveLength(0);
  });
});

describe("ResponseDataGrid header double-click target", () => {
  it("expands from anywhere on the header cell, but not from the column menu button", () => {
    grid();
    const th = header("Skills");
    const headerCell = th.querySelector(".response-grid-header-cell") as HTMLElement;
    expect(headerCell).toHaveClass("is-content-expandable");
    // Empty padding area of the header cell (not the label text).
    fireEvent.doubleClick(headerCell);
    expect(th).toHaveClass("is-column-expanded");
    expect(headerCell).toHaveAttribute("title", "Double-click to collapse column content");
    fireEvent.doubleClick(headerCell);
    expect(th).not.toHaveClass("is-column-expanded");

    fireEvent.doubleClick(screen.getByRole("button", { name: "Column options for Skills" }));
    expect(th).not.toHaveClass("is-column-expanded");
    expect(document.querySelectorAll(".is-content-expanded")).toHaveLength(0);
  });
});
