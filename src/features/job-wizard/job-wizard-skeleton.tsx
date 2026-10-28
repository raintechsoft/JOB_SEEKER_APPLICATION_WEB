import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

const STEP_COUNT = 7;

/** A labelled field placeholder at the real floating-field height. */
function Field() {
  return <Skeleton className="job-wizard-skeleton-field" />;
}

/**
 * Loading state built from the editor's own layout classes (header, step sidebar, content card and
 * footer), so the page does not jump when the draft arrives.
 */
export function JobWizardSkeleton() {
  return (
    <LoadingRegion label="Loading the job editor" className="job-wizard-skeleton">
      <div className="job-wizard-workspace">
        <div className="job-wizard-top">
          <div className="job-wizard-skeleton-title">
            <Skeleton style={{ width: 230, height: 12 }} />
            <Skeleton style={{ width: 170, height: 30 }} />
          </div>
          <div className="job-wizard-top-actions">
            <Skeleton style={{ width: 190, height: 42, borderRadius: 999 }} />
            <Skeleton style={{ width: 110, height: 20 }} />
          </div>
        </div>
        <div className="job-wizard-layout">
          <aside className="card job-wizard-stepper">
            <Skeleton className="job-wizard-skeleton-stepper-title" style={{ width: "55%", height: 18 }} />
            <div className="job-wizard-skeleton-steps">
              {Array.from({ length: STEP_COUNT }, (_, i) => (
                <div className="job-wizard-skeleton-step" key={i}>
                  <Skeleton className="job-wizard-skeleton-dot" />
                  <Skeleton style={{ width: `${55 + ((i * 17) % 35)}%`, height: 13 }} />
                </div>
              ))}
            </div>
            <Skeleton className="job-wizard-skeleton-note" style={{ width: "100%", height: 44, borderRadius: 10 }} />
          </aside>
          <section className="card job-wizard-content">
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
          </section>
        </div>
        <footer className="job-wizard-footer">
          <div>
            <Skeleton style={{ width: 34, height: 14 }} />
            <Skeleton style={{ width: 160, height: 40, borderRadius: 999 }} />
            <div className="grow" />
            <Skeleton style={{ width: 96, height: 40, borderRadius: 999 }} />
          </div>
        </footer>
      </div>
    </LoadingRegion>
  );
}
