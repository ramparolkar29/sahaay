export default function AppLoading() {
  return (
    <div className="dashboard-grid" aria-busy="true">
      <span className="sr-only" role="status">
        Loading your care circle
      </span>
      <div className="stack" style={{ gap: 20 }}>
        <div className="stack-sm" style={{ gap: 10 }}>
          <div className="skeleton skeleton-line" style={{ width: 180 }} />
          <div className="skeleton skeleton-title" style={{ width: 320, maxWidth: "80%" }} />
          <div className="skeleton skeleton-line" style={{ width: 240, maxWidth: "60%" }} />
        </div>
        <div className="skeleton skeleton-hero" />
        <div className="skeleton-card">
          <div className="skeleton skeleton-line" style={{ width: "42%" }} />
          <div className="skeleton skeleton-line" style={{ width: "86%" }} />
          <div className="skeleton skeleton-line" style={{ width: "74%" }} />
        </div>
      </div>
      <div className="stack" style={{ gap: 20 }}>
        <div className="skeleton-card">
          <div className="skeleton skeleton-line" style={{ width: "55%" }} />
          <div className="skeleton skeleton-line" style={{ width: "80%" }} />
        </div>
        <div className="skeleton-card">
          <div className="skeleton skeleton-line" style={{ width: "48%" }} />
          <div className="skeleton skeleton-line" style={{ width: "70%" }} />
        </div>
      </div>
    </div>
  );
}
