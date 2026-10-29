import type { CompensationV2, PublicCompensationV2, DeadlineV2 } from "@/lib/validation/job-v2";
import { formatCompensation } from "@/lib/domain/job-compensation";

export function JobValueSummary({compensation:c,deadline:d}:{compensation?:CompensationV2|PublicCompensationV2;deadline?:DeadlineV2}) {
  return <div className="stack">
    {c&&<section><h4>Compensation</h4><p>{formatCompensation(c)}</p>{"format" in c&&!c.hidden&&<>
      {c.allowances.length>0&&<ul>{c.allowances.map((a,i)=><li key={i}>{a.label}: {a.percent!==null?`${a.percent}%`:`${c.currency} ${a.amount}`}</li>)}</ul>}
      {c.notes&&<p style={{whiteSpace:"pre-wrap"}}>{c.notes}</p>}
    </>}</section>}
    {d&&<section><h4>Application deadline</h4><p>{d.date}{d.time?` at ${d.time}`:""} ({d.timezone}){d.offset?` UTC${d.offset}`:""}</p></section>}
  </div>;
}
