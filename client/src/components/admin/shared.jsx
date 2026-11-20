export function Loading() {
  return (
    <div className="text-center py-4" role="status">
      <span className="spinner-border spinner-border-sm me-2" />
      Loading...
    </div>
  );
}

export function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div className="admin-pager">
      <button type="button" className="btn btn-outline-light btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button type="button" className="btn btn-outline-light btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}

export function StatusBadge({ disabled }) {
  return disabled ? <span className="badge text-bg-danger ms-2">Suspended</span> : null;
}
