export default function DashboardSkeleton() {
  return (
    <div className="skeleton-wrap" role="status" aria-label="Loading your dashboard">
      <div className="stat-row">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card skeleton" style={{ height: 96 }} />
        ))}
      </div>
      <div className="mid-row">
        <div className="card skeleton span-2" style={{ height: 250 }} />
        <div className="card skeleton" style={{ height: 250 }} />
        <div className="card skeleton" style={{ height: 250 }} />
      </div>
      <div className="lang-grid-dash">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card skeleton" style={{ height: 230 }} />
        ))}
      </div>
    </div>
  );
}
