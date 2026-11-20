import { useState } from 'react';
import ShortCard from '../shorts/ShortCard.jsx';
import { request } from '../../services/api.js';
import { Loading, Pager } from './shared.jsx';
import { useAdminList } from './useAdminList.js';

const VIDEO_FILTERS = [
  { id: 'pending', label: 'Waiting' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

export default function VideosTab({ initialStatus, student, onClearStudent, onOpenStudent }) {
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const { data, error, reload } = useAdminList('/admin/videos', { status, search: term, student: student?.id, page: String(page) });

  const submit = (e) => {
    e.preventDefault();
    setPage(1);
    setTerm(search.trim());
  };
  const pickStatus = (id) => {
    setStatus(id);
    setPage(1);
    setRejecting(null);
  };

  async function act(fn) {
    try {
      setActionError('');
      await fn();
      setRejecting(null);
      setReason('');
      await reload();
    } catch (err) {
      setActionError(err.message || 'Something went wrong');
    }
  }
  const setVideoStatus = (id, body) => act(() => request(`/admin/videos/${id}/status`, { method: 'PATCH', body }));
  const remove = (video) => {
    if (window.confirm(`Delete "${video.title}" for good?`)) act(() => request(`/admin/videos/${video.id}`, { method: 'DELETE' }));
  };

  return (
    <>
      <div className="admin-filters" role="group" aria-label="Filter videos">
        {VIDEO_FILTERS.map((f) => (
          <button key={f.id} type="button" className={`btn btn-sm ${status === f.id ? 'btn-primary' : 'btn-outline-light'}`} aria-pressed={status === f.id} onClick={() => pickStatus(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      {student && (
        <p className="admin-count">
          Showing videos by <strong>{student.name}</strong>{' '}
          <button type="button" className="btn btn-outline-light btn-sm ms-2" onClick={onClearStudent}>
            Show everyone
          </button>
        </p>
      )}
      <form className="admin-search" onSubmit={submit}>
        <input type="search" className="form-control" placeholder="Search by title or uploader" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search videos" />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>
      {(error || actionError) && <div className="alert alert-danger">{actionError || error}</div>}
      {!data ? (
        !error && <Loading />
      ) : (
        <>
          <p className="admin-count">{data.total} video{data.total === 1 ? '' : 's'}</p>
          {data.videos.length === 0 && <p className="text-center">No videos here.</p>}
          <div className="admin-video-grid">
            {data.videos.map((v) => (
              <ShortCard key={v.id} video={v} active={activeId === v.id} onPlay={setActiveId}>
                <div className="short-actions">
                  {v.status !== 'approved' && (
                    <button type="button" className="btn btn-success btn-sm" onClick={() => setVideoStatus(v.id, { status: 'approved' })}>
                      Approve
                    </button>
                  )}
                  {v.status !== 'rejected' && (
                    <button type="button" className="btn btn-warning btn-sm" onClick={() => { setRejecting(v.id); setReason(''); }}>
                      Reject
                    </button>
                  )}
                  <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => remove(v)}>
                    Delete
                  </button>
                  {v.uploaderId && (
                    <button type="button" className="btn btn-outline-light btn-sm" onClick={() => onOpenStudent(v.uploaderId)}>
                      View student
                    </button>
                  )}
                </div>
                {rejecting === v.id && (
                  <form
                    className="admin-reject"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setVideoStatus(v.id, { status: 'rejected', reason });
                    }}
                  >
                    <label htmlFor={`reason-${v.id}`}>Why is it rejected? (student will see this)</label>
                    <input id={`reason-${v.id}`} className="form-control form-control-sm" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Not about programming" autoFocus />
                    <div className="short-actions">
                      <button type="submit" className="btn btn-danger btn-sm" disabled={reason.trim().length < 3}>
                        Confirm reject
                      </button>
                      <button type="button" className="btn btn-outline-light btn-sm" onClick={() => setRejecting(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </ShortCard>
            ))}
          </div>
          <Pager page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
    </>
  );
}
