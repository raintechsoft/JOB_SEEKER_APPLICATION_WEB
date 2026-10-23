import Image from "next/image";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";
import { LinkButton } from "@/components/ui/primitives";
import { DevOnly } from "@/components/ui/dev-only";
import { HeroAvatar, HomeProjects } from "@/features/site/home-islands";

const FEATURES: [IconName, string, string][] = [
  ["user", "Your story, in one place", "Bring your experience, skills, and career interests together in a profile that reflects you."],
  ["folder", "Proof behind your skills", "Share projects and give people the context behind your ideas, decisions, and contributions."],
  ["pulse", "Progress worth sharing", "Record work updates with Work Pulse and keep a living record of what you create and learn."],
];

export default function HomePage() {
  return (
    <main id="main">
      <section className="ph-hero ph-container">
        <div className="ph-hero-copy">
          <span className="eyebrow">YOUR WORK. YOUR STORY.</span>
          <h1>
            There’s more to you
            <br />
            than a resume.
          </h1>
          <p>Your skills, your projects, your next possibility. Bring your professional story together in one place, and help the right people see what you can do.</p>
          <div className="ph-actions">
            <LinkButton href="/signup?role=professional" variant="primary" icon="arrow">
              Build your profile
            </LinkButton>
            <LinkButton href="/talent" icon="search">
              Explore talent
            </LinkButton>
          </div>
          <div className="ph-login-note">
            Already part of Skillora?{" "}
            <Link href="/login?role=professional">
              Login <Icon name="arrow" />
            </Link>
          </div>
          <div className="ph-hero-points">
            <span>
              <Icon name="folder" />
              Show your work
            </span>
            <span>
              <Icon name="pulse" />
              Share your progress
            </span>
            <span>
              <Icon name="users" />
              Make connections
            </span>
          </div>
        </div>
        <div className="ph-product" aria-label="Illustrative professional profile">
          <div className="ph-product-bar">
            <span>
              <Icon name="user" />
              Your professional story
            </span>
            <span className="ph-example">PROFILE PREVIEW</span>
          </div>
          <div className="ph-profile-cover">
            <span>GOOD WORK HAS A STORY.</span>
            <Icon name="spark" />
          </div>
          <div className="ph-profile-body">
            <div className="ph-person">
              <HeroAvatar />
              <span className="ph-available">
                <i />
                Open to opportunities
              </span>
            </div>
            <h2>Alex Morgan</h2>
            <p className="ph-job-title">Product Designer · Bengaluru</p>
            <div className="ph-skills">
              <span>Product design</span>
              <span>Figma</span>
              <span>UX research</span>
            </div>
            <div className="ph-project-preview">
              <div className="ph-project-art">
                <span>forma.</span>
                <strong>
                  A little clarity.
                  <br />A better experience.
                </strong>
                <div className="ph-art-lines">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className="ph-project-caption">
                <div>
                  <span>FEATURED PROJECT</span>
                  <h3>Making everyday work simpler</h3>
                </div>
                <Icon name="arrowUp" />
              </div>
            </div>
            <div className="ph-profile-bottom">
              <span>
                <Icon name="check" />
                Skills with context. Work you can explore.
              </span>
              <Icon name="arrow" />
            </div>
          </div>
        </div>
      </section>
      <section className="ph-foundation">
        <div className="ph-container">
          <div className="ph-section-heading">
            <span className="eyebrow">ONE CONNECTED PROFESSIONAL IDENTITY</span>
            <h2>Bring the whole picture into focus.</h2>
            <p>A place for your background, the work you’re proud of, and everything you’re learning along the way.</p>
          </div>
          <div className="ph-feature-grid">
            {FEATURES.map(([icon, title, description], i) => (
              <article className="ph-feature" key={title}>
                <div className="ph-feature-top">
                  <span>
                    <Icon name={icon} />
                  </span>
                  <small>0{i + 1}</small>
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
          <Link className="ph-text-link" href="/how-it-works">
            See how Skillora works <Icon name="arrow" />
          </Link>
        </div>
      </section>
      <section className="ph-work ph-container">
        <div className="ph-section-row">
          <div>
            <span className="eyebrow">THE WORK BEHIND THE PROFILE</span>
            <h2>Good work deserves to be seen.</h2>
            <p>Explore the projects, thinking, and craft behind a professional story.</p>
          </div>
          <LinkButton href="/talent" icon="arrowUp">
            Explore work & talent
          </LinkButton>
        </div>
        <HomeProjects />
        <DevOnly>
          <p className="ph-demo-caption">Illustrative projects from fictional professionals in this prototype.</p>
        </DevOnly>
      </section>
      <section className="ph-pathways ph-container" aria-label="Choose your Skillora workspace">
        <article className="ph-pathway">
          <div>
            <span className="eyebrow">FOR JOB SEEKERS</span>
            <h2>
              Be known for
              <br />
              what you do.
            </h2>
            <p>Build your profile, share your work, and create a portfolio that tells your story.</p>
            <LinkButton href="/signup?role=professional" variant="primary" icon="arrow">
              Create your profile
            </LinkButton>
            <Link className="ph-text-link" href="/login?role=professional">
              Job seeker login <Icon name="arrow" />
            </Link>
          </div>
          <Image src="/images/illustrations/job-seeker-journey.png" alt="" width={1227} height={1282} sizes="(max-width: 850px) 90vw, 40vw" />
        </article>
        <article className="ph-pathway">
          <div>
            <span className="eyebrow">FOR EMPLOYERS</span>
            <h2>
              Your next great hire
              <br />
              starts here.
            </h2>
            <p>Discover people through their work, manage job posts, and keep your hiring connected.</p>
            <LinkButton href="/employer/register" variant="primary" icon="arrow">
              Create employer account
            </LinkButton>
            <Link className="ph-text-link" href="/employer/login">
              Employer login <Icon name="arrow" />
            </Link>
          </div>
          <Image src="/images/illustrations/employer-hiring.png" alt="" width={1199} height={1312} sizes="(max-width: 850px) 90vw, 40vw" />
        </article>
      </section>
      <section className="ph-final ph-container">
        <div>
          <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE.</span>
          <h2>Let your work open doors.</h2>
          <p>A professional identity built around what makes you, you.</p>
        </div>
        <LinkButton href="/signup?role=professional" variant="primary" icon="arrow">
          Get started with Skillora
        </LinkButton>
      </section>
    </main>
  );
}
