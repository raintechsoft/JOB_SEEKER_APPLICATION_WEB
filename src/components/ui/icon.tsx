import { cn } from "@/lib/utils/text";

/** Stroke icon set from the prototype (24×24, stroke-width via CSS `.icon`). */
const PATHS = {
  arrow: "M5 12h14m-6-6 6 6-6 6",
  arrowUp: "M7 17 17 7M7 7h10v10",
  chevron: "m9 5 7 7-7 7",
  down: "m6 9 6 6 6-6",
  up: "m6 15 6-6 6 6",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  home: "m3 10 9-7 9 7v10H3z M9 20v-7h6v7",
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  user: "M20 21v-2a7 7 0 0 0-14 0v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  users: "M16 21v-2a5 5 0 0 0-10 0v2 M11 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M18 3a4 4 0 0 1 0 8 M22 21v-2a5 5 0 0 0-4-4",
  pulse: "M2 12h5l3-8 4 16 3-8h5",
  edit: "m16 3 5 5-12 12-6 1 1-6z M14 5l5 5",
  folder: "M3 7V4h7l2 3h9v13H3z",
  layout: "M3 3h18v18H3z M3 9h18M9 9v12",
  message: "M21 15a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 2h6l1 4 4 1 2 5-3 3 1 4-5 3-3-3-4 1-3-5 3-3-1-4 4-1z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
  search: "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15 M16 16l5 5",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  eyeOff: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M3 3l18 18",
  link: "m10 13 4-4 M8 16l-2 2a4 4 0 0 1-5-5l5-5a4 4 0 0 1 5 0 M16 8l2-2a4 4 0 0 1 5 5l-5 5a4 4 0 0 1-5 0",
  copy: "M8 8h13v13H8z M16 8V3H3v13h5",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  briefcase: "M3 7h18v14H3z M8 7V3h8v4 M3 12h18 M10 12v3h4v-3",
  location: "M12 22s8-7 8-13a8 8 0 0 0-16 0c0 6 8 13 8 13 M12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  calendar: "M3 5h18v16H3z M3 10h18 M7 2v6 M17 2v6",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2",
  logout: "M9 3H3v18h6 M10 12h11m-5-5 5 5-5 5",
  menu: "M3 6h18M3 12h18M3 18h18",
  sliders: "M3 6h18M3 18h18M8 3v6M16 15v6",
  star: "m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z",
  trash: "M3 6h18 M8 6V3h8v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
  external: "M14 3h7v7M21 3 11 13 M10 3H3v18h18v-7",
  send: "m22 2-7 20-4-9-9-4z M22 2 11 13",
  file: "M5 2h9l5 5v15H5z M14 2v6h5 M8 12h8 M8 16h8",
  upload: "M12 16V3m-5 5 5-5 5 5 M3 15v6h18v-6",
  shield: "m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6z m-5 10 3 3 6-6",
  compare: "M3 3v18M21 3v18 M7 6h10M7 12h10M7 18h10",
  building: "M4 21V3h12v18 M16 9h5v12H2 M8 7h4M8 11h4M8 15h4M9 21v-3h2v3",
  spark: "m12 2 2 7 8 3-8 2-2 8-3-8-7-2 7-3z",
  help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5 M12 17h.01",
  monitor: "M2 3h20v14H2z M8 22h8M12 17v5",
  phone: "M7 2h10v20H7z M11 18h2",
  download: "M12 3v13m-5-5 5 5 5-5M3 17v4h18v-4",
  mail: "M2 4h20v16H2z m0 0 10 9L22 4",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M3 12h18 M12 3c-6 6-6 12 0 18 6-6 6-12 0-18",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  refresh: "M20 7V3m0 4h-4 M4 17v4m0-4h4 M20 7a8 8 0 0 0-13-3L4 7 M4 17a8 8 0 0 0 13 3l3-3",
  repost: "m3 7 4-4 4 4 M7 3v13a3 3 0 0 0 3 3h3 M21 17l-4 4-4-4 M17 21V8a3 3 0 0 0-3-3h-3",
  paperclip: "M21 11 12 20a6 6 0 0 1-8-8L14 2a4 4 0 0 1 6 6L10 18a2 2 0 0 1-3-3L17 5",
  like: "M7 10h-4v11h4z M7 10l5-8c3 0 3 3 2 7h6c2 0 2 2 1 5l-2 7H7z",
  image: "M3 3h18v18H3z M3 17l6-6 4 4 3-3 5 5 M16 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4",
  camera: "M3 6h4l2-3h6l2 3h4v15H3z M12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  rotate: "M3 10a9 9 0 1 1 2 8 M3 3v7h7",
  flip: "M12 3v3m0 3v3m0 3v3m0 3v1 M3 7l5 5-5 5z M21 7l-5 5 5 5z",
  pin: "M8 3h8l-1 7 4 4H5l4-4z M12 14v8",
  userMinus: "M17 8h6 M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M3 21v-2a7 7 0 0 1 14 0v2",
  ban: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M6 6l12 12",
  flag: "M4 22V3 M4 4c5-4 10 4 16 0v11c-6 4-11-4-16 0",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={cn("icon", className)} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.spark} />
    </svg>
  );
}

const FEED_OUTLINES = {
  like: "M3.7 22.2c3.1-1.2 5.8-2.9 6.6-3.8 1.1-3.9 2.3-5.1 4.6-7.5 1.7-1.8 2.2-3.2 2.7-5.2.4-1.6 1.2-2.1 2-1.4 1.7 1.3 1.8 4.4-.3 7.8m-.9.3c2.5-.8 6.2-1.2 7.6-.6 2.1.9 1.8 3.3-.6 4.1l-3.1.8m3.3-.8c3-.2 3.6 3.3.5 4.2l-3.3.7m3.2-.7c2.9.4 2.6 3.1-.4 3.9l-2.8.7m2.6-.7c1.6 2.8-2.6 3.5-6 3.4-3.1-.1-4.6-.5-7 .3-1.3.4-3.3 1.3-5.2 2.3",
  comment: "M8.2 8.5h15.6c1.6 0 2.7 1.2 2.7 2.7v9c0 1.5-1.1 2.7-2.7 2.7H14l-6.8 4v-4.2c-1.1-.4-1.7-1.3-1.7-2.5v-9c0-1.5 1.1-2.7 2.7-2.7z M10.5 14h11 M10.5 18h7.5",
  share: "M5.7 16.2 26.4 5.8l-5.5 21.1-5.1-8.6-10.1-2.1z M15.8 18.3 26.4 5.8",
  save: "M10 6.8h12c.8 0 1.5.7 1.5 1.5v19L16 22.6l-7.5 4.7v-19c0-.8.7-1.5 1.5-1.5z",
  repost: "m4 10 5-5 5 5 M9 5v16c0 2 1 3 3 3h5 M28 22l-5 5-5-5 M23 27V11c0-2-1-3-3-3h-5",
} as const;

/** 32×32 feed action icons with a hover surface. */
export function FeedActionIcon({ name }: { name: keyof typeof FEED_OUTLINES }) {
  return (
    <svg className="icon feed-action-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle className="feed-icon-surface" cx="16" cy="16" r="14.4" />
      <path className="feed-action-stroke" d={FEED_OUTLINES[name]} />
      {name === "like" && <path className="feed-action-stroke feed-like-rays" d="m10 7.5-1.7-2.8 M6.6 10.4 4.3 8.6 M24.4 6.7l1.8-2 M26.2 10l2.7-1.2" />}
    </svg>
  );
}
