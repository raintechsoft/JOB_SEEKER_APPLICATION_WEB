"use client";

import { useId } from "react";
import { Icon } from "@/components/ui/icon";
import { useCommunicationQuery } from "@/hooks/use-communication-query";
import { apiConfig } from "@/services/api/config";
import { workspaceDialogs } from "./dialogs";

export function NotificationBell({ role }: { role: "professional" | "recruiter" }) {
  const description = useId();
  const counts = useCommunicationQuery(["notification-counts", role], (service, scope) => service.notifications.counts(scope), { enabled: apiConfig.dataSource === "http" });
  const count = counts.data?.newCount ?? 0;
  return <button type="button" className="iconbtn notification-bell" aria-label="Notifications" aria-describedby={count ? description : undefined} onClick={workspaceDialogs.notifications}>
    <Icon name="bell" />
    {count > 0 && <><span className="notification-new-count" aria-hidden="true">{count > 99 ? "99+" : count}</span><span className="sr-only" id={description}>{count} new notification{count === 1 ? "" : "s"}</span></>}
  </button>;
}
