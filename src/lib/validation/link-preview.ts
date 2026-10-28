import { z } from "zod";
import contract from "../../../contracts/validation/link-preview.json";

export const linkPreviewContract = contract;

/** Server-fetched metadata for one public URL. `url` is the navigation destination. */
export interface LinkPreview {
  url: string;
  canonicalUrl: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  domain: string;
}

export interface FoundLink {
  /** Exact text from the post, sent to Laravel so both sides normalize the same characters. */
  raw: string;
  /** Client-side identity for de-duplication, dismissal and stale-response checks. */
  key: string;
  start: number;
  end: number;
}

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"]+/giu;
const TRAILING = ".,;:!?'\"*_~>]}";
const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain", "metadata", "metadata.google.internal", "metadata.goog", "instance-data", "kubernetes.default", "kubernetes.default.svc"]);
const BLOCKED_SUFFIXES = [".localhost", ".local", ".localdomain", ".internal", ".intranet", ".corp", ".home", ".lan", ".arpa", ".test", ".invalid", ".example", ".onion", ".svc"];
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;

/** Mirrors PublicHttpUrl::trimTrailing: prose punctuation is not part of the link; balanced ")" is. */
export function trimTrailing(raw: string): string {
  let value = raw;
  for (;;) {
    const last = value.slice(-1);
    if (last && TRAILING.includes(last)) value = value.slice(0, -1);
    else if (last === ")" && value.split(")").length > value.split("(").length) value = value.slice(0, -1);
    else return value;
  }
}

function privateIpv4(host: string) {
  const parts = host.split(".").map(Number);
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
}

/**
 * Returns the comparison key for a public http(s) URL, or null. Laravel repeats these checks
 * and additionally resolves DNS; this only keeps obviously unsafe text out of requests and links.
 */
export function normalizeLinkUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw.length > contract.urlMax || /[\s\\\u0000-\u001f\u007f]/u.test(raw) || !/^https?:\/\//i.test(raw)) return null;
  const authority = raw.replace(/^https?:\/\//i, "").split(/[/?#]/, 1)[0];
  if (authority.includes("@")) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
  const host = url.hostname.replace(/\.$/, "").toLowerCase();
  if (host.startsWith("[")) {
    const v6 = host.slice(1, -1);
    if (!/^[23]/.test(v6) || /^2001:0?db8:/.test(v6) || /^2002:/.test(v6)) return null;
  } else if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (privateIpv4(host)) return null;
  } else if (BLOCKED_HOSTS.has(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix)) || !HOSTNAME.test(host) || /^[0-9.]+$|^0x/.test(host)) {
    return null;
  }
  return `${url.protocol}//${url.host.toLowerCase()}${url.pathname || "/"}${url.search}`;
}

/** Public http(s) links in text order, one entry per distinct destination. */
export function findLinks(text: string): FoundLink[] {
  const found: FoundLink[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = trimTrailing(match[0]);
    const key = normalizeLinkUrl(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    found.push({ raw, key, start: match.index, end: match.index + raw.length });
  }
  return found;
}

/** A link is complete once a delimiter follows it; the URL being typed at the end of the text is not. */
export function isCompleteLink(text: string, link: FoundLink): boolean {
  return link.end < text.length || text.slice(link.start).trim() !== text.slice(link.start);
}

export type TextSegment = { text: string; href?: string };

/** Splits text into plain and link segments. Every occurrence of a safe URL becomes a link. */
export function linkSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = trimTrailing(match[0]);
    if (!normalizeLinkUrl(raw)) continue;
    if (match.index > cursor) segments.push({ text: text.slice(cursor, match.index) });
    segments.push({ text: raw, href: raw });
    cursor = match.index + raw.length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

/** Truncation point at or after `limit` that never splits a URL. */
export function linkSafeCut(text: string, limit: number): number {
  for (const match of text.matchAll(URL_PATTERN)) {
    const end = match.index + trimTrailing(match[0]).length;
    if (match.index < limit && end > limit) return end;
    if (match.index >= limit) break;
  }
  return limit;
}

const httpUrl = (max: number) => z.string().max(max).refine((v) => normalizeLinkUrl(v) !== null);
const optionalText = (max: number) => z.string().max(max).nullable().catch(null);

/** Strict response validation: unsafe image URLs degrade to no thumbnail, an unsafe destination to no preview. */
export const linkPreviewSchema = z.object({
  url: httpUrl(contract.urlMax),
  canonicalUrl: httpUrl(contract.urlMax).nullable().catch(null),
  title: optionalText(contract.titleMax),
  description: optionalText(contract.descriptionMax),
  imageUrl: httpUrl(contract.imageUrlMax).nullable().catch(null),
  siteName: optionalText(contract.siteNameMax),
  domain: z.string().min(1).max(contract.domainMax),
});

export const linkPreviewRequestSchema = z
  .string()
  .trim()
  .max(contract.urlMax, "Use a shorter link.")
  .refine((v) => normalizeLinkUrl(v) !== null, "Enter a public HTTP or HTTPS link.");

/** Preview URL sent with a post: empty, or a valid link that still appears in the body. */
export function previewUrlInBody(previewUrl: string, body: string): boolean {
  if (!previewUrl) return true;
  const key = normalizeLinkUrl(previewUrl);
  return !!key && findLinks(body).some((link) => link.key === key);
}
