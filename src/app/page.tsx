import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { getRepo } from "@/lib/store";
import { Avatar, Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";

export default async function LandingPage() {
  const session = await readSession();
  if (session) redirect("/dashboard");

  const repo = getRepo();
  const members = repo.listMembersByCircle();
  const circles = repo
    .listCircleOverviews()
    .filter((circle) => (members.get(circle.id) ?? []).some((person) => person.isDemo));

  return (
    <div className="public-wrap">
      <div className="public-inner" style={{ maxWidth: 760 }}>
        <Brand subtitle="Shared care for ageing parents" />

        <div className="stack-sm">
          <p className="eyebrow">PromptWars · Catalyst</p>
          <h1 className="big-title">
            Medicines on time.
            <br />
            Everyone in the loop.
          </h1>
          <p className="lede">
            Sahaay keeps one calm care circle for an elderly parent — medication schedules, adherence, appointments
            and quiet email reminders, all behind a family passcode.
          </p>
        </div>

        <div className="row">
          <Link href="/setup" className="btn btn-primary btn-xl">
            Create a care circle
            <Icon name="arrow" size={18} />
          </Link>
          <Link href="/join" className="btn btn-xl">
            Join with invite code
          </Link>
        </div>

        <div className="grid grid-3" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 9 }}>
            <Icon name="users" size={18} />
            <span className="small muted">One shared profile</span>
          </div>
          <div className="row" style={{ gap: 9 }}>
            <Icon name="shield" size={18} />
            <span className="small muted">Passcode, not passwords</span>
          </div>
          <div className="row" style={{ gap: 9 }}>
            <Icon name="mail" size={18} />
            <span className="small muted">Quiet escalations</span>
          </div>
        </div>

        <div className="card stack">
          <div className="row-between">
            <div>
              <h2 className="h2">Demo care circles</h2>
              <p className="card-sub">Public demo profiles. Pick one, then enter its passcode.</p>
            </div>
            <span className="circle-chip">{circles.length} demo circle{circles.length === 1 ? "" : "s"}</span>
          </div>

          {circles.length === 0 ? (
            <div className="empty">
              <Icon name="heart" size={26} />
              <p>No demo circle on this deployment. Create the first one in under a minute.</p>
            </div>
          ) : (
            <div className="stack">
              {circles.map((circle) => (
                <div key={circle.id} className="stack-sm">
                  <div className="row-between">
                    <h3 className="h3">{circle.name}</h3>
                    <span className="tiny muted">
                      {circle.elderName} · {circle.memberCount} member{circle.memberCount === 1 ? "" : "s"}
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
                              {member.role === "elder" ? "Elder" : member.role === "caretaker" ? "Caretaker" : "Family member"}
                              {member.isDemo ? " · demo profile" : ""}
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
          <hr className="divider" />
          <p className="tiny muted">
            Demo circles ship with a week of history. Elder passcode 1234 · caretaker 2580 · family 1990.
          </p>
          <form action="/login" method="get" className="row invite-form" aria-label="Open a private care circle">
            <label className="sr-only" htmlFor="invite-code">Invite code</label>
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
          <p className="tiny muted">
            Real care circles are not listed here — a 6-character invite code is the only way in.
          </p>
        </div>
      </div>
    </div>
  );
}
