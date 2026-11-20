import { useState } from 'react';
import { request } from '../../services/api.js';
import { formatDate, relativeDay } from './format.js';
import { Loading, Pager, StatusBadge } from './shared.jsx';
import { useAdminList } from './useAdminList.js';

const ROLES = [
  { id: 'student', label: 'Students' },
  { id: 'teacher', label: 'Teachers' },
];

// CSV ko file bana kar download karwata hai (login token wali request, is liye seedha link nahi)
async function downloadCsv() {
  const csv = await request('/admin/students/export.csv', { text: true });
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StudentsTab({ onOpenStudent }) {
  const [role, setRole] = useState('student');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [exportError, setExportError] = useState('');
  const { data, error } = useAdminList('/admin/students', { role, search: term, page: String(page) });

  const submit = (e) => {
    e.preventDefault();
    setPage(1);
    setTerm(search.trim());
  };
  const pickRole = (id) => {
    setRole(id);
    setPage(1);
  };
  const exportCsv = async () => {
    try {
      setExportError('');
      await downloadCsv();
    } catch (err) {
      setExportError(err.message || 'Could not export');
    }
  };

  return (
    <>
      <div className="admin-filters" role="group" aria-label="Filter by role">
        {ROLES.map((r) => (
          <button key={r.id} type="button" className={`btn btn-sm ${role === r.id ? 'btn-primary' : 'btn-outline-light'}`} aria-pressed={role === r.id} onClick={() => pickRole(r.id)}>
            {r.label}
          </button>
        ))}
        {role === 'student' && (
          <button type="button" className="btn btn-outline-light btn-sm" onClick={exportCsv}>
            Export CSV
          </button>
        )}
      </div>
      <form className="admin-search" onSubmit={submit}>
        <input type="search" className="form-control" placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search students" />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>
      {(error || exportError) && <div className="alert alert-danger">{exportError || error}</div>}
      {!data ? (
        !error && <Loading />
      ) : (
        <>
          <p className="admin-count">
            {data.total} {role}
            {data.total === 1 ? '' : 's'}
          </p>
          {data.students.length === 0 ? (
            <p className="text-center">No {role}s found.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Signed up</th>
                    <th>XP</th>
                    <th>Last active</th>
                    <th>Videos</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((s) => (
                    <tr key={s.id}>
                      <td data-label="Name">
                        {s.name}
                        <StatusBadge disabled={s.disabled} />
                        <small className="admin-sub">{s.email}</small>
                      </td>
                      <td data-label="Signed up">{formatDate(s.joinedAt)}</td>
                      <td data-label="XP">
                        {s.stats.xp}
                        <small className="admin-sub">Level {s.stats.level}</small>
                      </td>
                      <td data-label="Last active">{relativeDay(s.stats.lastActiveDay)}</td>
                      <td data-label="Videos">
                        {s.videos.total === 0 ? (
                          '-'
                        ) : (
                          <>
                            {s.videos.total}
                            <small className="admin-sub">
                              {s.videos.pending} waiting, {s.videos.rejected} rejected
                            </small>
                          </>
                        )}
                      </td>
                      <td>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => onOpenStudent(s.id)}>
                          View details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
    </>
  );
}
