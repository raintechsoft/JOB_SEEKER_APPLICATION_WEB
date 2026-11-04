"use client";

import { useRef, useState } from "react";
import { useDismissableDetails } from "@/hooks/use-dismissable";
import { useAuthAction } from "@/features/auth/use-auth-action";
import { useFormAction } from "@/hooks/use-form-action";
import { Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { SelectField, TextAreaField } from "@/components/ui/field";
import { reportSchema } from "@/lib/validation/communication";
import type { Role } from "@/types/domain";
import { modal } from "@/stores/modal-store";
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
  "inbox",
  "messages",
  "candidate",
  "recruiter",
  "organization",
  "public-browsing",
];

function ProfileReportForm({
  role,
  targetId,
  name,
  kind,
}: {
  role: Role;
  targetId: string;
  name: string;
  kind: "person" | "organization";
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { execute, pending } = useFormAction(setErrors);
  const organization = kind === "organization";
  return (
    <form
      className="stack"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        setErrors({});
        const fields = new FormData(event.currentTarget);
        const value = reportSchema.safeParse({
          reason: String(fields.get("reason") || ""),
          details: String(fields.get("details") || ""),
        });
        if (!value.success) {
          setErrors(
            Object.fromEntries(
              value.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
            ),
          );
          return;
        }
        if (
          !(await execute(
            (s) =>
              organization
                ? s.feed.reportOrganization(role, targetId, value.data.reason, value.data.details)
                : s.feed.reportPerson(role, targetId, value.data.reason, value.data.details),
            { invalidate: invalidates },
          ))
        ) {
          return;
        }
        modal.close();
        toast(organization ? "Organization reported for review." : "Profile reported for review.");
      }}
    >
      <p>
        {organization ? `Report ${name}. Your report is private.` : `Report ${name}’s profile. Your report is private.`}
      </p>
      {errors._form ? (
        <p className="error" role="alert">
          {errors._form}
        </p>
      ) : null}
      <SelectField
        required
        label="Reason"
        name="reason"
        options={[
          "Spam or unwanted messages",
          "Harassment",
          "Misleading job or identity",
          "Other",
        ]}
        defaultValue="Spam or unwanted messages"
        error={errors.reason}
        disabled={pending}
      />
      <TextAreaField
        label="Additional details"
        name="details"
        maxLength={1500}
        error={errors.details}
        disabled={pending}
      />
      <div className="modal-footer">
        <Button onClick={() => modal.close()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          Submit report
        </Button>
      </div>
    </form>
  );
}

/** Top-right ⋮ menu on someone else’s public person or organization profile: Report and Block. */
export function PublicProfileSafetyMenu({
  id,
  name,
  kind = "person",
}: {
  id: string;
  name: string;
  kind?: "person" | "organization";
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useDismissableDetails(ref, { closeOnAction: true });
  const gate = useAuthAction();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { execute, pending } = useFormAction(setErrors);
  const organization = kind === "organization";

  return (
    <div className="public-profile-safety">
      <details className="activity-post-menu public-profile-safety-menu" ref={ref}>
        <summary aria-label={`More actions for ${name}`}>
          <Icon name="more" />
        </summary>
        <div className="activity-post-menu-items">
          <Button
            variant="text sm"
            icon="flag"
            disabled={pending}
            aria-haspopup="dialog"
            onClick={(event) =>
              void gate.run(
                "report",
                (context) => {
                  modal.show(
                    organization ? "Report organization" : "Report profile",
                    <ProfileReportForm role={context.role} targetId={id} name={name} kind={kind} />,
                  );
                },
                { anchor: event.currentTarget, target: { kind: organization ? "company" : "person", id } },
              )
            }
          >
            Report
          </Button>
          <Button
            variant="text sm"
            icon="ban"
            disabled={pending}
            aria-haspopup="dialog"
            onClick={(event) =>
              void gate.run(
                "block",
                async (context) => {
                  setErrors({});
                  if (
                    !(await execute(
                      (s) =>
                        organization
                          ? s.feed.blockOrganization(context.role, id)
                          : s.feed.blockPerson(context.role, id),
                      { invalidate: invalidates },
                    ))
                  ) {
                    return;
                  }
                  toast(
                    organization
                      ? `Blocked ${name}. You can unblock this organization from Settings.`
                      : `Blocked ${name}. You can unblock this account from Settings.`,
                  );
                },
                { anchor: event.currentTarget, target: { kind: organization ? "company" : "person", id } },
              )
            }
          >
            Block
          </Button>
        </div>
      </details>
      {errors._form ? (
        <p className="error public-profile-safety-error" role="alert">
          {errors._form}
        </p>
      ) : null}
    </div>
  );
}
