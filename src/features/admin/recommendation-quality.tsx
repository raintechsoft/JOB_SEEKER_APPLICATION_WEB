"use client";

import { useState } from "react";
import { useServiceQuery } from "@/hooks/use-services";
import { QueryFeedback } from "@/components/ui/query-view";
import { Badge } from "@/components/ui/primitives";
import { FloatingSelect } from "@/components/ui/field";
import type { components } from "@/types/generated/api";

type Quality = components["schemas"]["RecommendationQuality"];

const SURFACES: Record<string, string> = {
  "professional.jobs": "Jobs for you",
  "professional.feed": "Feed (job seekers)",
  "recruiter.feed": "Feed (recruiters)",
  "recruiter.talent": "Talent for you",
  "recruiter.applicants": "Applicants",
};

const percent = (value: number | null) => (value == null ? "—" : `${(value * 100).toFixed(1)}%`);
const score = (value: number | null) => (value == null ? "—" : value.toFixed(3));
const OFFLINE_SURFACES: Record<string, string> = { jobs: "Jobs for you", feed: "Feed (job seekers)" };

/** Admin: live recommendation quality per surface and strategy (A2), from first-party served lists. */
export function RecommendationQuality() {
  const [days, setDays] = useState(14);
  const { data, isError, refetch } = useServiceQuery(["admin", "recommendation-quality", days], (s) => s.admin.recommendationQuality!(days));
  return (
    <div className="stack recommendation-quality">
      <div className="recommendation-quality-head">
        <p className="muted">
          Each person–item pair counts once, at its first serving; an action counts when it happens within {data?.windowHours ?? 24} hours. Rates are per
          item seen on screen (per item served when no views are recorded). Offline accuracy on held-out activity:{" "}
          <code>php artisan skillora:evaluate-recommendations --store</code>.
        </p>
        <FloatingSelect label="Period" id="quality-days" value={String(days)} onChange={(e) => setDays(Number(e.target.value))}
          options={[{ value: "7", label: "Last 7 days" }, { value: "14", label: "Last 14 days" }, { value: "30", label: "Last 30 days" }]} />
      </div>
      <QueryFeedback data={data} error={isError} retry={refetch} label="Loading recommendation quality" />
      {data && <QualityTables data={data} />}
    </div>
  );
}

/** M5: latest stored offline accuracy — the baseline a trained model has to beat, and weight-tuning checks. */
function OfflineAccuracy({ rows }: { rows: Quality["offline"] }) {
  return (
    <section className="card" style={{ overflow: "auto" }} aria-labelledby="quality-offline">
      <h2 id="quality-offline">Offline accuracy</h2>
      {rows.length === 0 ? (
        <p className="muted">No offline evaluation stored yet. Run <code>php artisan skillora:evaluate-recommendations --store</code>.</p>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Surface</th><th>Strategy</th><th>People</th><th>NDCG@10</th><th>Precision@10</th><th>Recall@10</th><th>MRR</th><th>Evaluated</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.surface + row.strategy}>
                <td>{OFFLINE_SURFACES[row.surface] ?? row.surface}</td>
                <td>
                  {row.strategy}
                  {row.data === "development" && <> <Badge tone="purple">Seeded data</Badge></>}
                  {row.split === "validation" && <div className="small muted">Checked on people not used for tuning</div>}
                </td>
                <td>{row.queries}</td>
                <td>{score(row.ndcgAt10)}</td>
                <td>{score(row.precisionAt10)}</td>
                <td>{score(row.recallAt10)}</td>
                <td>{score(row.mrr)}</td>
                <td>{new Date(row.evaluatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="small muted">Recent likes, saves, applications and long reads are hidden; each strategy then recommends from what is left, and these scores show how high the hidden items come back (1 = all at the top). Compare rows of the same surface.</p>
    </section>
  );
}

function QualityTables({ data }: { data: Quality }) {
  return (
    <>
      <section className="card" style={{ overflow: "auto" }} aria-labelledby="quality-surfaces">
        <h2 id="quality-surfaces">Recommendations</h2>
        {data.surfaces.length === 0 ? (
          <p className="muted">Nothing served in this period yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Surface</th><th>Strategy</th><th>Served</th><th>People</th><th>Seen</th><th>Opened</th><th>Saved</th><th>Applied</th><th>Liked</th><th>Hidden</th><th>First open (position)</th>
              </tr>
            </thead>
            <tbody>
              {data.surfaces.map((row) => (
                <tr key={row.surface + row.strategy}>
                  <td>{SURFACES[row.surface] ?? row.surface}</td>
                  <td>
                    {row.strategy}
                    {!row.enoughData && <> <Badge tone="purple">Not enough data</Badge></>}
                  </td>
                  <td>{row.served}</td>
                  <td>{row.people}</td>
                  <td>{percent(row.rates.view)}</td>
                  <td>{percent(row.rates.open)}</td>
                  <td>{percent(row.rates.save)}</td>
                  <td>{row.surface.endsWith(".jobs") ? percent(row.rates.apply) : "—"}</td>
                  <td>{row.surface.endsWith(".feed") ? percent(row.rates.like) : "—"}</td>
                  <td>{percent(row.rates.hide)}</td>
                  <td>{row.firstOpenPosition ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="small muted">Rows below {data.minimumServed} served items are marked “Not enough data”: compare strategies only when both have enough.</p>
      </section>
      <section className="card" style={{ overflow: "auto" }} aria-labelledby="quality-search">
        <h2 id="quality-search">Search</h2>
        {data.search.length === 0 ? (
          <p className="muted">No searches in this period.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Where</th><th>Searches</th><th>No results</th></tr></thead>
            <tbody>
              {data.search.map((row) => (
                <tr key={row.source}><td>{row.source}</td><td>{row.searches}</td><td>{percent(row.zeroResultRate)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <OfflineAccuracy rows={data.offline ?? []} />
    </>
  );
}
