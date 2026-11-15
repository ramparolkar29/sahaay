"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

export function NavLink({
  href,
  label,
  shortLabel,
  icon,
  variant = "sidebar",
}: {
  href: string;
  label: string;
  shortLabel?: string;
  icon: IconName;
  variant?: "sidebar" | "mobile";
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  if (variant === "mobile") {
    return (
      <Link href={href} aria-current={active ? "page" : undefined}>
        <Icon name={icon} size={21} />
        <span>{shortLabel ?? label}</span>
      </Link>
    );
  }
  return (
    <Link href={href} className="nav-link" aria-current={active ? "page" : undefined}>
      <Icon name={icon} size={19} />
      <span>{label}</span>
    </Link>
  );
}
