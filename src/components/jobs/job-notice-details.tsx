import type { NoticeV2 } from "@/lib/validation/job-v2";

/** The notice date is a calendar date, so format it in UTC to avoid shifting it a day. */
const formatDay = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

/** Recruitment-notice details for candidates. Information only; nothing here gates an application. */
export function JobNoticeDetails({ notice }: { notice?: NoticeV2 | null }) {
  if (!notice) return null;
  const rows = ([
    ["Applications open on", notice.opensOn ? formatDay(notice.opensOn) : ""],
    ["Age limit", notice.ageLimit],
    ["Application fee", notice.applicationFee],
    ["Selection process", notice.selectionProcess],
    ["Documents required", notice.documents],
  ] as [string, string][]).filter(([, value]) => value);
  if (!rows.length && !notice.noticeUrl) return null;
  return (
    <section className="job-sheet-section job-notice-details">
      <h4>Recruitment notice details</h4>
      {rows.map(([label, value]) => (
        <p key={label}>
          <strong>{label}:</strong> {value}
        </p>
      ))}
      {notice.noticeUrl && (
        <p>
          <a href={notice.noticeUrl} target="_blank" rel="noopener noreferrer nofollow">
            View official notification
          </a>
        </p>
      )}
    </section>
  );
}
