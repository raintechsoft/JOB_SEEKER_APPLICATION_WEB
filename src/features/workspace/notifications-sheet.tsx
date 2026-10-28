"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useServices, useServiceQuery } from "@/hooks/use-services";
import { useFormAction } from "@/hooks/use-form-action";
import { Avatar, Button } from "@/components/ui/primitives";
import { CompanyAvatar } from "@/components/jobs/job-visuals";
import { Icon, type IconName } from "@/components/ui/icon";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import type { NotificationRecord } from "@/services/notifications/notifications.service";
import { modal } from "@/stores/modal-store";
import { timeAgo } from "@/lib/utils/date";

type Category = NotificationRecord["category"];
const CATEGORIES: Record<Category, { label: string; icon: IconName; action: string }> = {
  applications: { label: "Applications", icon: "briefcase", action: "View application" },
  messages: { label: "Messages", icon: "message", action: "View message" },
  job_alerts: { label: "Job alerts", icon: "bell", action: "View job" },
};
const FILTERS = ["all", "unread", "applications", "messages", "job_alerts"] as const;
type Filter = typeof FILTERS[number];

function NotificationActions({ notification, pending, markRead, remove }: { notification: NotificationRecord; pending: boolean; markRead: () => Promise<void>; remove: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>(".notification-action-menu button")?.focus();
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  return <div className="notification-actions" ref={root} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => {
    if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
  }}>
    <button type="button" className="notification-more" ref={trigger} disabled={pending} aria-label={`More options for ${notification.title}`} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg></button>
    {open && <div className="notification-action-menu" id={id} role="group" aria-label="Notification actions">
      {!notification.read && <button type="button" disabled={pending} onClick={async () => { await markRead(); setOpen(false); }}><Icon name="check" />Mark as read</button>}
      <button type="button" disabled={pending} onClick={async () => { await remove(); setOpen(false); }}><Icon name="trash" />Delete notification</button>
    </div>}
  </div>;
}

export function RealNotificationsSheet() {
  const router = useRouter();
  const services = useServices();
  const cache = useQueryClient();
  const acknowledged = useRef<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { execute, pending } = useFormAction(setErrors);
  const notifications = useServiceQuery(["notifications"], service => service.notifications.list(), { refetchInterval: 10000 });
  useEffect(() => {
    const snapshot = notifications.data;
    if (!snapshot?.newCount || acknowledged.current === snapshot.seenToken) return;
    acknowledged.current = snapshot.seenToken;
    // Acknowledge only the server snapshot shown here; arrivals after it remain new.
    void services.notifications.markSeen(snapshot.seenToken).then(() => cache.invalidateQueries({ queryKey: ["notification-counts"] })).catch(() => {
      acknowledged.current = null;
    });
  }, [notifications.data, services, cache]);
  const items = notifications.data?.items.filter(item => filter === "all" || (filter === "unread" ? !item.read : item.category === filter));
  const markRead = async (notification: NotificationRecord) => {
    setErrors({});
    return execute(service => service.notifications.markRead(notification.id), { invalidate: ["notifications", "notification-counts"] });
  };
  const remove = async (notification: NotificationRecord) => {
    setErrors({});
    await execute(service => service.notifications.delete(notification.id), { invalidate: ["notifications", "notification-counts"] });
  };
  return <div className="notifications-inbox">
    <div className="notification-toolbar">
      <div className="notification-filters" role="group" aria-label="Filter notifications">
        {FILTERS.map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === "all" ? "All" : value === "unread" ? "Unread" : CATEGORIES[value].label}</button>)}
      </div>
    </div>
    {errors._form && <p role="alert" className="error notification-feedback">{errors._form}</p>}
    {notifications.isError && <p role="alert" className="notification-feedback">Notifications could not be refreshed. <Button variant="text sm" onClick={() => void notifications.refetch()}>Try again</Button></p>}
    {!notifications.data && !notifications.isError && <LoadingRegion label="Loading notifications" className="notification-loading">{[0, 1].map(index => <div className="notification-loading-row" key={index}><Skeleton className="notification-loading-icon" /><div><Skeleton style={{ width: "90%" }} /><Skeleton style={{ width: "60%" }} /></div></div>)}</LoadingRegion>}
    {items && (items.length ? <div className="notification-list" aria-label="Notifications">
      {items.map(notification => {
        const category = CATEGORIES[notification.category];
        const relativeTime = timeAgo(notification.createdAt).replace(" ago", "");
        return <article className="notification-row" key={notification.id} data-notification-id={notification.id} data-unread={!notification.read}>
          <button type="button" className="notification-open" disabled={pending} aria-label={`Open notification: ${notification.title}${notification.read ? "" : " (unread)"}`} onClick={async () => {
            if (!notification.read && !await markRead(notification)) return;
            modal.close(); router.push(notification.href);
          }}>
            <span className="notification-unread-dot" aria-hidden="true" />
            <span className="notification-avatar" aria-hidden="true">{notification.avatar ? notification.avatar.type === "company" ? <CompanyAvatar company={{ id: notification.avatar.id, name: notification.avatar.name, logoUrl: notification.avatar.picture, confidential: notification.avatar.confidential }} /> : <Avatar person={notification.avatar} /> : <span className={`notification-category-icon notification-category-${notification.category}`}><Icon name={category.icon} /></span>}</span>
            <span className="notification-copy"><span className="notification-message">{notification.segments?.length ? notification.segments.map((segment, index) => <Fragment key={index}>{segment.emphasis ? <strong>{segment.text}</strong> : segment.text}</Fragment>) : notification.title}</span><span className="notification-open-label">{category.action}<Icon name="arrow" /></span></span>
          </button>
          <div className="notification-meta"><time dateTime={notification.createdAt} title={new Date(notification.createdAt).toLocaleString("en-IN")}>{relativeTime === "Just now" ? "Now" : relativeTime}</time><NotificationActions notification={notification} pending={pending} markRead={async () => { await markRead(notification); }} remove={() => remove(notification)} /></div>
        </article>;
      })}
    </div> : <div className="notification-empty-state"><span aria-hidden="true"><Icon name={filter === "unread" ? "check" : "bell"} /></span><h3>{filter === "unread" ? "You’re all caught up" : filter === "all" ? "No notifications yet" : `No ${CATEGORIES[filter].label.toLowerCase()} yet`}</h3><p>{filter === "unread" ? "You have no unread notifications." : "New updates will appear here."}</p>{filter !== "all" && <Button variant="text sm" onClick={() => setFilter("all")}>View all notifications</Button>}</div>)}
    {notifications.data?.items.length === 100 && <p className="notification-limit">Your latest 100 notifications</p>}
  </div>;
}
