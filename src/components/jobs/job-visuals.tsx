import type { CompanySummary } from "@/types/api";
import type { JobMedia, JobThumbnail } from "@/types/domain";
import { JOB_THUMBNAIL_TEMPLATES } from "@/lib/domain/jobs";
import { isInlineImage, safeVideoUrl } from "@/lib/utils/url";
import { Icon } from "@/components/ui/icon";

export function CompanyAvatar({ company }: { company: CompanySummary }) {
  if (company.confidential)
    return (
      <span className="company-avatar" aria-label="Confidential company">
        <Icon name="building" />
      </span>
    );
  if (company.logoUrl)
    return (
      <span className={"company-avatar company-" + company.id}>
        {/* eslint-disable-next-line @next/next/no-img-element -- uploaded logo data URL */}
        <img src={company.logoUrl} alt={company.name + " logo"} />
      </span>
    );
  return (
    <span className={"company-avatar company-" + company.id} aria-label={company.name}>
      {company.id === "c0" ? <Icon name="spark" /> : company.id === "c1" ? "m." : company.id === "c2" ? "f." : company.name.trim().slice(0,1).toUpperCase()}
    </span>
  );
}

export interface JobVisualData {
  title: string;
  companyName: string;
  location?: string;
  arrangement?: string;
  thumbnail?: JobThumbnail;
  jobMedia?: JobMedia;
}

/** Hiring announcement thumbnail: an uploaded image or one of four templates (prototype `jobArtwork`). */
export function JobArtwork({ job }: { job: JobVisualData }) {
  const thumb = job.thumbnail;
  if (!thumb) return null;
  if (thumb.image && isInlineImage(thumb.image))
    return (
      <figure className="job-thumbnail-upload">
        {/* eslint-disable-next-line @next/next/no-img-element -- uploaded thumbnail data URL */}
        <img src={thumb.image} alt={thumb.alt || job.title} loading="lazy" />
      </figure>
    );
  if (thumb.template === "none") return null;
  const template = JOB_THUMBNAIL_TEMPLATES.some((t) => t.id === thumb.template) ? thumb.template : "cobalt";
  return (
    <div className={"job-thumbnail job-thumbnail-" + template} role="img" aria-label={thumb.alt || "Hiring announcement for " + job.title}>
      <div className="job-thumbnail-copy">
        <span className="job-thumbnail-company">{job.companyName}</span>
        <span className="job-thumbnail-label">WE’RE HIRING</span>
        <strong>{thumb.headline || job.title || "Your next chapter starts here."}</strong>
        <p>
          {job.location || "Good work starts with good people."} {job.arrangement ? "· " + job.arrangement : ""}
        </p>
      </div>
      <div className="job-thumbnail-shape" aria-hidden="true">
        <Icon name={template === "sage" ? "spark" : template === "graphite" ? "arrowUp" : template === "lavender" ? "star" : "briefcase"} />
      </div>
    </div>
  );
}

const SAFE_FILE = /^data:(image\/(png|jpeg|webp)|application\/pdf|video\/(mp4|webm));base64,/;

/** Supporting video and downloadable files attached to a job. */
export function JobMediaExtras({ job }: { job: JobVisualData }) {
  const media = job.jobMedia;
  if (!media) return null;
  const video = safeVideoUrl(media.video);
  const files = (media.files || []).filter((f) => SAFE_FILE.test(f.data || ""));
  if (!video && !files.length) return null;
  return (
    <div className="job-media-extras">
      {video && <video className="job-media-video" src={video} controls playsInline preload="metadata" aria-label={"Video about " + job.title} />}
      {files.map((f) =>
        f.type?.startsWith("video/") ? (
          <video key={f.id} className="job-media-video" src={f.data} controls playsInline preload="metadata" aria-label={f.name} />
        ) : (
          <a key={f.id} className="job-media-file" href={f.data} download={f.name}>
            <Icon name={f.type?.startsWith("image/") ? "image" : "file"} />
            <span>{f.name}</span>
            <Icon name="download" />
          </a>
        ),
      )}
    </div>
  );
}
