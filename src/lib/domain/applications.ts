import rules from "../../../contracts/validation/application.json";
import { APPLICATION_DISPLAY_STATUSES, type ApplicationCounts, type ApplicationFilter, type ApplicationRecord } from "@/services/applications/applications.service";
import type { ApplicationStatus } from "@/types/domain";

export const APPLICATION_FILTER_GROUPS = rules.filterGroups as Record<"in-progress" | "other", ApplicationStatus[]>;

/** Explicit development mock parity. Live counts always come from Laravel. */
export function mockApplicationResults(rows: ApplicationRecord[], filter: ApplicationFilter) {
  const statuses = Object.fromEntries(APPLICATION_DISPLAY_STATUSES.map(status => [status,0])) as ApplicationCounts["statuses"];
  for (const row of rows) statuses[row.status]++;
  const count = (group: ApplicationStatus[]) => group.reduce((sum,status) => sum + statuses[status],0);
  const counts:ApplicationCounts = {all:rows.length,inProgress:count(APPLICATION_FILTER_GROUPS["in-progress"]),other:count(APPLICATION_FILTER_GROUPS.other),statuses};
  const allowed = filter === "in-progress" || filter === "other" ? APPLICATION_FILTER_GROUPS[filter] : [filter];
  return {items:rows.filter(row => !filter || allowed.includes(row.status)),counts};
}
