import { MediaImage } from "@/components/ui/media-image";
import { Fragment } from "react";
import { cn } from "@/lib/utils/text";

const NAMES = ["forma.", "orbit", "SUNDAY", "meridian", "studio."];
const HEADLINES = [
  ["A little clarity.", "A lot of possibility."],
  ["Make room for", "what matters."],
  ["Ideas, shaped", "with intention."],
  ["See the bigger", "picture."],
  ["Good things", "start here."],
];

export interface ProjectArtData {
  title: string;
  art?: number;
  cover?: string;
}

/** Illustrative project artwork, or the uploaded cover (prototype `art()`). */
export function ProjectArt({ project, className }: { project: ProjectArtData; className?: string }) {
  if (project.cover) {
    return (
      <div className={cn("art", className)}>
        <MediaImage src={project.cover} alt={project.title} loading="lazy" />
      </div>
    );
  }
  const n = project.art ?? 0;
  return (
    <div className={cn("art", "art-" + n, className)} role="img" aria-label={"Illustrative preview of " + project.title}>
      <div className="art-window">
        <div className="art-nav">
          {NAMES[n]}
          <span>{"Overview   Work   About"}</span>
        </div>
        <h4>
          {HEADLINES[n].map((line, i) => (
            <Fragment key={line}>
              {i > 0 && <br />}
              {line}
            </Fragment>
          ))}
        </h4>
        <div className="art-bars">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}
