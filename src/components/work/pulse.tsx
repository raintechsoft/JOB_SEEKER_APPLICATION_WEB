"use client";

import type { Id, WorkUpdate } from "@/types/domain";
import type { Pulse } from "@/services/work/work.service";
import { formatLongDate, formatShortDate } from "@/lib/utils/date";
import { useServiceQuery } from "@/hooks/use-services";
import { Icon } from "@/components/ui/icon";
import { FloatingSelect } from "@/components/ui/field";
import { IconButton, LinkButton, Tags } from "@/components/ui/primitives";
import { useUpdateDialogs } from "@/features/work/dialogs";

const RAMP = ["#eff1f1", "#d5eddf", "#a6d7bd", "#66b58b", "#2e8c60"];

/** Calendar heatmap of recorded work updates. Selecting a day opens its updates. */
export function Heatmap({ pulse, ownerId }: { pulse: Pulse; ownerId: Id }) {
  const dialogs = useUpdateDialogs();
  return (
    <>
      <div className="heatmap">
        <div className="heatmap-months">
          {pulse.months.map((m, i) => (
            <span key={m + i}>{m}</span>
          ))}
        </div>
        <div className="heat-body">
          <div className="weekdays">
            <span>Mon</span>
            <span>Wed</span>
            <span>Fri</span>
          </div>
          <div className="heat-grid">
            {pulse.cells.map(({ date, count }) => (
              <button
                key={date}
                type="button"
                className={"heat-cell l" + (count ? Math.min(4, count + 1) : 0)}
                title={`${formatLongDate(date)}: ${count} recorded updates`}
                aria-label={`${formatLongDate(date)}, ${count} recorded updates`}
                onClick={() => dialogs.day(ownerId, date)}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="heat-legend">
        <span>{pulse.totalDays} days of your professional story</span>
        <span className="row gap8">
          Less{" "}
          {RAMP.map((c) => (
            <i key={c} className="square" style={{ background: c }} />
          ))}{" "}
          More
        </span>
      </div>
    </>
  );
}

/** Work Pulse card (prototype `pulseCard`). */
export function PulseCard({ ownerId, days = 365, full = false, onRangeChange }: { ownerId: Id; days?: number; full?: boolean; onRangeChange?: (days: 91 | 365) => void }) {
  const { data: pulse } = useServiceQuery(["pulse", ownerId, days], (s) => s.work.getPulse(ownerId, days));
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>
            Work Pulse{" "}
            <span style={{ fontSize: 10, color: "#7d987f", marginLeft: 5 }}>
              <Icon name="pulse" />
            </span>
          </h2>
          <p>A little progress, recorded every day.</p>
        </div>
        {full ? (
          <FloatingSelect
            label="Activity date range"
            className="control"
            aria-label="Activity date range"
            id="pulse-range"
            style={{ width: "auto", fontSize: 10, minHeight: 30, padding: 6 }}
            value={String(days)}
            onChange={(e) => onRangeChange?.(Number(e.target.value) as 91 | 365)}
            options={[
              { value: "91", label: "Last 3 months" },
              { value: "365", label: "Last 12 months" },
            ]}
          />
        ) : (
          <LinkButton href="/app/work-pulse" variant="sm" icon="calendar">
            Last 12 months
          </LinkButton>
        )}
      </div>
      {pulse && (
        <>
          <Heatmap pulse={pulse} ownerId={ownerId} />
          <div className="pulse-summary">
            <div>
              <strong>{pulse.updateCount}</strong>
              <span>updates recorded</span>
            </div>
            <div>
              <strong>{pulse.activeDays}</strong>
              <span>active days</span>
            </div>
            <div>
              <strong>{pulse.projectCount}</strong>
              <span>projects in progress</span>
            </div>
          </div>
        </>
      )}
      {full && (
        <p className="muted small" style={{ marginTop: 17, fontSize: 10 }}>
          Work Pulse reflects activity recorded on Skillora. It does not measure productivity, work quality, or hours worked. Select a day to explore its updates.
        </p>
      )}
    </section>
  );
}

/** Compact 22-day activity strip on talent cards. */
export function MiniPulse({ recentDays }: { recentDays: number[] }) {
  return (
    <div className="mini-pulse" aria-label="Recent recorded activity">
      {Array.from({ length: 22 }, (_, i) => (
        <i key={i} className={recentDays.includes(i) ? (i % 3 ? "on" : "dark") : ""} />
      ))}
      <small>Work Pulse</small>
    </div>
  );
}

/** A recorded work update (prototype `updateItem`). */
export function UpdateItem({ update: u, manage = false }: { update: WorkUpdate; manage?: boolean }) {
  const dialogs = useUpdateDialogs();
  return (
    <article className="activity-item">
      <span className="activity-symbol">
        <Icon name={u.category === "Research" ? "search" : u.category === "Learning" ? "spark" : "edit"} />
      </span>
      <div className="grow">
        <div className="row between">
          <h3>
            <button type="button" style={{ textAlign: "left", padding: 0 }} onClick={() => dialogs.view(u.id)}>
              {u.title}
            </button>
          </h3>
          <span className="activity-date">{formatShortDate(u.date)}</span>
        </div>
        <p>{u.description}</p>
        <Tags items={u.skills} />
        <div className="row between" style={{ marginTop: 12 }}>
          <span className="activity-meta">
            <Icon name={u.visibility === "Private" ? "shield" : "globe"} /> {u.visibility} <span>·</span> {u.category}
          </span>
          {manage && (
            <div className="row gap8">
              <IconButton icon="edit" label="Edit update" onClick={() => dialogs.edit(u.id)} />
              <IconButton icon="trash" label="Delete update" onClick={() => dialogs.remove(u.id)} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
