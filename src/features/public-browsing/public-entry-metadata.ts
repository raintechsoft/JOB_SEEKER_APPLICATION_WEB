import type { Metadata } from "next";
import type { PublicFeedEntry } from "@/services/public-browsing/public-browsing.service";

export const PUBLIC_ENTRY_DESCRIPTION_MAX = 200;

function excerpt(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > PUBLIC_ENTRY_DESCRIPTION_MAX ? clean.slice(0, PUBLIC_ENTRY_DESCRIPTION_MAX - 1).trimEnd() + "…" : clean;
}

/**
 * Open Graph / Twitter metadata for a public entry page, so links pasted into WhatsApp, LinkedIn,
 * Slack or X unfurl with the author, title, excerpt and first image. Only public entries reach this
 * page, so nothing private is ever described. Images go through /public-media/{asset}, which the API
 * still gates to currently public content.
 */
export function publicEntryMetadata(entry: PublicFeedEntry, siteOrigin: string): Metadata {
  const who = entry.author?.name ?? entry.company?.name ?? "";
  const kind = entry.kind === "job" ? "Job" : entry.kind === "update" ? "Work update" : "Post";
  const title = entry.title.trim() || (who ? `${kind} by ${who}` : `${kind} on Skillora`);
  const description = excerpt(entry.body) || (who ? `${who} on Skillora.` : "Shared on Skillora.");
  const image = entry.media.find((file) => file.kind === "image") ?? null;
  const picture = entry.author?.picture ?? entry.company?.logo ?? null;
  // Served through the site's public-media proxy: crawlers carry no session or first-party Referer.
  const imageUrl = image ? new URL(`/public-media/${image.id}`, siteOrigin).toString() : picture ? new URL(`/public-media/${picture.id}`, siteOrigin).toString() : undefined;
  const url = new URL(entry.path, siteOrigin).toString();
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: "Skillora",
      title: who ? `${who}: ${title}` : title,
      description,
      ...(imageUrl ? { images: [{ url: imageUrl, alt: image?.alt || who || "Skillora" }] } : {}),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}
