"use client";

import { useId } from "react";
import { Icon } from "@/components/ui/icon";
import { useServiceQuery } from "@/hooks/use-services";
import { apiConfig } from "@/services/api/config";
import { workspaceDialogs } from "./dialogs";

export function NotificationBell({ role }: { role: "professional" | "recruiter" }) {
  const description = useId();
  const counts = useServiceQuery(["notification-counts", role], service => service.notifications.counts(), { enabled: apiConfig.dataSource === "http", refetchInterval: 10000, refetchOnWindowFocus: "always" });
  const count = counts.data?.newCount ?? 0;
  return <button type="button" className="iconbtn notification-bell" aria-label="Notifications" aria-describedby={count ? description : undefined} onClick={workspaceDialogs.notifications}>
    <Icon name="bell" />
    {count > 0 && <><span className="notification-new-count" aria-hidden="true">{count > 99 ? "99+" : count}</span><span className="sr-only" id={description}>{count} new notification{count === 1 ? "" : "s"}</span></>}
  </button>;
}
