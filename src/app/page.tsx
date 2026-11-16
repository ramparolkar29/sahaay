import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { getRepo } from "@/lib/store";
import { Avatar, Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";

const ROLE_LABELS: Record<string, string> = {
  elder: "Elder",
  caretaker: "Caretaker",
  family: "Family member",
};

const HERO_FACTS = [
  { icon: "users" as const, text: "One shared profile" },
  { icon: "shield" as const, text: "Passcode, not passwords" },
  { icon: "mail" as const, text: "Quiet escalations" },
];

const STEPS = [
  {
    title: "Create the circle",
    body: "Name the elder, set the time zone and choose how early reminders should arrive.",
    icon: "plus" as const,
  },
  {
    title: "Invite the family",
    body: "Share a 6-character code. Every member gets their own passcode and role.",
    icon: "users" as const,
  },
  {
    title: "Log each dose",
    body: "One tap on the shared today view keeps the whole family honest and calm.",
    icon: "check" as const,
  },
];

export default async function LandingPage() {
  const session = await readSession();
  if (session) redirect("/dashboard");

  const repo = getRepo();
  const members = repo.listMembersByCircle();
  const circles = repo
    .listCircleOverviews()
    .filter((circle) => (members.get(circle.id) ?? []).some((person) => person.isDemo));

  return (
    <div className="public-wrap landing-wrap">
      <div className="public-inner landing-inner">
        <header className="landing-top">
          <Brand subtitle="Shared care for ageing parents" />
          <span className="pill pill-accent landing-badge">
            <Icon name="sparkle" size={14} />
            PromptWars · Catalyst 2026
          </span>
        </header>

        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-copy">
            <p className="eyebrow">Elderly care, minus the chaos</p>
            <h1 className="big-title" id="landing-title">
              Medicines on time.
              <br />
              Everyone in the loop.
            </h1>
            <p className="lede">
              Sahaay keeps one calm care circle for an elderly parent — medication schedules, adherence,
              appointments and quiet email reminders, all behind a family passcode.
            </p>
            <div className="row landing-actions">
              <Link href="/setup" className="btn btn-primary btn-xl">
                Create a care circle
                <Icon name="arrow" size={18} />
              </Link>
              <Link href="/join" className="btn btn-xl">
                Join with invite code
              </Link>
            </div>
            <ul className="hero-facts" aria-label="What makes Sahaay different">
              {HERO_FACTS.map((fact) => (
                <li key={fact.text}>
                  <Icon name={fact.icon} size={17} />
                  <span>{fact.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <figure className="hero-art">
            <Image
              src="/images/hero-care.png"
              alt="An elderly mother and her daughter sorting a weekly pill box together at a sunlit table"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 520px"
              className="hero-art-img"
            />
            <div className="hero-glow" aria-hidden="true" />
            <figcaption className="hero-note hero-note-a" aria-hidden="true">
              <span className="hero-note-dot" />
              <span>
                <strong>8:00 am · Metformin</strong>
                <small>Logged by Anil</small>
              </span>
            </figcaption>
            <figcaption className="hero-note hero-note-b" aria-hidden="true">
              <span className="pill pill-due">Next in 40 min</span>
              <small>2:00 pm · Amlodipine</small>
            </figcaption>
          </figure>
        </section>

        <section className="landing-stats" aria-label="Sahaay at a glance">
          <div className="landing-stat">
            <strong>1</strong>
            <span>shared timeline for the whole family</span>
          </div>
          <div className="landing-stat">
            <strong>3</strong>
            <span>roles — elder, caretaker, family</span>
          </div>
          <div className="landing-stat">
            <strong>0</strong>
            <span>passwords to remember or share</span>
          </div>
          <div className="landing-stat">
            <strong>24/7</strong>
            <span>emergency medical details</span>
          </div>
        </section>

        <section className="landing-demo" aria-label="Try the demo">
          <div className="card demo-card">
            <div className="row-between">
              <div>
                <h2 className="h2">Demo care circles</h2>
                <p className="card-sub">Public demo profiles. Pick one, then enter its passcode.</p>
              </div>
              <span className="circle-chip">
                {circles.length} demo circle{circles.length === 1 ? "" : "s"}
              </span>
            </div>

            {circles.length === 0 ? (
              <div className="empty" style={{ marginTop: 16 }}>
                <Icon name="heart" size={26} />
                <p>No demo circle on this deployment. Create the first one in under a minute.</p>
              </div>
            ) : (
              <div className="stack" style={{ marginTop: 16 }}>
                {circles.map((circle) => (
                  <div key={circle.id} className="stack-sm">
                    <div className="row-between">
                      <h3 className="h3">{circle.name}</h3>
                      <span className="tiny muted">
                        {circle.elderName} · {circle.memberCount} member
                        {circle.memberCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <ul className="member-list">
                      {(members.get(circle.id) ?? [])
                        .filter((person) => person.isDemo)
                        .map((member) => (
                          <li key={member.id}>
                            <Link href={`/login?member=${member.id}`} className="member-row">
                              <Avatar name={member.name} />
                              <span className="grow">
                                <span className="member-name" style={{ display: "block" }}>
                                  {member.name}
                                </span>
                                <span className="member-meta">
                                  {ROLE_LABELS[member.role] ?? "Family member"} · demo profile
                                </span>
                              </span>
                              <Icon name="arrow" size={18} />
                            </Link>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            <hr className="divider" style={{ margin: "18px 0" }} />
            <p className="tiny muted">
              Demo circles ship with a week of history. Elder passcode 1234 · caretaker 2580 · family 1990.
            </p>
            <form action="/login" method="get" className="row invite-form" aria-label="Open a private care circle">
              <label className="sr-only" htmlFor="invite-code">
                Invite code
              </label>
              <input
                id="invite-code"
                name="code"
                className="input grow"
                style={{ minWidth: 180 }}
                placeholder="Your invite code"
                maxLength={6}
                pattern="[A-Za-z0-9]{6}"
                autoComplete="off"
                autoCapitalize="characters"
                required
              />
              <button className="btn nowrap">Open your circle</button>
            </form>
            <p className="tiny muted">Real care circles are not listed here — a 6-character invite code is the only way in.</p>
          </div>

          <aside className="landing-aside">
            <figure className="aside-art">
              <Image
                src="/images/evening-care.png"
                alt="A bedside table with a weekly pill organiser, water, reading glasses and a softly glowing phone"
                fill
                sizes="(max-width: 900px) 100vw, 420px"
                className="aside-art-img"
              />
            </figure>
            <div className="card aside-card">
              <p className="eyebrow">Built elder-first</p>
              <h2 className="h2">Large buttons. Plain words. No clutter.</h2>
              <ul className="check-list">
                <li>
                  <Icon name="check" size={16} />
                  <span>4–8 digit passcode instead of a password</span>
                </li>
                <li>
                  <Icon name="check" size={16} />
                  <span>High-contrast text and a larger-type toggle</span>
                </li>
                <li>
                  <Icon name="check" size={16} />
                  <span>One simple “today” screen for the elder</span>
                </li>
              </ul>
            </div>
          </aside>
        </section>

        <section className="landing-steps" aria-labelledby="steps-title">
          <div className="row-between">
            <h2 className="h2" id="steps-title">
              One circle, three steps
            </h2>
            <span className="tiny muted">Under a minute to set up</span>
          </div>
          <div className="grid grid-3">
            {STEPS.map((step, index) => (
              <article key={step.title} className="landing-step">
                <span className="landing-step-num" aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className="card-title">
                  <span className="row" style={{ gap: 8 }}>
                    <Icon name={step.icon} size={17} />
                    {step.title}
                  </span>
                </h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="landing-footer">
          <span className="tiny muted">Built solo for CATALYST 2026.</span>
          <span className="tiny muted">Demo passcodes: elder 1234 · caretaker 2580 · family 1990</span>
        </footer>
      </div>
    </div>
  );
}
