"use client";

import { Fragment, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useServices } from "@/hooks/use-services";
import { useFormAction } from "@/hooks/use-form-action";
import { Avatar, Button, EmptyState } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/state-views";
import { CompanyAvatar } from "@/components/jobs/job-visuals";
import { VerifiedCompanyMark } from "@/components/organization/controls";
import { Icon, type IconName } from "@/components/ui/icon";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import type { NotificationRecord } from "@/services/notifications/notifications.service";
import { modal } from "@/stores/modal-store";
import { timeAgo } from "@/lib/utils/date";
import { useCommunicationQuery } from "@/hooks/use-communication-query";

type Category = NotificationRecord["category"];
const CATEGORIES: Record<Category, { label: string; icon: IconName; action: string }> = {
  applications: { label: "Applications", icon: "briefcase", action: "View application" },
  messages: { label: "Messages", icon: "message", action: "View message" },
  job_alerts: { label: "Job alerts", icon: "bell", action: "View job" },
  network: { label: "Network", icon: "users", action: "View activity" },
};
const FILTERS = ["all", "unread", "applications", "messages", "job_alerts", "network"] as const;
type Filter = typeof FILTERS[number];

function filterLabel(value: Filter) {
  return value === "all" ? "All" : value === "unread" ? "Unread" : CATEGORIES[value].label;
}

function measureFilterOverflow(el: HTMLElement) {
  const { scrollLeft, scrollWidth, clientWidth } = el;
  return {
    left: scrollLeft > 1,
    right: scrollLeft + clientWidth < scrollWidth - 1,
  };
}

function NotificationFilters({ value, onChange }: { value: Filter; onChange: (next: Filter) => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 });
  const [overflow, setOverflow] = useState({ left: false, right: false });

  function syncOverflow() {
    const el = listRef.current;
    if (!el) return;
    setOverflow(measureFilterOverflow(el));
  }

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    active?.scrollIntoView?.({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [value]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    syncOverflow();
    const onScroll = () => syncOverflow();
    el.addEventListener("scroll", onScroll, { passive: true });
    const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => syncOverflow()) : null;
    resize?.observe(el);
    window.addEventListener("resize", syncOverflow);
    return () => {
      el.removeEventListener("scroll", onScroll);
      resize?.disconnect();
      window.removeEventListener("resize", syncOverflow);
    };
  }, []);

  function scrollFilters(direction: -1 | 1) {
    const el = listRef.current;
    if (!el) return;
    const step = Math.max(120, Math.floor(el.clientWidth * 0.7));
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  return (
    <div
      className={
        "notification-filters-shell" +
        (overflow.left ? " has-overflow-left" : "") +
        (overflow.right ? " has-overflow-right" : "")
      }
    >
      {overflow.left ? (
        <button type="button" className="notification-filters-arrow is-prev" aria-label="Show previous filters" onClick={() => scrollFilters(-1)}>
          <Icon name="chevron" />
        </button>
      ) : null}
      <div
        ref={listRef}
        className="notification-filters"
        role="group"
        aria-label="Filter notifications"
        onPointerDown={(event) => {
          if (event.button !== 0 || !listRef.current) return;
          drag.current = { active: true, moved: false, startX: event.clientX, scrollLeft: listRef.current.scrollLeft };
          listRef.current.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const el = listRef.current;
          if (!drag.current.active || !el) return;
          const delta = event.clientX - drag.current.startX;
          if (Math.abs(delta) > 4) {
            drag.current.moved = true;
            el.classList.add("is-dragging");
          }
          if (drag.current.moved) el.scrollLeft = drag.current.scrollLeft - delta;
        }}
        onPointerUp={(event) => {
          const el = listRef.current;
          if (!el) return;
          if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
          el.classList.remove("is-dragging");
          drag.current.active = false;
        }}
        onPointerCancel={() => {
          listRef.current?.classList.remove("is-dragging");
          drag.current.active = false;
          drag.current.moved = false;
        }}
        onClickCapture={(event) => {
          if (!drag.current.moved) return;
          event.preventDefault();
          event.stopPropagation();
          drag.current.moved = false;
        }}
      >
        {FILTERS.map((item) => (
          <button type="button" key={item} aria-pressed={value === item} onClick={() => onChange(item)}>
            {filterLabel(item)}
          </button>
        ))}
      </div>
      {overflow.right ? (
        <button type="button" className="notification-filters-arrow is-next" aria-label="Show more filters" onClick={() => scrollFilters(1)}>
          <Icon name="chevron" />
        </button>
      ) : null}
    </div>
  );
}

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

const CLEAR_SWIPE_MS = 420;

export function RealNotificationsSheet() {
  const router = useRouter();
  const services = useServices();
  const cache = useQueryClient();
  const acknowledged = useRef<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [clearing, setClearing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { execute, pending } = useFormAction(setErrors);
  const notifications = useCommunicationQuery(["notifications"], (service, scope) => service.notifications.list(scope));
  useEffect(() => {
    const snapshot = notifications.data;
    if (!snapshot?.newCount || acknowledged.current === snapshot.seenToken) return;
    acknowledged.current = snapshot.seenToken;
    // Acknowledge only the server snapshot shown here; arrivals after it remain new.
    void services.notifications.markSeen(snapshot.seenToken).then(() => cache.invalidateQueries({ queryKey: ["notification-counts"] })).catch(() => {
      acknowledged.current = null;
    });
  }, [notifications.data, services, cache]);
  useEffect(() => {
    if (clearing && !notifications.data?.items.length) setClearing(false);
  }, [clearing, notifications.data?.items.length]);
  const items = notifications.data?.items.filter(item => filter === "all" || (filter === "unread" ? !item.read : item.category === filter));
  const hasAny = !!notifications.data?.items.length;
  const markRead = async (notification: NotificationRecord) => {
    setErrors({});
    return execute(service => service.notifications.markRead(notification.id), { invalidate: ["notifications", "notification-counts"] });
  };
  const remove = async (notification: NotificationRecord) => {
    setErrors({});
    await execute(service => service.notifications.delete(notification.id), { invalidate: ["notifications", "notification-counts"] });
  };
  const clearAll = async () => {
    if (!hasAny || clearing || pending) return;
    setErrors({});
    setClearing(true);
    await new Promise(resolve => window.setTimeout(resolve, CLEAR_SWIPE_MS));
    const ok = await execute(service => service.notifications.clearAll(), { invalidate: ["notifications", "notification-counts"] });
    if (!ok) setClearing(false);
  };
  return <div className="notifications-inbox">
    <div className="notification-toolbar">
      <NotificationFilters value={filter} onChange={setFilter} />
      {hasAny ? <button type="button" className="notification-clear-all" disabled={pending || clearing} onClick={() => void clearAll()}>Clear all</button> : null}
    </div>
    {errors._form && <p role="alert" className="error notification-feedback">{errors._form}</p>}
    {notifications.isError && notifications.data && <p role="status" className="state-inline-note notification-feedback">Couldn’t refresh notifications. Showing the last loaded updates. <button type="button" className="link" onClick={() => void notifications.refetch()}>Try again</button></p>}
    {notifications.isError && !notifications.data && <ErrorState compact error={notifications.error} title="Notifications couldn’t load" description="Something interrupted the request. Please try again." onRetry={() => void notifications.refetch()} />}
    {!notifications.data && !notifications.isError && <LoadingRegion label="Loading notifications" className="notification-loading">{[0, 1].map(index => <div className="notification-loading-row" key={index}><Skeleton className="notification-loading-icon" /><div><Skeleton style={{ width: "90%" }} /><Skeleton style={{ width: "60%" }} /></div></div>)}</LoadingRegion>}
    {items && (items.length ? <div className={"notification-list" + (clearing ? " is-clearing" : "")} aria-label="Notifications" aria-busy={clearing || undefined}>
      {items.map((notification, index) => {
        const category = CATEGORIES[notification.category];
        const relativeTime = timeAgo(notification.createdAt).replace(" ago", "");
        return <article className="notification-row" key={notification.id} data-notification-id={notification.id} data-unread={!notification.read} style={{ "--notification-swipe-delay": `${Math.min(index, 12) * 28}ms` } as CSSProperties}>
          <button type="button" className="notification-open" disabled={pending || clearing} aria-label={`Open notification: ${notification.title}${notification.read ? "" : " (unread)"}`} onClick={async () => {
            if (!notification.read && !await markRead(notification)) return;
            modal.close(); router.push(notification.href);
          }}>
            <span className="notification-unread-dot" aria-hidden="true" />
            <span className="notification-avatar" aria-hidden="true">{notification.avatar ? notification.avatar.type === "company" ? <><CompanyAvatar company={{ id: notification.avatar.id, name: notification.avatar.name, logoUrl: notification.avatar.picture, confidential: notification.avatar.confidential, verified: notification.avatar.verified }} /><VerifiedCompanyMark company={notification.avatar} /></> : <Avatar person={notification.avatar} /> : <span className={`notification-category-icon notification-category-${notification.category}`}><Icon name={category.icon} /></span>}</span>
            <span className="notification-copy"><span className="notification-message">{notification.segments?.length ? notification.segments.map((segment, index) => <Fragment key={index}>{segment.emphasis ? <strong>{segment.text}</strong> : segment.text}</Fragment>) : notification.title}</span><span className="notification-open-label">{category.action}<Icon name="arrow" /></span></span>
          </button>
          <div className="notification-meta"><time dateTime={notification.createdAt} title={new Date(notification.createdAt).toLocaleString("en-IN")}>{relativeTime === "Just now" ? "Now" : relativeTime}</time><NotificationActions notification={notification} pending={pending || clearing} markRead={async () => { await markRead(notification); }} remove={() => remove(notification)} /></div>
        </article>;
      })}
    </div> : <EmptyState compact icon={filter === "unread" ? "check" : filter === "all" ? "bell" : CATEGORIES[filter].icon} title={filter === "unread" ? "You’re all caught up" : filter === "all" ? "No notifications yet" : `No ${CATEGORIES[filter].label.toLowerCase()} yet`} description={filter === "unread" ? "You have no unread notifications." : "New updates will appear here."} action={filter !== "all" ? <Button variant="sm" onClick={() => setFilter("all")}>View all notifications</Button> : undefined} />)}
    {notifications.data?.items.length === 100 && !clearing && <p className="notification-limit">Your latest 100 notifications</p>}
  </div>;
}
