import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DEMO_PASSCODES } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { getRepo } from "@/lib/store";
import { Avatar, Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { PasscodeKeypad } from "@/components/PasscodeKeypad";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ member?: string; code?: string }> }) {
  const { member: memberId, code } = await searchParams;
  const session = await readSession();
  if (session) redirect("/dashboard");

  const repo = getRepo();

  if (!memberId) {
    if (!code) redirect("/");
    const circle = repo.findCircleByInviteCode(code);
    const members = circle ? repo.listMembers(circle.id) : [];

    return (
      <div className="public-wrap">
        <div className="public-inner">
          <Brand subtitle="Open a care circle" />
          <div className="card stack">
            {circle ? (
              <>
                <div>
                  <p className="eyebrow">Invite code accepted</p>
                  <h1 className="h1" style={{ fontSize: "1.6rem" }}>{circle.name}</h1>
                  <p className="small muted">Pick your profile, then enter your own passcode.</p>
                </div>
                <ul className="member-list">
                  {members.map((person) => (
                    <li key={person.id}>
                      <Link href={`/login?member=${person.id}`} className="member-row">
                        <Avatar name={person.name} />
                        <span className="grow">
                          <span className="member-name" style={{ display: "block" }}>{person.name}</span>
                          <span className="member-meta">
                            {person.role === "elder" ? "Elder" : person.role === "caretaker" ? "Caretaker" : "Family member"}
                          </span>
                        </span>
                        <Icon name="arrow" size={18} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <div>
                  <p className="eyebrow">Invite code</p>
                  <h1 className="h1" style={{ fontSize: "1.6rem" }}>That code did not match a circle</h1>
                  <p className="small muted">Codes are 6 letters or numbers and are not case-sensitive.</p>
                </div>
                <Link href="/" className="btn btn-quiet">Back to start</Link>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const member = repo.getMember(memberId);
  if (!member) notFound();
  const circle = repo.getCircle(member.circleId);
  if (!circle) notFound();

  const demoCode = member.isDemo ? DEMO_PASSCODES[member.role] : undefined;

  return (
    <div className="public-wrap">
      <div className="auth-split">
        <div className="auth-pane">
          <Brand subtitle={circle.name} />

          <div className="card auth-card stack">
            <div className="row" style={{ gap: 16 }}>
              <Avatar name={member.name} large />
              <div>
                <p className="eyebrow">Sign in</p>
                <h1 className="h1" style={{ fontSize: "1.6rem" }}>
                  {member.name}
                </h1>
                <p className="small muted">{circle.name} · {circle.elderName}</p>
              </div>
            </div>

            <hr className="divider" />

            <PasscodeKeypad memberId={member.id} demoCode={demoCode} />
          </div>

          <Link href="/" className="small muted row" style={{ gap: 6, justifyContent: "center" }}>
            <Icon name="arrow" size={15} style={{ transform: "rotate(180deg)" }} />
            Not you? Choose another profile
          </Link>
        </div>

        <aside className="auth-art" aria-label="How Sahaay keeps the circle safe">
          <Image
            src="/images/evening-care.png"
            alt="Illustration of a calm evening at home with a medication tray and a warm lamp"
            fill
            priority
            sizes="(max-width: 1020px) 0px, 460px"
            className="auth-art-img"
          />
          <div className="auth-art-body">
            <p className="eyebrow">Shared care</p>
            <h2 className="h2">One quiet place for the whole family.</h2>
            <ul className="check-list">
              <li>
                <Icon name="shield" size={16} />
                Each person signs in with their own passcode — never a shared password.
              </li>
              <li>
                <Icon name="pulse" size={16} />
                Doses, visits and appointments stay in one live timeline.
              </li>
              <li>
                <Icon name="mail" size={16} />
                Missed doses reach the family by email, not by luck.
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
