import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { PORTRAITS } from "@/mocks/data/professionals";
import { cn, initials } from "@/lib/utils/text";
import { Icon, type IconName } from "./icon";
import { MediaImage } from "./media-image";
import { InfoBadge } from "./info-badge";
export { Button, IconButton } from "./button";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand" href={href} aria-label={href === "/" ? "Skillora home" : "Skillora workspace"}>
      <span className="brandmark">
        <svg viewBox="0 0 32 36" aria-hidden="true">
          <path d="M19 1 5 16l8 5-7 14 22-20-10-5 7-9z" />
        </svg>
      </span>
      skillora<span style={{ color: "var(--accent)", marginLeft: -7 }}>.</span>
    </Link>
  );
}

export interface AvatarPerson {
  id?: string;
  name: string;
  picture?: string;
  color?: string;
}

const avatarColors = ["#246b53", "#345d9d", "#6b4aa0", "#9b3e65", "#9a4d29", "#3f6875", "#6e5c2d", "#744f7d"];

function avatarBackground(person: AvatarPerson) {
  // Account identity keeps the color stable across renders, sizes, and name changes.
  const identity = person.id || person.name.trim().replace(/\s+/gu, " ").toLowerCase();
  let hash = 0;
  for (const character of identity) hash = (Math.imul(hash, 31) + character.codePointAt(0)!) >>> 0;
  return avatarColors[hash % avatarColors.length];
}

export const avatarSource = (person: AvatarPerson) => person.picture ?? (person.id ? PORTRAITS[person.id] : undefined);

export function Avatar({ person, size = "" }: { person: AvatarPerson; size?: "" | "lg" | "xl" }) {
  const portrait = avatarSource(person);
  const letters = initials(person.name) || "?";
  return (
    <span className={cn("avatar", size)} style={{ background: avatarBackground(person), color: "#fff" }} aria-label={person.name}>
      {portrait ? (
        <MediaImage src={portrait} alt={`${person.name}’s profile picture`} loading={size === "xl" ? "eager" : "lazy"} fallback={letters} />
      ) : (
        letters
      )}
    </span>
  );
}

type LinkButtonProps = Omit<ComponentProps<typeof Link>, "className"> & { variant?: string; icon?: IconName };

export function LinkButton({ variant = "", icon, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={cn("btn", variant)} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </Link>
  );
}

export function Tags({ items }: { items: string[] }) {
  return (
    <div className="row wrap gap8">
      {items.map((x, i) => (
        <span className="tag" key={x + i}>
          {x}
        </span>
      ))}
    </div>
  );
}

export function Badge({ children, tone = "green", style }: { children: ReactNode; tone?: "green" | "purple"; style?: React.CSSProperties }) {
  return (
    <span className={cn("tag", tone)} style={style}>
      <span className="dot" />
      {children}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: ReactNode; description: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name="folder" />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function PageHeading({ title, subtitle, actions }: { title: ReactNode; subtitle: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions && <div className="row gap8 wrap">{actions}</div>}
    </div>
  );
}

export function Notice({ children, style, className }: { children: ReactNode; style?: React.CSSProperties; className?: string }) {
  return <InfoBadge style={style} className={className}>{children}</InfoBadge>;
}
