"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useServices, useServiceQuery } from "@/hooks/use-services";
import { Button, LinkButton } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { InfoBadge } from "@/components/ui/info-badge";
import { ApplicationDocumentsStep } from "@/components/applications/application-documents-step";
import { applicationReturnPath } from "@/lib/domain/application-wizard";
import {
  APPLICATION_WIZARD_RULES,
  applicationStepSchema,
  applicationWizardDraftValuesSchema,
} from "@/lib/validation/application-wizard";
import { ApiError, errorMessage } from "@/services/api/client";
import { modal, useModalStore } from "@/stores/modal-store";
import { ApplicationWizardSkeleton } from "./application-wizard-skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/stores/toast-store";
import { ApplicationSubmissionReview } from "./application-submission-review";
import {
  applicationWizardEnabled,
  type ApplicationContext,
  type DocumentContext,
} from "./application-wizard-policy";
import { useApplicationEditor } from "./use-application-editor";
import {
  ApplicationContactFields,
  ApplicationDetailsFields,
  ApplicationQuestionFields,
} from "./application-fields";
import { useApplicationNavigation } from "./application-navigation";
import { ApplicationExitDialog } from "./application-exit-dialog";

function ApplicationUnavailable({
  returnTo,
  message = "This opportunity is not accepting applications.",
}: {
  returnTo: string;
  message?: string;
}) {
  return (
    <section className="card stack">
      <h1>Application unavailable</h1>
      <p>{message}</p>
      <LinkButton href={returnTo}>Back to opportunities</LinkButton>
    </section>
  );
}
/** No receipt page for now: confirm with a toast and return to My applications. */
function ExistingApplication({ submitted = false }: { submitted?: boolean }) {
  const router = useRouter();
  const cache = useQueryClient();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void cache.invalidateQueries({ queryKey: ["applications"] });
    void cache.invalidateQueries({ queryKey: ["application-drafts"] });
    toast(submitted ? "Application submitted." : "You have already applied to this job.");
    router.replace("/app/applications");
  }, [cache, router, submitted]);
  return <ApplicationWizardSkeleton />;
}

export function ApplicationWizardScreen({ jobId }: { jobId: string }) {
  const params = useSearchParams();
  const session = useServiceQuery(["auth", "session"], (s) => s.auth.me());
  const target = applicationReturnPath(params.get("returnTo") ?? undefined);
  if (!applicationWizardEnabled())
    return (
      <ApplicationUnavailable
        returnTo={`/jobs/${jobId}`}
        message="Continue your application from the job details."
      />
    );
  if (!session.data) return <ApplicationWizardSkeleton />;
  const identity = session.data.workspaces.find(
    (w) => w.id === session.data.selected_identity_id,
  );
  if (!session.data.user.email_verified || identity?.kind !== "professional")
    return (
      <ApplicationUnavailable
        returnTo={target}
        message="Use your verified professional workspace to apply."
      />
    );
  return (
    <ApplicationWorkspace
      key={`${session.data.user.id}:${identity.id}:${jobId}`}
      jobId={jobId}
      email={session.data.user.email}
      returnTo={target}
      requested={params.get("step")}
    />
  );
}

function ApplicationWorkspace({
  jobId,
  email,
  returnTo,
  requested,
}: {
  jobId: string;
  email: string;
  returnTo: string;
  requested: string | null;
}) {
  const services = useServices();
  const [creationKey] = useState(() => crypto.randomUUID());
  const [data, setData] = useState<{
    context: ApplicationContext;
    documents: DocumentContext | null;
  } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const opening = useRef<Promise<{
    context: ApplicationContext;
    documents: DocumentContext | null;
  }> | null>(null);
  useEffect(() => {
    let live = true;
    if (!opening.current)
      opening.current = (async () => {
        let context = await services.applicationWizard.context(jobId);
        if (
          context.acceptingApplications &&
          !context.application &&
          !context.draft
        ) {
          await services.applicationWizard.create(jobId, {
            schemaVersion: 2,
            creationKey,
          });
          context = await services.applicationWizard.context(jobId);
        }
        const documents =
          context.acceptingApplications && !context.application && context.draft
            ? await services.applicationDocuments.context(context.draft.id)
            : null;
        return { context, documents };
      })();
    opening.current
      .then((value) => {
        if (live) {
          setData(value);
          setError(null);
        }
      })
      .catch((cause) => {
        if (live) setError(cause);
      });
    return () => {
      live = false;
    };
  }, [services, jobId, creationKey, attempt]);
  if (error)
    return (
      <section className="card stack">
        <h1>Application could not be opened</h1>
        <p role="alert">{errorMessage(error)}</p>
        <div className="row wrap">
          {error instanceof ApiError && error.status === 401 ? (
            <LinkButton
              href={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}
            >
              Sign in
            </LinkButton>
          ) : (
            <Button
              onClick={() => {
                opening.current = null;
                setError(null);
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </Button>
          )}
          <LinkButton href={returnTo}>Back to opportunities</LinkButton>
        </div>
      </section>
    );
  if (!data) return <ApplicationWizardSkeleton />;
  if (data.context.application)
    return <ExistingApplication />;
  if (
    !data.context.acceptingApplications ||
    !data.context.draft ||
    !data.documents
  )
    return <ApplicationUnavailable returnTo={returnTo} />;
  return (
    <ApplicationEditor
      key={data.context.draft.id}
      initial={{
        context: data.context,
        draft: data.context.draft,
        documents: data.documents,
        accountEmail: email,
        requested,
      }}
      returnTo={returnTo}
    />
  );
}

export function ApplicationEditor({
  initial,
  returnTo,
}: {
  initial: Parameters<typeof useApplicationEditor>[0];
  returnTo: string;
}) {
  const editor = useApplicationEditor(initial);
  const services = useServices();
  const router = useRouter();
  const [documentBusy, setDocumentBusy] = useState(false);
  const exitOpen = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const { context, draft, step, steps } = editor;
  const index = steps.indexOf(step),
    reached = editor.changed
      ? 0
      : Math.max(0, steps.indexOf(draft.reachedStep));
  const busy = editor.working || editor.saving || documentBusy;
  const leave = useApplicationNavigation({
    dirty: editor.dirty,
    busy,
    onStep: (requested) => {
      const parsed = applicationStepSchema.safeParse(requested);
      if (
        parsed.success &&
        steps.indexOf(parsed.data) <= reached &&
        steps.includes(parsed.data)
      )
        editor.setStep(parsed.data);
    },
    navigate: (target) => router.push(target),
    onLeave: (target) => {
      if (exitOpen.current) return;
      exitOpen.current = true;
      modal.show(
        "Leave application?",
        <ApplicationExitDialog
          save={editor.save}
          discard={editor.discardLocal}
          leave={() => leave(target)}
        />,
      );
    },
  });
  useEffect(() => {
    return useModalStore.subscribe((state) => {
      if (!state.open) exitOpen.current = false;
    });
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("step", step);
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + url.search,
    );
    const nav = document.querySelector<HTMLElement>(
      '.application-wizard nav[aria-label="Application steps"]',
    );
    const active = nav?.querySelector<HTMLElement>('[aria-current="step"]');
    if (nav && active && nav.scrollWidth > nav.clientWidth)
      nav.scrollLeft +=
        active.getBoundingClientRect().left -
        nav.getBoundingClientRect().left -
        (nav.clientWidth - active.offsetWidth) / 2;
    heading.current?.focus({ preventScroll: true });
  }, [step]);
  useEffect(() => {
    document.title = `Apply for ${context.title} · Skillora`;
  }, [context.title]);
  useEffect(() => {
    void services.media
      .policy?.()
      .catch(() =>
        editor.report({
          _form:
            "The upload policy could not be loaded. Try refreshing before choosing a file.",
        }),
      );
  }, [services.media]); // eslint-disable-line react-hooks/exhaustive-deps
  async function saveAndExit() {
    if (await editor.save()) leave(returnTo);
  }
  if (context.application)
    return <ExistingApplication submitted />;
  if (!context.acceptingApplications)
    return <ApplicationUnavailable returnTo={returnTo} />;
  return (
    <div className="application-wizard">
      <div className="job-wizard-top">
        <div>
          <h1>Apply for {context.title}</h1>
          <p> {context.companyName && `at ${context.companyName}`}</p>
        </div>
        <Link href={returnTo} className="btn">
          Back to opportunities
        </Link>
      </div>
      <div className="job-wizard-layout">
        <aside className="card job-wizard-stepper">
          <h2>Your application</h2>
          <nav aria-label="Application steps">
            {steps.map((value, i) => (
              <button
                type="button"
                key={value}
                disabled={busy || i > reached || editor.blocked}
                aria-current={step === value ? "step" : undefined}
                className={
                  step === value ? "active" : i < reached ? "completed" : ""
                }
                onClick={() => void editor.visit(value)}
              >
                <span>{i < reached ? <Icon name="check" /> : i + 1}</span>
                <strong>
                  {value === "review"
                    ? "Review application"
                    : APPLICATION_WIZARD_RULES.labels[
                        APPLICATION_WIZARD_RULES.steps.indexOf(value)
                      ]}
                </strong>
              </button>
            ))}
          </nav>
          <div className="wizard-save-note">
            <Icon name="shield" />
            <p role="status">
              {editor.dirty ? "Unsaved changes" : "Draft saved"}
              <small>
                Last saved{" "}
                {new Date(draft.savedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </p>
          </div>
        </aside>
        <section className="card application-stage" data-step={step}>
          <div className="wizard-stage-heading">
            <div className="wizard-stage-step">
              <span>
                STEP {index + 1} OF {steps.length}
              </span>
              <InfoBadge>
                Only confirmed saves can be resumed. The application is not shared
                with the employer until submitted.
              </InfoBadge>
            </div>
            <h2 ref={heading} tabIndex={-1}>
              {step === "review"
                ? "Review application"
                : APPLICATION_WIZARD_RULES.labels[
                    APPLICATION_WIZARD_RULES.steps.indexOf(step)
                  ]}
            </h2>
          </div>
          {Object.keys(editor.errors).length > 0 && (
            <div
              className="wizard-errors application-wizard-errors"
              role="alert"
              tabIndex={-1}
            >
              <strong>Check the following details</strong>
              <ul>
                {[...new Set(Object.values(editor.errors))].map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}
          {(editor.blocked || editor.notice) && (
            <div className="application-context-notice">
              <p>
                {editor.notice ||
                  "Refresh the saved draft before continuing. Reloading replaces unsaved changes with the last saved version."}
              </p>
              {editor.blocked && (
                <Button disabled={busy} onClick={() => void editor.reload()}>
                  Reload saved draft
                </Button>
              )}
            </div>
          )}
          {editor.sessionExpired && (
            <p role="alert">
              Sign in to continue with your last saved draft.{" "}
              <Link
                href={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}
              >
                Sign in
              </Link>
            </p>
          )}
          <form
            id="application-wizard-form"
            noValidate
            onSubmit={editor.form.handleSubmit(
              () => {
                void editor.next();
              },
              () => {
                const result = applicationWizardDraftValuesSchema.safeParse(
                  editor.form.getValues(),
                );
                editor.report(
                  result.success
                    ? {
                        _form:
                          "Check the highlighted fields before continuing.",
                      }
                    : Object.fromEntries(
                        result.error.issues.map((issue) => [
                          issue.path.join(".") || "_form",
                          issue.message,
                        ]),
                      ),
                );
              },
            )}
          >
            <fieldset
              disabled={editor.working || documentBusy}
              className="application-fields"
              key={editor.resetKey}
            >
              {step === "contact" && (
                <ApplicationContactFields editor={editor} />
              )}
              {step === "documents" && (
                <ApplicationDocumentsStep
                  context={editor.documents}
                  service={services.applicationDocuments}
                  onResume={(id) => editor.selectDocument("resume", id)}
                  onPortfolio={(included) =>
                    editor.selectDocument("portfolio", included)
                  }
                  onBusyChange={setDocumentBusy}
                  beforeUpload={editor.validateLocal}
                  errors={{
                    resume: editor.errors["documents.resumeAssetId"],
                    portfolio: editor.errors["documents.includePortfolio"],
                  }}
                />
              )}
              {step === "details" && (
                <ApplicationDetailsFields
                  form={editor.form}
                  errors={editor.errors}
                  jobLocations={editor.context.locations ?? []}
                />
              )}
              {step === "questions" && (
                <ApplicationQuestionFields editor={editor} />
              )}
              {step === "review" && (
                <ApplicationSubmissionReview editor={editor} />
              )}
            </fieldset>
          </form>
        </section>
      </div>
      <footer className="job-wizard-footer">
        <div>
          <span className="wizard-footer-progress">
            {index + 1} / {steps.length}
          </span>
          <Button disabled={busy || editor.blocked} onClick={saveAndExit}>
            Save draft & exit
          </Button>
          <div className="grow" />
          {index > 0 && (
            <Button
              disabled={busy}
              onClick={() => void editor.visit(steps[index - 1])}
            >
              Back
            </Button>
          )}
          {step === "review" ? (
            <Button
              variant="primary"
              disabled={
                busy ||
                editor.blocked ||
                !editor.review ||
                !editor.acknowledgedSharing ||
                editor.dirty ||
                editor.submissionUncertain
              }
              onClick={() => void editor.submit()}
            >
              Submit application
            </Button>
          ) : (
            <Button
              type="submit"
              form="application-wizard-form"
              variant="primary"
              disabled={busy || editor.blocked}
            >
              Next
              <Icon name="arrow" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
