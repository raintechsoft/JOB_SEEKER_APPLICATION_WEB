import Link from "next/link";
import type { ReactNode } from "react";
import {LoadingRegion, Skeleton} from "@/components/ui/skeleton";

/**
 * Wizard frame while the application opens. With `returnTo`, the back link renders immediately;
 * only the job title and stage are skeletons. Pass `children` (an error panel) to show it in the
 * stage instead of the skeleton. The step rail matches the live wizard (hidden on small screens).
 */
export function ApplicationWizardSkeleton({ returnTo, children }: { returnTo?: string; children?: ReactNode }) {
  if (!returnTo) return <LoadingRegion label="Loading application form" className="application-wizard">
    <div className="job-wizard-top"><Skeleton style={{width:240,height:32}}/></div>
    <div className="job-wizard-layout"><aside className="card job-wizard-stepper" aria-hidden="true">{[1,2,3,4].map(i => <Skeleton key={i} style={{display:"block",height:48,marginBottom:12}}/>)}</aside><section className="card application-stage"><Skeleton style={{width:180,height:24,marginBottom:28}}/><Skeleton style={{display:"block",height:54,marginBottom:22}}/><Skeleton style={{display:"block",height:54}}/></section></div>
  </LoadingRegion>;
  const failed = children !== undefined;
  return <div className="application-wizard">
    <div className="job-wizard-top">
      <div>{failed ? null : <LoadingRegion label="Loading job details"><Skeleton style={{display:"block",width:240,maxWidth:"100%",height:32}}/></LoadingRegion>}</div>
      <Link href={returnTo} className="btn">Back to opportunities</Link>
    </div>
    <div className="job-wizard-layout">
      <aside className="card job-wizard-stepper" aria-hidden="true">
        <h2>Your application</h2>
        {failed ? null : <LoadingRegion label="Loading application steps">{[1,2,3,4].map(i => <Skeleton key={i} style={{display:"block",height:48,marginBottom:12}}/>)}</LoadingRegion>}
      </aside>
      <section className="card application-stage">
        {children ?? <LoadingRegion label="Loading application form"><Skeleton style={{display:"block",width:180,height:24,marginBottom:28}}/><Skeleton style={{display:"block",height:54,marginBottom:22}}/><Skeleton style={{display:"block",height:54}}/></LoadingRegion>}
      </section>
    </div>
  </div>;
}
