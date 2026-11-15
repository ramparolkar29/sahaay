import Link from "next/link";
import { Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";

export default function NotFound() {
  return (
    <div className="public-wrap">
      <div className="card state-card">
        <Brand subtitle="Care circle" />
        <span className="state-icon">
          <Icon name="alert" size={28} />
        </span>
        <h1 className="h2">We could not find that page</h1>
        <p className="muted">The link may be old, or the item was removed. Your circle and its records are unchanged.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link href="/dashboard" className="btn btn-primary">
            Go to today
          </Link>
          <Link href="/" className="btn btn-quiet">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
