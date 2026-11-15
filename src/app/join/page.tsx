import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { JoinForm } from "@/components/JoinForm";

export const metadata = { title: "Join a care circle" };
export const dynamic = "force-dynamic";

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const session = await readSession();
  if (session) redirect("/dashboard");
  const { code } = await searchParams;

  return (
    <div className="public-wrap">
      <div className="public-inner" style={{ maxWidth: 680 }}>
        <Brand subtitle="Join a care circle" />

        <div className="stack-sm">
          <p className="eyebrow">Invitation</p>
          <h1 className="h1">Join an existing care circle</h1>
          <p className="lede">
            Ask the elder or the person who set up Sahaay for the 6-character invite code. You will pick your own
            passcode, so every update stays under your name.
          </p>
        </div>

        <div className="card">
          <JoinForm presetCode={code ? code.slice(0, 6) : ""} />
        </div>

        <Link href="/" className="small muted row" style={{ gap: 6, justifyContent: "center" }}>
          <Icon name="arrow" size={15} style={{ transform: "rotate(180deg)" }} />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
