import type { ReactNode } from "react";
import { LinkButton } from "@/components/ui/primitives";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import { JOB_TEMPLATE_CREATE_ENABLED } from "@/lib/feature-flags";

/** A labelled field placeholder at the real floating-field height. */
function Field() {
  return <Skeleton className="job-wizard-skeleton-field" />;
}

/**
 * Editor frame while the draft opens, built from the editor's own layout classes so the page does
 * not jump when the draft arrives. The eyebrow, back link, stepper heading and step names render
 * immediately; the title (when it depends on the draft), the template action, save note and stage
 * are placeholders. Pass `children` (an error panel) to show it in the stage instead.
 */
export function JobWizardSkeleton({ steps, title, children }: { steps: readonly string[]; title?: string; children?: ReactNode }) {
  const failed = children !== undefined;
  return (
    <div className="job-wizard-workspace">
      <div className="job-wizard-top">
        <div>
          {title ? <h1>{title}</h1> : failed ? null : <LoadingRegion label="Loading job title"><Skeleton style={{ display: "block", width: 170, height: 30 }} /></LoadingRegion>}
        </div>
        <div className="job-wizard-top-actions">
          {failed || !JOB_TEMPLATE_CREATE_ENABLED ? null : <Skeleton style={{ width: 190, height: 42, borderRadius: 999 }} />}
          <LinkButton href="/recruiter/applications" variant="text sm" icon="arrow">
            Back to jobs
          </LinkButton>
        </div>
      </div>
      <div className="job-wizard-layout">
        <aside className="card job-wizard-stepper">
          <h2>Your job post</h2>
          <nav aria-label="Job posting stages">
            {steps.map((label, i) => (
              <button type="button" key={label} className={i === 0 ? "active" : ""} aria-current={i === 0 ? "step" : undefined} disabled>
                <span>{i + 1}</span>
                <strong>{label}</strong>
              </button>
            ))}
          </nav>
          {failed ? null : <Skeleton className="job-wizard-skeleton-note" style={{ display: "block", width: "100%", height: 44, borderRadius: 10 }} />}
        </aside>
        <section className="card job-wizard-content">
          {children ?? (
            <LoadingRegion label="Loading the job editor" className="job-wizard-skeleton">
              <div className="wizard-stage-heading job-wizard-skeleton-heading">
                <Skeleton style={{ width: 92, height: 11 }} />
                <Skeleton style={{ width: 210, height: 24 }} />
                <Skeleton style={{ width: "58%", height: 14 }} />
              </div>
              <div className="wizard-section">
                <Skeleton style={{ width: 150, height: 18 }} />
                <div className="grid cols2"><Field /><Field /></div>
                <Skeleton style={{ width: 260, height: 16 }} />
                <div className="grid cols2"><Field /><Field /></div>
                <div className="grid cols2"><Field /></div>
              </div>
              <div className="wizard-section">
                <Skeleton style={{ width: 210, height: 18 }} />
                <div className="grid cols2"><Field /><Field /></div>
              </div>
            </LoadingRegion>
          )}
        </section>
      </div>
      {failed ? null : (
        <footer className="job-wizard-footer" aria-hidden="true">
          <div>
            <Skeleton style={{ width: 34, height: 14 }} />
            <Skeleton style={{ width: 160, height: 40, borderRadius: 999 }} />
            <div className="grow" />
            <Skeleton style={{ width: 96, height: 40, borderRadius: 999 }} />
          </div>
        </footer>
      )}
    </div>
  );
}
