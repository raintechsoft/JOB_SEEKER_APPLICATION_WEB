import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { PORTRAITS } from "@/mocks/data/professionals";
import { cn, initials } from "@/lib/utils/text";
import { Icon, type IconName } from "./icon";

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Skillora home">
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

export function Avatar({ person, size = "" }: { person: AvatarPerson; size?: "" | "lg" | "xl" }) {
  const portrait = person.picture || (person.id ? PORTRAITS[person.id] : undefined);
  return (
    <span className={cn("avatar", size)} style={{ background: person.color || "#e6e0f4" }} aria-label={person.name}>
      {portrait ? (
        // eslint-disable-next-line @next/next/no-img-element -- portraits are local SVGs or user-uploaded data URLs
        <img src={portrait} alt={`${person.name}’s illustrated profile picture`} />
      ) : (
        initials(person.name)
      )}
    </span>
  );
}

type ButtonProps = Omit<ComponentProps<"button">, "className"> & { variant?: string; icon?: IconName; className?: string };

/** Prototype `btn(label, action, type, icon)`: `.btn` plus variant classes (`primary`, `sm`, `text`, `danger`). */
export function Button({ variant = "", icon, children, type = "button", className, ...rest }: ButtonProps) {
  return (
    <button type={type} className={cn("btn", variant, className)} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
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

type IconButtonProps = Omit<ComponentProps<"button">, "className" | "children"> & { icon: IconName; label: string; extra?: string };

export function IconButton({ icon, label, extra, type = "button", ...rest }: IconButtonProps) {
  return (
    <button type={type} className={cn("iconbtn", extra)} aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </button>
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
  return (
    <p className={cn("notice", className)} style={style}>
      {children}
    </p>
  );
}
