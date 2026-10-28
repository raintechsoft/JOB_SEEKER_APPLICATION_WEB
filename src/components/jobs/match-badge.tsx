import { InfoBadge } from "@/components/ui/info-badge";
import type { components } from "@/types/generated/api";

export type MatchBadgeData = components["schemas"]["MatchBadge"];

/**
 * "Strong match · 4 of 6 skills" from the backend's match explanation, with the reasons and missing skills
 * one tap away. It explains a fit; it never hides or ranks anything by itself.
 */
export function MatchBadge({ match, showJob = false }: { match?: MatchBadgeData | null; showJob?: boolean }) {
  if (!match) return null;
  const forJob = showJob && match.job ? ` for ${match.job.title}` : "";
  return (
    <span className={"match-badge match-" + match.level}>
      <span className="match-badge-text">
        <strong>{match.label}</strong>
        {forJob}
        {" · " + match.summary}
      </span>
      <InfoBadge label={"Why " + match.label.toLowerCase()}>
        <span className="match-badge-detail">
          {match.reasons.map((reason) => <span key={reason}>{reason}</span>)}
          {match.matchedSkills.length > 0 && <span>Matching: {match.matchedSkills.join(", ")}</span>}
          {match.missingSkills.length > 0 && <span>Missing: {match.missingSkills.join(", ")}</span>}
        </span>
      </InfoBadge>
    </span>
  );
}
