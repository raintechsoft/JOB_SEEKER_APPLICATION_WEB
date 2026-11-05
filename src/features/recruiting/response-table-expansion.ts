import { isResponseTableContentExpandable, type ResponseTableAnyColumnId as ResponseTableColumnId } from "./response-table-types";

export type ResponseTableExpansionState =
  | { type: "none" }
  | { type: "cell"; rowId: string; columnId: ResponseTableColumnId }
  | { type: "column"; columnId: ResponseTableColumnId }
  /** Every expandable cell in one row (row-number gutter double-click). */
  | { type: "row"; rowId: string };

export type ResponseTableExpansionAction =
  | { type: "toggle-cell"; rowId: string; columnId: ResponseTableColumnId }
  | { type: "toggle-column"; columnId: ResponseTableColumnId }
  | { type: "toggle-row"; rowId: string }
  | { type: "clear" };

/** Pure toggle for cell/column content expansion. Only one expansion is active at a time. */
export function toggleResponseTableExpansion(
  state: ResponseTableExpansionState,
  action: ResponseTableExpansionAction,
): ResponseTableExpansionState {
  if (action.type === "clear") return { type: "none" };

  if (action.type === "toggle-cell") {
    if (!isResponseTableContentExpandable(action.columnId)) return state;
    if (state.type === "cell" && state.rowId === action.rowId && state.columnId === action.columnId) {
      return { type: "none" };
    }
    return { type: "cell", rowId: action.rowId, columnId: action.columnId };
  }

  if (action.type === "toggle-row") {
    if (state.type === "row" && state.rowId === action.rowId) return { type: "none" };
    return { type: "row", rowId: action.rowId };
  }

  if (!isResponseTableContentExpandable(action.columnId)) return state;
  if (state.type === "column" && state.columnId === action.columnId) return { type: "none" };
  return { type: "column", columnId: action.columnId };
}

export function isResponseTableCellExpanded(
  state: ResponseTableExpansionState,
  rowId: string,
  columnId: ResponseTableColumnId,
): boolean {
  if (state.type === "column") return state.columnId === columnId;
  if (state.type === "cell") return state.rowId === rowId && state.columnId === columnId;
  if (state.type === "row") return state.rowId === rowId && isResponseTableContentExpandable(columnId);
  return false;
}

export function isResponseTableRowExpanded(state: ResponseTableExpansionState, rowId: string): boolean {
  return state.type === "row" && state.rowId === rowId;
}

export function isResponseTableColumnExpanded(state: ResponseTableExpansionState, columnId: ResponseTableColumnId): boolean {
  return state.type === "column" && state.columnId === columnId;
}
