import { Fragment } from "react";
import type { PublicCredentials as Credentials } from "@/services/talent/public-profile";
import { Icon } from "@/components/ui/icon";

export function hasPublicCredentials(c: Credentials, includeContact = true) {
  return c.groups.length > 0 || c.breaks.length > 0 || (includeContact && !!(c.contact.email || c.contact.phone));
}

/** Public accomplishments, career context and opted-in contact details (prototype `publicCredentials`). */
export function PublicCredentials({ credentials: c, includeContact = true }: { credentials: Credentials; includeContact?: boolean }) {
  if (!hasPublicCredentials(c, includeContact)) return null;
  return (
    <div className="profile-public-credentials">
      {c.groups.map((g) => (
        <article key={g.label}>
          <h3>{g.label}</h3>
          {g.records.map((r, i) => (
            <Fragment key={r.title + i}>
              <p>
                <strong>{r.title}</strong>
                {r.source ? " · " + r.source : ""}
              </p>
              {r.description && <p>{r.description}</p>}
              {r.url && (
                <a href={r.url} target="_blank" rel="noopener">
                  {r.linkLabel || r.url} <Icon name="external" />
                </a>
              )}
            </Fragment>
          ))}
        </article>
      ))}
      {c.breaks.map((b, i) => (
        <article key={"break" + i}>
          <h3>Career context</h3>
          <p>
            {b.start} — {b.current ? "Ongoing" : b.end}
          </p>
          <p>{b.description}</p>
        </article>
      ))}
      {includeContact && (c.contact.email || c.contact.phone) && (
        <article>
          <h3>Professional contact</h3>
          {c.contact.email && <p>{c.contact.email}</p>}
          {c.contact.phone && <p>{c.contact.phone}</p>}
        </article>
      )}
    </div>
  );
}
