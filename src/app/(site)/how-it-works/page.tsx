import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/primitives";
import { DevOnly } from "@/components/ui/dev-only";
import { devCopy } from "@/lib/env/app-env";
import { PulseCard,IllustrativePulse } from "@/components/work/pulse";
import {apiConfig} from "@/services/api/config";

export const metadata: Metadata = { title: "how it works" };

const STEPS: [string, string, string, string, string][] = [
  ["01", "Build your foundation.", devCopy("Start with your professional story. Add your skills and experience, or select a CV and review sample details in the onboarding demo.", "Start with your professional story. Add your skills and experience, or start from your CV and review the details."), "/signup", "Create your profile"],
  ["02", "Keep a living record.", "Share a project, a learning, or a small breakthrough. Your work updates build a chronological story, visualized in Work Pulse.", "/app/updates", "Record your work"],
  ["03", "Give your work a home.", "Choose your featured projects, arrange your sections, and make a portfolio that reflects your professional identity.", "/app/portfolio", "Try the portfolio builder"],
];

const RECRUITER_POINTS: [string, string][] = [
  ["Search with context", devCopy("Search by skills, titles, names, and project keywords. Narrow the sample directory by location, experience, and recorded activity.", "Search by skills, titles, names, and project keywords. Narrow the directory by location, experience, and recorded activity.")],
  ["Explore the evidence", "Read profiles, explore projects and portfolios, and compare candidates side by side using understandable information."],
  ["Keep the connection", devCopy("Save candidates to named shortlists and start a local demo conversation. The same shared data connects both workspaces.", "Save candidates to named shortlists and start a conversation. The same shared data connects both workspaces.")],
];

export default function HowItWorksPage() {
  return (
    <main id="main">
      <section className="section" style={{ borderTop: 0 }}>
        <div className="container">
          <div className="center">
            <span className="eyebrow">A LITTLE MORE OF THE WHOLE PICTURE.</span>
            <h1 style={{ fontSize: 48, margin: "20px auto", maxWidth: 750 }}>
              From what’s on your resume
              <br />
              to what you bring to the world.
            </h1>
            <p className="sub" style={{ margin: "0 auto" }}>
              One connected space for your background, your process, and your proof of work.
            </p>
          </div>
          <div className="grid cols3" style={{ marginTop: 50 }}>
            {STEPS.map(([n, title, description, href, label]) => (
              <article className="step" key={n}>
                <div className="step-num">{n}</div>
                <h3>{title}</h3>
                <p>{description}</p>
                <div style={{ marginTop: 20 }}>
                  <LinkButton href={href} variant="text" icon="arrow">
                    {label}
                  </LinkButton>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="section soft">
        <div className="container split-section">
          <div>
            <span className="eyebrow">THE THINKING BEHIND THE WORK</span>
            <h2>Progress has a place here.</h2>
            <p className="sub">Work Pulse is a date-based view of the updates recorded on Skillora. Select a day to read its notes. Explore the ideas, questions, and contributions behind the final result.</p>
            <p className="notice" style={{ marginTop: 25 }}>
              Recorded activity is never a productivity score. It does not verify work quality, hours, or employment status.
            </p>
          </div>
          {apiConfig.dataSource==="mock"?<PulseCard ownerId="p0" days={182} />:<IllustrativePulse/>}
        </div>
      </section>
      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">FOR THE PEOPLE FINDING PEOPLE</span>
              <h2>Discover. Understand. Connect.</h2>
            </div>
            <DevOnly>
              <LinkButton href="/recruiter/dashboard" variant="primary" icon="arrow">
                Enter recruiter demo
              </LinkButton>
            </DevOnly>
          </div>
          <div className="grid cols3">
            {RECRUITER_POINTS.map(([title, description]) => (
              <article className="card" key={title}>
                <h3>{title}</h3>
                <p className="small muted" style={{ marginTop: 15 }}>
                  {description}
                </p>
              </article>
            ))}
          </div>
          <DevOnly>
            <p className="notice" style={{ marginTop: 25 }}>
              This prototype uses fictional professionals and companies. Authentication, CV parsing, messages, analytics, OTP, and link expiry demonstrate intended behavior and are not production services.
            </p>
          </DevOnly>
        </div>
      </section>
    </main>
  );
}
