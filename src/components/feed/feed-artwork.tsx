"use client";

import type { CSSProperties } from "react";
import type { FeedEntry } from "@/services/feed/feed.service";
import { safeUrl } from "@/lib/utils/url";
import { Icon } from "@/components/ui/icon";
import { ProjectArt } from "@/components/work/project-art";
import { PostCarousel } from "./post-carousel";

/** Seeded Sunday Studio brand presentation. */
function BrandArt() {
  return (
    <div className="feed-brand-art" role="img" aria-label="Sunday Studio brand identity presentation in warm terracotta, cream, and yellow">
      <div className="brand-canvas-left">
        <span>AN IDENTITY WITH A LITTLE SOUL.</span>
        <strong>
          sunday
          <br />
          studio<span>®</span>
        </strong>
        <p>
          Good things.
          <br />
          Made together.
        </p>
      </div>
      <div className="brand-canvas-right">
        <div className="brand-sun">
          {Array.from({ length: 12 }, (_, i) => (
            <i key={i} style={{ "--r": `${i * 30}deg` } as CSSProperties} />
          ))}
          <span />
        </div>
        <div className="brand-color-dots">
          <i />
          <i />
          <i />
        </div>
        <small>
          A fresh perspective.
          <br />A familiar warmth.
        </small>
      </div>
    </div>
  );
}

/** Seeded accessible component library preview. */
function CodeArt() {
  return (
    <div className="feed-code-art" role="img" aria-label="Accessible components preview with keyboard navigation states">
      <div className="code-art-top">
        <span>
          <i />
          <i />
          <i />
        </span>
        <small>components / button.tsx</small>
      </div>
      <div className="code-art-content">
        <div>
          <span className="code-eyebrow">BUILT FOR EVERYONE.</span>
          <h3>
            The little details.
            <br />
            The bigger difference.
          </h3>
          <p>Keyboard first. People always.</p>
        </div>
        <div className="code-component-preview">
          <span>COMPONENT STATES</span>
          <div>
            Continue <Icon name="arrow" />
          </div>
          <div className="code-focused">
            Continue <Icon name="arrow" />
            <small>Tab ↵</small>
          </div>
          <div>
            Continue <Icon name="arrow" />
          </div>
        </div>
      </div>
      <div className="code-art-bottom">
        <span>
          <Icon name="check" /> Accessible by design
        </span>
        <span>React · TypeScript · Care</span>
      </div>
    </div>
  );
}

/** Media for posts and updates (prototype `feedArtwork`). */
export function FeedArtwork({ entry, onViewProject }: { entry: FeedEntry; onViewProject: (id: string) => void }) {
  if (entry.attachments?.length) return <PostCarousel items={entry.attachments} id={entry.id} />;
  if (entry.video) {
    const url = safeUrl(entry.video);
    return url ? (
      <figure className="feed-video">
        <video controls playsInline preload="metadata" aria-label={entry.title} src={url} />
      </figure>
    ) : null;
  }
  if (entry.image)
    return (
      <figure className="feed-upload">
        {/* eslint-disable-next-line @next/next/no-img-element -- uploaded data URL */}
        <img src={entry.image} alt={entry.imageAlt || entry.title} loading="lazy" />
      </figure>
    );
  if (entry.media === "brand") return <BrandArt />;
  if (entry.media === "code") return <CodeArt />;
  const project = entry.project;
  return project ? (
    <button type="button" className="feed-project-visual" aria-label={"Open " + project.title} onClick={() => onViewProject(project.id)}>
      <ProjectArt project={project} />
    </button>
  ) : null;
}
