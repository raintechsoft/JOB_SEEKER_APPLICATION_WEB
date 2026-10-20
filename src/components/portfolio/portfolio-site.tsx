"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { PortfolioView } from "@/services/portfolio/portfolio.service";
import { initials } from "@/lib/utils/text";
import { Icon } from "@/components/ui/icon";
import { Avatar, Badge, Button, EmptyState, Tags } from "@/components/ui/primitives";
import { ProjectCard } from "@/components/work/project-card";
import { UpdateItem } from "@/components/work/pulse";
import { useContactCandidate } from "@/features/talent/dialogs";
import { hasPublicCredentials, PublicCredentials } from "./public-credentials";

/** A professional's portfolio site, rendered from their saved section settings (prototype `portfolio()`). */
export function PortfolioSite({ view, builder = false }: { view: PortfolioView; builder?: boolean }) {
  const { person: p, config: cfg, projects, updates } = view;
  const contact = useContactCandidate();
  const section = (name: string) => {
    switch (name) {
      case "Introduction":
        return (
          <header className="portfolio-intro" key={name}>
            <div className="row">
              <Avatar person={p} size="lg" />
              <span className="eyebrow" style={{ fontSize: 8, color: "var(--portfolio-accent)" }}>
                {cfg.headline}
              </span>
            </div>
            <h1>
              Thoughtful work.
              <br />
              <span>A little more human.</span>
            </h1>
            <p>
              I’m {p.name}. {p.summary}
            </p>
            <div className="row" style={{ marginTop: 23 }}>
              <Badge>{p.available ? "Open to opportunities" : "Open to connections"}</Badge>
              {!builder && (
                <Button variant="text" icon="arrowUp" onClick={() => contact(p.id)}>
                  Get in touch
                </Button>
              )}
            </div>
          </header>
        );
      case "About":
        return (
          <section className="portfolio-section" key={name}>
            <h2>A little about me</h2>
            <p>{p.summary}</p>
          </section>
        );
      case "Skills & expertise":
        return (
          <section className="portfolio-section" key={name}>
            <h2>Skills & expertise</h2>
            <Tags items={p.skills} />
          </section>
        );
      case "Featured projects":
        return (
          <section className="portfolio-section" key={name}>
            <div className="row between" style={{ marginBottom: 18 }}>
              <h2 style={{ margin: 0 }}>Selected work</h2>
              <span className="small muted">A few things I’ve helped bring to life.</span>
            </div>
            <div className="grid cols2">{projects.length ? projects.map((pr) => <ProjectCard key={pr.id} project={pr} compact />) : <EmptyState title="A new chapter is coming" description="Featured public projects will appear here." />}</div>
          </section>
        );
      case "Experience":
        return (
          <section className="portfolio-section" key={name}>
            <h2>Where I’ve been</h2>
            <p>{p.experience}</p>
          </section>
        );
      case "Work updates":
        return (
          <section className="portfolio-section" key={name}>
            <h2>Notes from the process</h2>
            {updates.length ? updates.map((u) => <UpdateItem key={u.id} update={u} />) : <p>No public work updates yet.</p>}
          </section>
        );
      case "Education":
        return (
          <section className="portfolio-section" key={name}>
            <h2>Always learning</h2>
            <p>{p.education}</p>
          </section>
        );
      case "Accomplishments":
        return (
          <section className="portfolio-section" key={name}>
            <h2>More of my professional story</h2>
            {hasPublicCredentials(p.credentials, false) ? <PublicCredentials credentials={p.credentials} includeContact={false} /> : <p>No public accomplishments selected.</p>}
          </section>
        );
      case "Contact":
        return (
          <section className="portfolio-section" key={name}>
            <h2>Have something in mind?</h2>
            <p>Let’s make something thoughtful together.</p>
            <div className="row wrap" style={{ marginTop: 15 }}>
              {p.credentials.contact.email ? (
                <a className="btn" href={"mailto:" + p.credentials.contact.email}>
                  <Icon name="mail" />
                  Say hello
                </a>
              ) : builder ? (
                <span className="tag">Contact through Skillora</span>
              ) : (
                <Button icon="message" onClick={() => contact(p.id)}>
                  Connect through Skillora
                </Button>
              )}
              {p.credentials.contact.phone && <span className="tag">{p.credentials.contact.phone}</span>}
              {p.website && (
                <a className="btn text" href={p.website} target="_blank" rel="noopener">
                  Website <Icon name="arrowUp" />
                </a>
              )}
            </div>
          </section>
        );
      default:
        return null;
    }
  };
  return (
    <article className="portfolio-site" style={{ "--portfolio-accent": cfg.theme } as CSSProperties}>
      <nav className="portfolio-nav">
        <Link href={"/professionals/" + p.slug} className="monogram">
          {initials(p.name)}.
        </Link>
        <div className="row gap24">
          <span>{cfg.title}</span>
          <span>{p.available ? "Available for select opportunities" : "Let’s connect"}</span>
        </div>
      </nav>
      <div className="portfolio-content">
        {cfg.sections.filter((s) => s.visible).map((s) => section(s.name))}
        <p className="small muted" style={{ fontSize: 9, marginTop: 24 }}>
          Built with Skillora · Fictional professional · Interactive portfolio prototype
        </p>
      </div>
    </article>
  );
}
