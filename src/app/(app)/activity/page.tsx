import { Icon, type IconName } from "@/components/Icon";
import { currentContext } from "@/lib/auth";
import { getRepo } from "@/lib/store";
import { dateLabelLong, formatInZone, zonedMoment } from "@/lib/time";

export const metadata = { title: "Activity" };

const KIND_ICON: Record<string, IconName> = {
  medicine: "pill",
  dose: "check",
  appointment: "calendar",
  member: "users",
  profile: "shield",
};

export default async function ActivityPage() {
  const { circle } = await currentContext();
  const entries = getRepo().listActivity(circle.id, 80);
  const today = zonedMoment(new Date(), circle.timezone).date;

  const groups = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = zonedMoment(new Date(entry.createdAt), circle.timezone).date;
    const list = groups.get(key);
    if (list) list.push(entry);
    else groups.set(key, [entry]);
  }

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div className="stack-sm" style={{ gap: 6 }}>
          <p className="eyebrow">Audit trail</p>
          <h1 className="h1">Activity</h1>
          <p className="muted">A quiet record of who changed what — useful when three people share the care.</p>
        </div>
        <span className="circle-chip">{entries.length} entries</span>
      </div>

      {entries.length === 0 ? (
        <div className="card empty">
          <Icon name="pulse" size={26} />
          <p>Nothing logged yet. Mark a dose or add a medicine and it will show here.</p>
        </div>
      ) : (
        [...groups.entries()].map(([date, dayEntries]) => (
          <section key={date} className="card" aria-labelledby={`day-${date}`}>
            <div className="card-head">
              <div>
                <h2 className="card-title" id={`day-${date}`}>
                  {date === today ? "Today" : dateLabelLong(date)}
                </h2>
                <p className="card-sub">{dayEntries.length} update{dayEntries.length === 1 ? "" : "s"}</p>
              </div>
            </div>
            <ol className="feed">
              {dayEntries.map((entry) => (
                <li key={entry.id} className="feed-item">
                  <span className="feed-icon">
                    <Icon name={KIND_ICON[entry.kind] ?? "pulse"} size={16} />
                  </span>
                  <div>
                    <p className="feed-text">{entry.message}</p>
                    <p className="feed-time">
                      {entry.memberName} · {formatInZone(new Date(entry.createdAt), circle.timezone)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
