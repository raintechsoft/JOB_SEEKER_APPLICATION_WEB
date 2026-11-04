"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";

export function SettingsLinkCard({ href, icon, title, description }: { href: string; icon: IconName; title: string; description: string }) {
  return (
    <Link href={href} className="settings-link-card">
      <Icon name={icon} />
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <Icon name="chevron" />
    </Link>
  );
}
