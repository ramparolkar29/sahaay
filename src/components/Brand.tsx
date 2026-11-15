import Link from "next/link";

export function Brand({ subtitle = "Shared care" }: { subtitle?: string }) {
  return (
    <Link href="/dashboard" className="brand" aria-label="Sahaay home">
      <span className="brand-mark" aria-hidden="true">
        S
      </span>
      <span>
        <span className="brand-name">Sahaay</span>
        <span className="brand-sub">{subtitle}</span>
      </span>
    </Link>
  );
}

export function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className={large ? "avatar avatar-lg" : "avatar"} aria-hidden="true">
      {initials || "?"}
    </span>
  );
}
