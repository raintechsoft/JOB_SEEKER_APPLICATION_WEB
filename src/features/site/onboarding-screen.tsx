"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { parseSkills } from "@/lib/utils/text";
import { useServiceAction, useServiceQuery } from "@/hooks/use-services";
import { toast } from "@/stores/toast-store";
import { useUiStore } from "@/stores/ui-store";
import { Icon } from "@/components/ui/icon";
import { Avatar, Button, Tags } from "@/components/ui/primitives";
import { TextAreaField, TextField } from "@/components/ui/field";

const HEADINGS = ["Let’s start with your story.", "Bring your experience with you.", "The things you bring to the table.", "Ready for your next chapter?"];
const SUBTITLES = ["A few introductions", "CV review", "Skills & background", "One last look"];

export function OnboardingScreen() {
  const run = useServiceAction();
  const router = useRouter();
  const { role, step, cvName, cvParsed } = useUiStore((s) => s.onboarding);
  const setOnboarding = useUiStore((s) => s.setOnboarding);
  const { data: profile } = useServiceQuery(["profile"], (s) => s.profile.getProfile());
  const { data: company } = useServiceQuery(["company", "home"], (s) => s.workspace.getHomeCompany());
  const recruiter = role === "recruiter";
  if (!profile || !company) return <main id="main" className="onboarding" />;
  const p = profile.person;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) || "").trim();
    if (recruiter) {
      await run((s) => s.onboarding.completeRecruiterOnboarding({ recruiter: get("recruiter"), email: get("email"), name: get("name"), title: get("title"), website: get("website"), interests: get("interests") }));
      router.push("/recruiter/dashboard");
      toast("Your demo recruiter workspace is ready.");
      return;
    }
    const input = {
      ...(["name", "headline", "location", "experience", "education", "interests"] as const).reduce<Record<string, string>>((acc, k) => (f.has(k) ? { ...acc, [k]: get(k) } : acc), {}),
      ...(f.has("years") ? { years: Number(get("years")) } : {}),
      ...(f.has("skills") ? { skills: parseSkills(get("skills")) } : {}),
    };
    if (step === 3) {
      await run((s) => s.onboarding.saveProfessionalStep({ ...input, public: f.has("public"), complete: true }));
      router.push("/app/dashboard");
      toast("Your story is ready. Make it yours.");
      return;
    }
    await run((s) => s.onboarding.saveProfessionalStep(input));
    setOnboarding({ step: step + 1 });
    window.scrollTo(0, 0);
  };

  const parseCv = async () => {
    if (cvParsed) {
      toast("Sample information is ready to edit below.");
      return;
    }
    await run((s) => s.onboarding.loadSampleCv());
    setOnboarding({ cvParsed: true });
    toast("Sample CV information loaded. This is simulated parsing.");
  };

  return (
    <main id="main" className="onboarding">
      <span className="eyebrow">MAKE YOURSELF AT HOME</span>
      <h1 style={{ marginTop: 14 }}>{recruiter ? "Let’s meet your team." : HEADINGS[step]}</h1>
      <p className="muted small" style={{ marginTop: 10 }}>
        {recruiter ? "Create your recruiter workspace." : "Step " + (step + 1) + " of 4 · " + SUBTITLES[step]}
      </p>
      <div className="steps">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i <= step ? "active" : ""} />
        ))}
      </div>
      <form id="onboarding-form" className="card stack" onSubmit={submit} key={role + step + String(cvParsed)}>
        {recruiter ? (
          <>
            <div className="grid cols2">
              <TextField label="Full name" name="recruiter" defaultValue={company.recruiter} required />
              <TextField label="Work email" name="email" type="email" defaultValue={company.email} required />
              <TextField label="Company name" name="name" defaultValue={company.name} required />
              <TextField label="Job title" name="title" defaultValue={company.title} required />
              <TextField label="Company website" name="website" type="url" defaultValue={company.website} />
              <TextField label="Hiring interests" name="interests" defaultValue={company.interests} />
            </div>
            <p className="notice">Your company starts as Not verified. Verification in this prototype is a demo review status.</p>
          </>
        ) : step === 0 ? (
          <div className="grid cols2">
            <TextField label="Full name" name="name" defaultValue={p.name} required minLength={2} />
            <TextField label="Professional headline" name="headline" defaultValue={p.headline} required />
            <TextField label="Location" name="location" defaultValue={p.location} required />
            <TextField label="Current role" name="currentRole" defaultValue={p.headline} required />
            <TextField label="Years of experience" name="years" type="number" defaultValue={p.years} min={0} max={60} required />
          </div>
        ) : step === 1 ? (
          <>
            <div className="upload-zone">
              <Icon name="upload" />
              <h3 style={{ marginTop: 13 }}>Your experience is a good starting point.</h3>
              <p>Select a PDF or Word CV, up to 5 MB.</p>
              <input
                type="file"
                id="cv-file"
                accept=".pdf,.doc,.docx"
                aria-label="Select your CV"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && (!/\.(pdf|docx?)$/i.test(file.name) || file.size > 5 * 1024 * 1024)) {
                    e.target.value = "";
                    toast("Choose a PDF or Word document smaller than 5 MB.");
                    return;
                  }
                  setOnboarding({ cvName: file?.name || "" });
                }}
              />
              <p id="cv-status">{cvName ? "Selected: " + cvName + " · Local only" : "No file selected. You can also continue without a CV."}</p>
            </div>
            <p className="notice">Simulated CV parsing: the file stays on your device. We use sample information, not extracted content. Review and edit it below before continuing.</p>
            <Button icon="spark" onClick={parseCv}>
              {cvParsed ? "Sample information loaded" : "Load sample CV information"}
            </Button>
            <div id="cv-review" className="grid cols2">
              <TextField label="Skills (comma separated)" name="skills" defaultValue={p.skills.join(", ")} />
              <TextField label="Experience" name="experience" defaultValue={p.experience} />
              <TextField label="Education" name="education" defaultValue={p.education} />
            </div>
          </>
        ) : step === 2 ? (
          <div className="grid cols2">
            <TextField label="Skills (comma separated)" name="skills" defaultValue={p.skills.join(", ")} required />
            <TextField label="Career interests" name="interests" defaultValue={p.interests} />
            <TextAreaField label="Experience" name="experience" defaultValue={p.experience} required />
            <TextAreaField label="Education" name="education" defaultValue={p.education} required />
          </div>
        ) : (
          <>
            <div className="row">
              <Avatar person={p} size="lg" />
              <div>
                <h2>{p.name}</h2>
                <p className="small muted">
                  {p.headline} · {p.location}
                </p>
              </div>
            </div>
            <Tags items={p.skills} />
            <p className="small muted">{p.experience}</p>
            <label className="check-row">
              <input name="public" type="checkbox" defaultChecked={p.public} />
              Make my professional profile visible in the demo directory
            </label>
            <p className="notice">This is a local prototype setting. It does not create secure access controls. Your profile and updates are stored in this browser.</p>
          </>
        )}
        <div className="form-actions">
          {!recruiter && step > 0 && <Button onClick={() => setOnboarding({ step: Math.max(0, step - 1) })}>Back</Button>}
          <button className="btn primary" type="submit">
            {recruiter ? "Create recruiter workspace" : step === 3 ? "Enter my workspace" : "Save & continue"} <Icon name="arrow" />
          </button>
        </div>
      </form>
    </main>
  );
}
