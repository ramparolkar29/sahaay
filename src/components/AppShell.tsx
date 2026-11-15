import type { ReactNode } from "react";
import type { AppContext } from "@/lib/auth";
import { logoutAction } from "@/app/actions";
import { AccessibilityMenu } from "./AccessibilityMenu";
import { Avatar, Brand } from "./Brand";
import { Icon, type IconName } from "./Icon";
import { NavLink } from "./NavLink";

const NAV: Array<{ href: string; label: string; shortLabel: string; icon: IconName }> = [
  { href: "/dashboard", label: "Today", shortLabel: "Today", icon: "home" },
  { href: "/medicines", label: "Medicines", shortLabel: "Meds", icon: "pill" },
  { href: "/appointments", label: "Appointments", shortLabel: "Visits", icon: "calendar" },
  { href: "/team", label: "Care team", shortLabel: "Team", icon: "users" },
  { href: "/outbox", label: "Reminders", shortLabel: "Alerts", icon: "mail" },
  { href: "/activity", label: "Activity", shortLabel: "Log", icon: "pulse" },
];

const MOBILE_NAV = NAV.filter((item) => item.href !== "/activity");

const ROLE_LABEL: Record<string, string> = {
  elder: "Elder · profile owner",
  caretaker: "Caretaker",
  family: "Family member",
};

export function AppShell({ ctx, children }: { ctx: AppContext; children: ReactNode }) {
  const { member, circle } = ctx;
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <aside className="sidebar">
        <Brand subtitle={circle.name} />
        <nav className="nav" aria-label="Main navigation">
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
          ))}
        </nav>
        <div className="sidebar-foot">
          <AccessibilityMenu />
          <div className="who">
            <Avatar name={member.name} />
            <div className="grow">
              <div className="who-name">{member.name}</div>
              <div className="who-role">{ROLE_LABEL[member.role] ?? member.role}</div>
            </div>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-quiet btn-block">
              <Icon name="logout" size={17} />
              Lock &amp; sign out
            </button>
          </form>
        </div>
      </aside>

      <header className="mobile-top">
        <Brand subtitle={circle.name} />
        <div className="row" style={{ gap: 6 }}>
          <AccessibilityMenu />
          <form action={logoutAction}>
            <button type="submit" className="btn btn-sm btn-quiet" aria-label="Lock and sign out">
              <Icon name="logout" size={18} />
            </button>
          </form>
        </div>
      </header>

      <main id="main" className="main">
        {children}
      </main>

      <nav className="mobile-nav" aria-label="Main navigation">
        {MOBILE_NAV.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} shortLabel={item.shortLabel} icon={item.icon} variant="mobile" />
        ))}
      </nav>
    </div>
  );
}
