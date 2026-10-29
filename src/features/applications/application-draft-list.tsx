"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { useQueryClient } from "@tanstack/react-query";
import { useServiceQuery, useServices } from "@/hooks/use-services";
import { Button, EmptyState, IconButton, LinkButton } from "@/components/ui/primitives";
import { QueryFeedback } from "@/components/ui/query-view";
import { CompanyAvatar } from "@/components/jobs/job-visuals";
import { errorMessage } from "@/services/api/client";
import { applicationWizardPath } from "@/lib/domain/application-wizard";
import { confirmAction } from "@/components/ui/feedback";
import { toast } from "@/stores/toast-store";
import { APPLICATION_WIZARD_RULES } from "@/lib/validation/application-wizard";

const PAGE_SIZE = APPLICATION_WIZARD_RULES.limits.pageSize;
const stepLabel = (step: string) =>
  APPLICATION_WIZARD_RULES.labels[
    (APPLICATION_WIZARD_RULES.steps as readonly string[]).indexOf(step)
  ] ?? (step === "review" ? "Review" : "Started");

/** First page of drafts, shared with the sidebar count so both read one cached request. */
export function useApplicationDraftPage(page = 1, enabled = true) {
  return useServiceQuery(
    ["application-drafts", page],
    (s) => s.applicationWizard.list({ page, pageSize: PAGE_SIZE }),
    {
      enabled,
      keepPreviousData: false,
      refetchOnWindowFocus: "always",
      staleTime: 0,
    },
  );
}

/** Draft applications in the Job Tracker, styled like the saved opportunities table. */
export function ApplicationDraftList() {
  const [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const { applicationWizard } = useServices();
  const cache = useQueryClient();
  const query = useApplicationDraftPage(page);
  const data = query.data;
  if (!data)
    return (
      <QueryFeedback
        data={data}
        error={query.isError}
        retry={query.refetch}
        label="Loading draft applications"
      />
    );
  if (!data.total)
    return (
      <EmptyState
        title="No draft applications."
        description="Applications you start and save without submitting appear here, ready to finish."
        action={
          <LinkButton href="/app/jobs" variant="primary" icon="search">
            Explore jobs
          </LinkButton>
        }
      />
    );
  const discard = (draft: (typeof data.items)[number]) =>
    confirmAction(
      "Discard draft?",
      "This removes the saved draft. Your submitted applications and saved profile resume are kept.",
      async () => {
        setPending(true);
        setError("");
        try {
          await applicationWizard.discard(draft.id, {
            schemaVersion: 2,
            version: draft.version,
          });
          await cache.invalidateQueries({ queryKey: ["application-drafts"] });
          toast("Draft discarded.");
        } catch (e) {
          setError(errorMessage(e));
        } finally {
          setPending(false);
        }
      },
      "Discard draft",
    );
  return (
    <div className="saved-opportunities application-drafts">
      {error && (
        <p className="saved-opportunities-error" role="alert">
          {error}
        </p>
      )}
      <table
        className="saved-opportunities-table"
        aria-label="Draft applications"
      >
        <thead>
          <tr>
            <th scope="col">Jobs</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((draft) => (
            <tr key={draft.id} data-draft={draft.id}>
              <td>
                <div className="saved-opportunity-job">
                  <CompanyAvatar
                    company={{
                      id: draft.jobId,
                      name: draft.companyName,
                      logoUrl: "",
                      confidential: false,
                    }}
                  />
                  <div className="saved-opportunity-copy">
                    <a
                      className="saved-opportunity-title"
                      href={applicationWizardPath(
                        draft.jobId,
                        "/app/applications?tab=drafts",
                      )}
                    >
                      {draft.title}
                    </a>
                    <p>
                      {draft.companyName} · Next step: {stepLabel(draft.step)}
                    </p>
                    <time dateTime={draft.savedAt}>
                      Saved {new Date(draft.savedAt).toLocaleDateString()} ·
                      Expires {new Date(draft.expiresAt).toLocaleDateString()}
                    </time>
                  </div>
                </div>
              </td>
              <td className="saved-opportunity-action application-draft-actions">
                {/* Same pill as Apply/Edit in the saved and alert lists. */}
                <Link
                  className="saved-opportunity-apply"
                  href={applicationWizardPath(
                    draft.jobId,
                    "/app/applications?tab=drafts",
                  )}
                  aria-label={"Resume application for " + draft.title}
                >
                  <Icon name="arrowUp" />
                  <span className="button-label">Continue</span>
                </Link>
                <IconButton
                  icon="trash"
                  extra="row-delete"
                  label={"Discard draft for " + draft.title}
                  disabled={pending}
                  onClick={() => discard(draft)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.total > PAGE_SIZE && (
        <div className="application-draft-pages">
          <Button
            variant="text sm"
            disabled={page <= 1}
            onClick={() => setPage((n) => n - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {Math.ceil(data.total / PAGE_SIZE)}
          </span>
          <Button
            variant="text sm"
            disabled={page * PAGE_SIZE >= data.total}
            onClick={() => setPage((n) => n + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
