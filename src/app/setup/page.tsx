import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { SetupForm } from "@/components/SetupForm";

export const metadata = { title: "Create a care circle" };

export default async function SetupPage() {
  const session = await readSession();
  if (session) redirect("/dashboard");

  return (
    <div className="public-wrap">
      <div className="public-inner" style={{ maxWidth: 720 }}>
        <Brand subtitle="New care circle" />

        <div className="stack-sm">
          <p className="eyebrow">Step 1 of 2</p>
          <h1 className="h1">Set up the care circle</h1>
          <p className="lede">
            One profile, one passcode, everyone accountable. You can invite family and caretakers as soon as this is
            saved.
          </p>
        </div>

        <div className="card">
          <SetupForm />
        </div>

        <div className="row-between">
          <Link href="/" className="small muted row" style={{ gap: 6 }}>
            <Icon name="arrow" size={15} style={{ transform: "rotate(180deg)" }} />
            Back
          </Link>
          <Link href="/join" className="small muted">
            Already have an invite code?
          </Link>
        </div>
      </div>
    </div>
  );
}
