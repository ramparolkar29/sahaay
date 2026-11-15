import { headers } from "next/headers";
import { removeMemberAction } from "@/app/actions";
import { Avatar } from "@/components/Brand";
import { CopyButton } from "@/components/CopyButton";
import { DangerButton } from "@/components/DangerButton";
import { Icon } from "@/components/Icon";
import { MedicalIdForm } from "@/components/MedicalIdForm";
import { currentContext } from "@/lib/auth";
import { getRepo } from "@/lib/store";

export const metadata = { title: "Care team" };

const ROLE_LABEL: Record<string, string> = {
  elder: "Elder · profile owner",
  caretaker: "Caretaker",
  family: "Family member",
};

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { member, circle } = await currentContext();
  const { error } = await searchParams;
  const repo = getRepo();
  const members = repo.listMembers(circle.id);
  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const joinUrl = host ? `${protocol}://${host}/join?code=${circle.inviteCode}` : `/join?code=${circle.inviteCode}`;
  const signInUrl = host ? `${protocol}://${host}/login?code=${circle.inviteCode}` : `/login?code=${circle.inviteCode}`;

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div className="stack-sm" style={{ gap: 6 }}>
          <p className="eyebrow">Access</p>
          <h1 className="h1">Care team</h1>
          <p className="muted">Everyone here has their own passcode, and every action carries their name.</p>
        </div>
        <span className="circle-chip">
          <Icon name="shield" size={14} />
          {members.length} people
        </span>
      </div>

      {error === "self" ? (
        <div className="banner banner-danger" role="alert">
          <Icon name="alert" size={18} />
          <div>You cannot remove yourself from the circle. Ask another family member if you need to leave.</div>
        </div>
      ) : null}

      <div className="dashboard-grid">
        <div className="stack" style={{ gap: 18 }}>
          <section className="card" aria-labelledby="members-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="members-title">Members</h2>
                <p className="card-sub">Roles decide nothing about access — everyone can update everything, and every change is logged.</p>
              </div>
            </div>
            <ul className="stack">
              {members.map((person) => (
                <li key={person.id} className="member-row">
                  <Avatar name={person.name} />
                  <div className="grow">
                    <p className="member-name">{person.name}</p>
                    <p className="member-meta">
                      {ROLE_LABEL[person.role] ?? person.role}
                      {person.email ? ` · ${person.email}` : " · no email for reminders"}
                    </p>
                  </div>
                  {person.id === member.id ? (
                    <span className="pill pill-accent">You</span>
                  ) : person.role === "elder" ? (
                    <span className="pill">Owner</span>
                  ) : (
                    <form action={removeMemberAction}>
                      <input type="hidden" name="memberId" value={person.id} />
                      <DangerButton
                        className="btn btn-sm btn-quiet"
                        confirmLabel="Remove this person?"
                        pendingLabel="Removing…"
                        ariaLabel={`Remove ${person.name} from the care circle`}
                      >
                        Remove
                      </DangerButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="card" aria-labelledby="medical-id-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="medical-id-title">Medical ID</h2>
                <p className="card-sub">What a doctor needs to know in an emergency</p>
              </div>
              <span className="pill pill-missed">
                <Icon name="heart" size={13} />
                {circle.bloodGroup ?? "No blood group"}
              </span>
            </div>
            <MedicalIdForm
              initial={{
                bloodGroup: circle.bloodGroup ?? "",
                allergies: circle.allergies ?? "",
                conditions: circle.conditions ?? "",
                emergencyContact: circle.emergencyContact ?? "",
              }}
            />
            <p className="tiny muted" style={{ marginTop: 12 }}>
              Allergies and conditions show up in reminder emails as a safety line.
            </p>
          </section>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <section className="card" aria-labelledby="invite-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="invite-title">Invite someone</h2>
                <p className="card-sub">Share this code in person or over a call</p>
              </div>
            </div>
            <div className="invite-code" aria-label={`Invite code ${circle.inviteCode.split("").join(" ")}`}>
              {circle.inviteCode.split("").map((character, index) => (
                <span key={index} className="invite-char">{character}</span>
              ))}
            </div>
            <div className="row" style={{ marginTop: 16 }}>
              <CopyButton value={circle.inviteCode} label="Copy code" />
              <CopyButton value={joinUrl} label="Copy join link" />
              <CopyButton value={signInUrl} label="Copy sign-in link" />
            </div>
            <p className="small muted" style={{ marginTop: 14 }}>
              Anyone with the code picks their own passcode and joins as family or caretaker. Returning members use the
              same code to open the circle, so keep the sign-in link handy on each person&apos;s phone. Rotate the code
              if it leaks.
            </p>
          </section>

          <section className="card" aria-labelledby="access-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="access-title">How access works</h2>
              </div>
            </div>
            <ul className="stack-sm">
              <li className="info-item">
                <Icon name="shield" size={16} />
                <span>Passcodes are stored as salted bcrypt hashes — never in plain text.</span>
              </li>
              <li className="info-item">
                <Icon name="clock" size={16} />
                <span>Sessions last 12 hours, live in an httpOnly cookie, and end on &ldquo;Lock &amp; sign out&rdquo;.</span>
              </li>
              <li className="info-item">
                <Icon name="alert" size={16} />
                <span>Five wrong passcodes pause that profile for 15 minutes.</span>
              </li>
              <li className="info-item">
                <Icon name="users" size={16} />
                <span>Data is scoped to your circle at the server. No URL can point you at another family.</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
