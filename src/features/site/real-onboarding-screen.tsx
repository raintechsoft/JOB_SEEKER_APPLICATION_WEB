"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useServiceQuery } from "@/hooks/use-services";
import { useFormAction } from "@/hooks/use-form-action";
import { onboardingSchema } from "@/lib/validation/onboarding";
import { validateMedia, validationFields } from "@/lib/validation/profile";
import { FileDrop } from "@/components/ui/file-drop";
import { Avatar, Button, LinkButton, Tags } from "@/components/ui/primitives";
import { StatePanel } from "@/components/ui/state-panel";
import { ErrorState } from "@/components/ui/state-views";
import { TextAreaField, TextField } from "@/components/ui/field";
import { ScreenFallback } from "@/components/ui/feedback";

const HEADINGS = ["Let’s start with your story.", "Bring your experience with you.", "The things you bring to the table.", "Ready for your next chapter?"];

export function RealOnboardingScreen() {
  const session = useServiceQuery(["auth", "session"], (s) => s.auth.me());
  const professional = session.data?.workspaces.some((w) => w.kind === "professional");
  const profile = useServiceQuery(["profile"], (s) => s.profile.getProfile(), { enabled: !!professional });
  const [stage, setStage] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const { execute, pending } = useFormAction(setErrors);
  const cache = useQueryClient();
  const router = useRouter();
  if (session.isError) return <main id="main" className="onboarding"><ErrorState error={session.error} onRetry={() => session.refetch()} title="We couldn’t check your account" description="Something interrupted the request. Please try again." /></main>;
  if (!session.data) return <ScreenFallback layout="form" label="Loading your account" />;
  if (!session.data.user.email_verified) return <main id="main" className="onboarding"><StatePanel icon="mail" tone="info" title="Verify your email to continue" description="Confirm your email address with a 6-digit code, then come back here to set up your profile." actions={<LinkButton href="/verify-email" variant="primary" icon="mail">Verify email</LinkButton>} /></main>;
  if (!professional) return <main id="main" className="onboarding"><StatePanel icon="building" tone="info" title="Let’s meet your team" description="Your organization account is ready. Complete its company profile to introduce your team." actions={<LinkButton href="/recruiter/company" variant="primary">Complete company profile</LinkButton>} /></main>;
  if (profile.isError) return <main id="main" className="onboarding"><ErrorState error={profile.error} onRetry={() => profile.refetch()} title="Your profile couldn’t load" description="Something interrupted the request. Please try again." /></main>;
  if (!profile.data) return <ScreenFallback layout="form" label="Loading your profile" />;
  const view = profile.data;
  const p = view.person;
  const step = stage ?? Math.min(view.onboardingStep ?? 0, 3);
  return <main id="main" className="onboarding">
    <span className="eyebrow">MAKE YOURSELF AT HOME</span><h1 style={{ marginTop: 14 }}>{HEADINGS[step]}</h1>
    <p className="muted small">Step {step + 1} of 4</p>
    <div className="steps">{[0, 1, 2, 3].map((i) => <span key={i} className={i <= step ? "active" : ""} />)}</div>
    <form key={step} id="onboarding-form" className="card stack" noValidate onSubmit={async (event) => {
      event.preventDefault();
      if (pending || uploading) return;
      const form = new FormData(event.currentTarget);
      const input: Record<string, unknown> = Object.fromEntries(form);
      if (step === 2) input.skills = String(input.skills ?? "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
      if (step === 3) input.public = form.has("public");
      const parsed = onboardingSchema(step).safeParse(input);
      if (!parsed.success) { setErrors(validationFields(parsed.error)); return; }
      setErrors({});
      const ok = await execute(async (services) => {
        const saved = await services.onboarding.saveStage(step, parsed.data, view.version!);
        cache.setQueryData(["profile"], saved);
      });
      if (!ok) return;
      if (step === 3) router.push("/app/profile");
      else setStage(step + 1);
    }}>
      <fieldset className="stack" disabled={pending || uploading}>
        {step === 0 ? <div className="grid cols2">
          <TextField label="Full name" name="name" defaultValue={p.name} error={errors.name} required maxLength={100} />
          <TextField label="Professional headline" name="headline" defaultValue={p.headline} error={errors.headline} required maxLength={200} />
          <TextField label="Location" name="location" defaultValue={p.location} error={errors.location} required maxLength={200} />
          <TextField label="Years of experience" name="years" type="number" defaultValue={p.years} error={errors.years} min={0} max={60} step={0.1} required />
        </div> : step === 1 ? <div className="onboarding-cv-upload">
          <h3>Your experience is a good starting point.</h3>
          <p className="muted small">You can continue without uploading.</p>
          <FileDrop
            id="onboarding-cv"
            section="onboarding"
            use="cv"
            label="Onboarding CV"
            prompt="Drop your CV here"
            promptHint="or choose a PDF, Word, or RTF file"
            buttonLabel="Choose CV"
            changeLabel="Replace CV"
            icon="file"
            accept=".pdf,.doc,.docx,.rtf"
            disabled={uploading}
            invalid={!!errors.resume}
            fileName={uploading ? "Uploading…" : view.details.resume?.name}
            hint="PDF, Word, or RTF · up to 2 MB"
            describedBy={view.details.resume ? "onboarding-cv-status" : undefined}
            onFiles={async (files) => {
              const file = files?.[0];
              if (!file) return;
              const error = validateMedia(file, "resume");
              if (error) { setErrors({ resume: error }); return; }
              setUploading(true); setErrors({});
              try {
                const ok = await execute(async (services) => {
                  const result = await services.profile.uploadResume(file);
                  if (!result.ok) throw new Error(result.error);
                });
                if (ok) await cache.invalidateQueries({ queryKey: ["profile"] });
              } finally {
                setUploading(false);
              }
            }}
          />
          {view.details.resume && <p id="onboarding-cv-status" role="status">{view.details.resume.name} uploaded.</p>}
          <p className="small muted">Resume parsing is not available. Review and enter your background in the next step.</p>
        </div> : step === 2 ? <div className="stack">
          <TextAreaField label="Key skills (comma separated)" name="skills" defaultValue={p.skills.join(", ")} error={errors.skills} required maxLength={3000} />
          <TextAreaField label="Experience" name="experience" defaultValue={p.experience} error={errors.experience} required maxLength={2500} />
          <TextAreaField label="Education" name="education" defaultValue={p.education} error={errors.education} required maxLength={2500} />
          <TextAreaField label="Professional interests" name="interests" defaultValue={p.interests} error={errors.interests} maxLength={2000} />
        </div> : <>
          <div className="row"><Avatar person={p} size="lg" /><div><h2>{p.name}</h2><p>{p.headline} · {p.location}</p></div></div>
          <Tags items={p.skills} /><p>{p.experience}</p>
          <label className="check-row"><input type="checkbox" name="public" defaultChecked={p.public} />Make my professional profile visible in the talent directory</label>
        </>}
      </fieldset>
      {(errors._form || errors.resume) && <p role="alert" className="error">{errors._form || errors.resume}</p>}
      <div className="form-actions">{step > 0 && <Button disabled={pending || uploading} onClick={() => { setErrors({}); setStage(step - 1); }}>Back</Button>}
        <Button type="submit" variant="primary" loading={pending} loadingLabel="Saving your progress" disabled={pending || uploading}>{step === 3 ? "Enter my workspace" : "Save & continue"}</Button>
      </div>
    </form>
  </main>;
}
