"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useServiceQuery } from "@/hooks/use-services";
import { Icon } from "@/components/ui/icon";
import type { Role } from "@/types/domain";
import {
  activityCalendarContract,
  currentPeriod,
  daySummary,
  formatCalendarDate,
  levelRanges,
  MONTH_NAMES,
  monthGrid,
  parsePeriod,
  periodKey,
  shiftPeriod,
  WEEKDAY_NAMES,
  type ActivityDay,
  type Period,
} from "@/lib/activity/activity-calendar";

const MONTH_PARAM = "activityMonth";
const YEAR_PARAM = "activityYear";

/**
 * The URL is the durable source of the selected month: refresh, Back and Forward restore it, and
 * nothing changes it except the controls below. "Current month" is fixed when the widget mounts.
 */
function useSelectedPeriod() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [latest] = useState(currentPeriod);
  const selected = parsePeriod(params.get(MONTH_PARAM), params.get(YEAR_PARAM), latest) ?? latest;
  const select = (period: Period) => {
    const next = new URLSearchParams(params.toString());
    next.set(MONTH_PARAM, String(period.month));
    next.set(YEAR_PARAM, String(period.year));
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };
  return { selected, latest, select };
}

type Tip = { day: ActivityDay; rect: DOMRect; pinned: boolean };

export function ActivityHeatmap({ role }: { role: Role }) {
  const { selected, latest, select } = useSelectedPeriod();
  const query = useServiceQuery(["activity", "calendar", role, selected.year, selected.month], (s) => s.feed.getActivityCalendar(role, selected.year, selected.month), { keepPreviousData: false });
  const data = query.data;
  const earliest = data?.range.earliest ?? `${activityCalendarContract.minYear}-01`;
  const latestKey = periodKey(latest);
  const inRange = (p: Period) => periodKey(p) >= earliest && periodKey(p) <= latestKey;
  const clamp = (p: Period): Period => (periodKey(p) < earliest ? { year: Number(earliest.slice(0, 4)), month: Number(earliest.slice(5)) } : periodKey(p) > latestKey ? latest : p);
  const previous = shiftPeriod(selected, -1);
  const next = shiftPeriod(selected, 1);
  const years = Array.from({ length: latest.year - Number(earliest.slice(0, 4)) + 1 }, (_, i) => latest.year - i);
  const title = `${MONTH_NAMES[selected.month - 1]} ${selected.year}`;
  const byDate = new Map(data?.days.map((d) => [d.date, d]));
  const [tip, setTip] = useState<Tip | null>(null);
  const [todayDate] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: activityCalendarContract.timezone }).format(new Date()));
  const tipId = useId();

  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    const escape = (e: KeyboardEvent) => e.key === "Escape" && hide();
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      document.removeEventListener("keydown", escape);
    };
  }, [tip]);

  const show = (day: ActivityDay, target: HTMLElement, pinned = false) => setTip({ day, rect: target.getBoundingClientRect(), pinned });
  const hide = () => setTip((current) => (current?.pinned ? current : null));
  const visibleTip = tip && byDate.get(tip.day.date) === tip.day ? tip : null;

  return (
    <div className="activity-heatmap">
      <div className="activity-period" role="group" aria-label="Activity month">
        <button type="button" className="activity-step" aria-label={`Previous month, ${MONTH_NAMES[previous.month - 1]} ${previous.year}`} disabled={!inRange(previous)} onClick={() => select(previous)}>
          <Icon name="arrow" />
        </button>
        <select aria-label="Month" value={selected.month} onChange={(e) => select(clamp({ year: selected.year, month: Number(e.target.value) }))}>
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1} disabled={!inRange({ year: selected.year, month: i + 1 })}>
              {name}
            </option>
          ))}
        </select>
        <select aria-label="Year" value={selected.year} onChange={(e) => select(clamp({ year: Number(e.target.value), month: selected.month }))}>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <button type="button" className="activity-step next" aria-label={`Next month, ${MONTH_NAMES[next.month - 1]} ${next.year}`} disabled={!inRange(next)} onClick={() => select(next)}>
          <Icon name="arrow" />
        </button>
      </div>
      <table className={"activity-grid" + (data ? "" : " is-loading")} aria-label={`Activity calendar, ${title}`} aria-busy={query.isPending || undefined}>
        <thead>
          <tr>
            {WEEKDAY_NAMES.map((name) => (
              <th key={name} scope="col" abbr={name}>
                <span aria-hidden="true">{name.slice(0, 1)}</span>
                <span className="sr-only">{name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(selected.year, selected.month).map((week, row) => (
            <tr key={row}>
              {week.map((date, column) => {
                const day = date ? byDate.get(date) : undefined;
                if (!date) return <td key={column} className="activity-pad" aria-hidden="true" />;
                const number = Number(date.slice(8));
                const today = date === todayDate ? " is-today" : "";
                if (!day) return <td key={column}><span className={"activity-cell is-pending" + today} aria-hidden="true">{number}</span></td>;
                return (
                  <td key={column}>
                    <button
                      type="button"
                      className={"activity-cell l" + day.level + today}
                      aria-current={today ? "date" : undefined}
                      aria-label={daySummary(day)}
                      aria-describedby={visibleTip?.day.date === date ? tipId : undefined}
                      onMouseEnter={(e) => show(day, e.currentTarget)}
                      onMouseLeave={hide}
                      onFocus={(e) => show(day, e.currentTarget)}
                      onBlur={() => setTip(null)}
                      onClick={(e) => (tip?.pinned && tip.day.date === date ? setTip(null) : show(day, e.currentTarget, true))}
                    >
                      <span aria-hidden="true">{number}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {query.isError ? (
        <p className="activity-status error" role="alert">
          Activity for {title} could not be loaded.{" "}
          <button type="button" className="activity-retry" onClick={() => void query.refetch()}>
            Retry
          </button>
        </p>
      ) : (
        <p className="activity-status" aria-live="polite">
          {data ? data.total ? <><strong>{data.total}</strong> {data.total === 1 ? "activity" : "activities"} in {title}</> : <>No activity recorded in {title}</> : <span className="sr-only">Loading activity for {title}</span>}
        </p>
      )}
      <div className="activity-legend">
        <span>Less</span>
        {levelRanges().map((range, level) => (
          <i key={range} className={"activity-cell l" + level} title={range} aria-label={range} role="img" />
        ))}
        <span>More</span>
      </div>
      {visibleTip && typeof document !== "undefined" && createPortal(<ActivityTooltip id={tipId} {...visibleTip} />, document.body)}
    </div>
  );
}

function ActivityTooltip({ id, day, rect }: { id: string } & Tip) {
  const width = 220;
  const left = Math.min(Math.max(rect.left + rect.width / 2, width / 2 + 8), window.innerWidth - width / 2 - 8);
  const above = rect.top > 140;
  return (
    <div id={id} role="tooltip" className={"activity-tooltip" + (above ? " above" : "")} style={{ left, top: above ? rect.top - 8 : rect.bottom + 8, width }}>
      <strong>{formatCalendarDate(day.date)}</strong>
      <span>{day.count ? `${day.count} ${day.count === 1 ? "activity" : "activities"}` : "No activity"}</span>
      {day.activities.length > 0 && (
        <ul>
          {day.activities.map((a) => (
            <li key={a.type}>
              {a.label}: {a.count}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
