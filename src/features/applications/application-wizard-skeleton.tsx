import {Skeleton} from "@/components/ui/skeleton";

export function ApplicationWizardSkeleton() {
  return <div className="application-wizard" aria-busy="true" aria-label="Application form">
    <div className="job-wizard-top"><Skeleton style={{width:240,height:32}}/></div>
    <div className="job-wizard-layout"><aside className="card job-wizard-stepper" aria-hidden="true">{[1,2,3,4].map(i => <Skeleton key={i} style={{display:"block",height:48,marginBottom:12}}/>)}</aside><section className="card"><Skeleton style={{width:180,height:24,marginBottom:28}}/><Skeleton style={{display:"block",height:54,marginBottom:22}}/><Skeleton style={{display:"block",height:54}}/></section></div>
  </div>;
}
