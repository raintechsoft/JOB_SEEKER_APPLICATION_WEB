import type { ReactNode } from "react";
import { cn } from "@/lib/utils/text";
import { Icon, type IconName } from "./icon";

export type StateTone = "neutral" | "info" | "warning" | "danger";

/**
 * One layout for every empty, error, access and not-found state: tinted icon, title,
 * message and actions. `compact` fits side columns, sheets and dropdowns.
 */
export function StatePanel({ icon, tone = "neutral", title, description, actions, compact = false, role, className }: {
  icon: IconName;
  tone?: StateTone;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  role?: "alert" | "status";
  className?: string;
}) {
  return (
    <div className={cn("state-panel", `is-${tone}`, compact && "is-compact", className)} role={role}>
      <span className="state-panel-icon" aria-hidden="true"><Icon name={icon} /></span>
      <h3 className="state-panel-title">{title}</h3>
      {description ? <p className="state-panel-text">{description}</p> : null}
      {actions ? <div className="state-panel-actions">{actions}</div> : null}
    </div>
  );
}
