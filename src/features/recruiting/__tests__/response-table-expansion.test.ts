import { describe, expect, it } from "vitest";
import {
  isResponseTableCellExpanded,
  isResponseTableColumnExpanded,
  toggleResponseTableExpansion,
  type ResponseTableExpansionState,
} from "../response-table-expansion";
import { RESPONSE_TABLE_CONTENT_EXPANDABLE } from "../response-table-types";

const none: ResponseTableExpansionState = { type: "none" };

describe("toggleResponseTableExpansion", () => {
  it("expands, collapses and replaces a single cell", () => {
    const first = toggleResponseTableExpansion(none, { type: "toggle-cell", rowId: "r1", columnId: "designation" });
    expect(first).toEqual({ type: "cell", rowId: "r1", columnId: "designation" });
    expect(toggleResponseTableExpansion(first, { type: "toggle-cell", rowId: "r1", columnId: "designation" })).toEqual(none);
    expect(toggleResponseTableExpansion(first, { type: "toggle-cell", rowId: "r2", columnId: "skills" })).toEqual({
      type: "cell",
      rowId: "r2",
      columnId: "skills",
    });
  });

  it("expands, collapses and replaces a single column", () => {
    const column = toggleResponseTableExpansion(none, { type: "toggle-column", columnId: "skills" });
    expect(column).toEqual({ type: "column", columnId: "skills" });
    expect(toggleResponseTableExpansion(column, { type: "toggle-column", columnId: "skills" })).toEqual(none);
    expect(toggleResponseTableExpansion(column, { type: "toggle-column", columnId: "location" })).toEqual({ type: "column", columnId: "location" });
  });

  it("swaps between cell and column modes so only one expansion is active", () => {
    const cell: ResponseTableExpansionState = { type: "cell", rowId: "r1", columnId: "designation" };
    const column = toggleResponseTableExpansion(cell, { type: "toggle-column", columnId: "designation" });
    expect(column).toEqual({ type: "column", columnId: "designation" });
    expect(toggleResponseTableExpansion(column, { type: "toggle-cell", rowId: "r3", columnId: "education" })).toEqual({
      type: "cell",
      rowId: "r3",
      columnId: "education",
    });
  });

  it("ignores excluded columns (select, status, actions)", () => {
    for (const columnId of ["select", "status", "actions"] as const) {
      expect(RESPONSE_TABLE_CONTENT_EXPANDABLE[columnId]).toBe(false);
      expect(toggleResponseTableExpansion(none, { type: "toggle-cell", rowId: "r1", columnId })).toEqual(none);
      expect(toggleResponseTableExpansion(none, { type: "toggle-column", columnId })).toEqual(none);
    }
  });

  it("reports expanded cells for both cell and column modes", () => {
    const cell: ResponseTableExpansionState = { type: "cell", rowId: "r1", columnId: "designation" };
    expect(isResponseTableCellExpanded(cell, "r1", "designation")).toBe(true);
    expect(isResponseTableCellExpanded(cell, "r2", "designation")).toBe(false);
    expect(isResponseTableColumnExpanded(cell, "designation")).toBe(false);
    const column: ResponseTableExpansionState = { type: "column", columnId: "designation" };
    expect(isResponseTableCellExpanded(column, "r1", "designation")).toBe(true);
    expect(isResponseTableCellExpanded(column, "r9", "designation")).toBe(true);
    expect(isResponseTableCellExpanded(column, "r9", "skills")).toBe(false);
    expect(isResponseTableColumnExpanded(column, "designation")).toBe(true);
    expect(toggleResponseTableExpansion(column, { type: "clear" })).toEqual(none);
  });
});

describe("row expansion", () => {
  it("toggles a whole row and replaces cell/column modes", () => {
    const row = toggleResponseTableExpansion(none, { type: "toggle-row", rowId: "r1" });
    expect(row).toEqual({ type: "row", rowId: "r1" });
    expect(toggleResponseTableExpansion(row, { type: "toggle-row", rowId: "r1" })).toEqual(none);
    expect(toggleResponseTableExpansion(row, { type: "toggle-row", rowId: "r2" })).toEqual({ type: "row", rowId: "r2" });
    expect(toggleResponseTableExpansion({ type: "column", columnId: "skills" }, { type: "toggle-row", rowId: "r1" })).toEqual(row);
    expect(toggleResponseTableExpansion(row, { type: "toggle-cell", rowId: "r1", columnId: "skills" })).toEqual({ type: "cell", rowId: "r1", columnId: "skills" });
    // Every expandable column in the row reads as expanded; excluded columns never do.
    expect(isResponseTableCellExpanded(row, "r1", "skills")).toBe(true);
    expect(isResponseTableCellExpanded(row, "r1", "name")).toBe(true);
    expect(isResponseTableCellExpanded(row, "r1", "status")).toBe(false);
    expect(isResponseTableCellExpanded(row, "r1", "actions")).toBe(false);
    expect(isResponseTableCellExpanded(row, "r2", "skills")).toBe(false);
  });
});
