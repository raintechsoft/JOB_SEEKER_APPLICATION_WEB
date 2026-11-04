"use client";

import { useState, type ReactNode } from "react";
import type { Role } from "@/types/domain";
import { Avatar, Button, EmptyState } from "@/components/ui/primitives";
import { CompanyAvatar } from "@/components/jobs/job-visuals";
import { ErrorState } from "@/components/ui/state-views";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { useServiceQuery } from "@/hooks/use-services";
import { useFormAction } from "@/hooks/use-form-action";
import { toast } from "@/stores/toast-store";

const invalidates = [
  "blocked-accounts",
  "feed",
  "feed-entry",
  "feed-comments",
  "network",
  "people-search",
  "workspace-search",
  "messaging",
  "messages",
  "inbox",
  "organization",
  "public-browsing",
];

export function BlockedAccounts({ role }: { role: Role }) {
  const people = useServiceQuery(["blocked-accounts", role, "people"], (s) => s.feed.getBlocked(role));
  const organizations = useServiceQuery(["blocked-accounts", role, "organizations"], (s) =>
    s.feed.getBlockedOrganizations(role),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { execute, pending } = useFormAction(setErrors);
  const loading = (!people.data && !people.isError) || (!organizations.data && !organizations.isError);
  const failed = (people.isError && !people.data) || (organizations.isError && !organizations.data);
  const peopleRows = people.data ?? [];
  const orgRows = organizations.data ?? [];
  const empty = !loading && !failed && peopleRows.length === 0 && orgRows.length === 0;

  return (
    <div className="stack mt-3">
      {errors._form && (
        <p role="alert" className="error">
          {errors._form}
        </p>
      )}
      {failed && (
        <ErrorState
          compact
          error={people.error ?? organizations.error}
          title="Blocked accounts couldn’t load"
          description="Something interrupted the request. Please try again."
          onRetry={() => {
            void people.refetch();
            void organizations.refetch();
          }}
        />
      )}
      {loading && <ContentSkeleton label="Loading blocked accounts" />}
      {empty && (
        <EmptyState
          compact
          icon="ban"
          title="No blocked accounts"
          description="You haven’t blocked any people or organizations."
        />
      )}
      {peopleRows.length > 0 && (
        <section className="stack gap8" aria-label="Blocked people">
          <h3 className="org-public-small">People</h3>
          {peopleRows.map((target) => (
            <BlockedRow
              key={target.identityId}
              name={target.person.name}
              pending={pending}
              onUnblock={async () => {
                setErrors({});
                if (
                  await execute((s) => s.feed.unblock(role, target.identityId), {
                    invalidate: invalidates,
                  })
                ) {
                  toast("Account unblocked.");
                }
              }}
              mark={<Avatar person={target.person} />}
            />
          ))}
        </section>
      )}
      {orgRows.length > 0 && (
        <section className="stack gap8" aria-label="Blocked organizations">
          <h3 className="org-public-small">Organizations</h3>
          {orgRows.map((target) => (
            <BlockedRow
              key={target.organizationId}
              name={target.company.name}
              pending={pending}
              onUnblock={async () => {
                setErrors({});
                if (
                  await execute((s) => s.feed.unblockOrganization(role, target.organizationId), {
                    invalidate: invalidates,
                  })
                ) {
                  toast("Organization unblocked.");
                }
              }}
              mark={<CompanyAvatar company={target.company} />}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function BlockedRow({
  name,
  mark,
  pending,
  onUnblock,
}: {
  name: string;
  mark: ReactNode;
  pending: boolean;
  onUnblock: () => Promise<void>;
}) {
  return (
    <div className="row between blocked-account-row">
      <div className="row gap8 blocked-account-identity">
        {mark}
        <strong>{name}</strong>
      </div>
      <Button
        variant="sm"
        className="blocked-account-unblock"
        aria-label={`Unblock ${name}`}
        disabled={pending}
        onClick={() => void onUnblock()}
      >
        Unblock
      </Button>
    </div>
  );
}
