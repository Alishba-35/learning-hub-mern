import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import ThemeToggle from '../ThemeToggle.jsx';

// Chhote inline icons (koi icon library nahi)
const ICONS = {
  overview: 'M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z',
  students: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21c0-4 3.6-6 8-6s8 2 8 6',
  insights: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  videos: 'M5 4l14 8-14 8z',
};

function Icon({ name }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

const NAV = [
  { to: '/admin', label: 'Overview', icon: 'overview', end: true },
  { to: '/admin/students', label: 'Students', icon: 'students' },
  { to: '/admin/insights', label: 'Insights', icon: 'insights' },
  { to: '/admin/videos', label: 'Videos', icon: 'videos' },
];

// Admin ka apna shell: student site ke navbar/dashboard se alag sidebar, rang (teal) aur layout
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="adm-shell">
      <header className="adm-topbar">
        <button type="button" className="adm-menu-btn" aria-label="Open menu" aria-expanded={open} aria-controls="admin-sidebar" onClick={() => setOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>
        <strong>Admin console</strong>
      </header>

      {open && <button type="button" className="adm-backdrop" aria-label="Close menu" onClick={close} />}

      <aside id="admin-sidebar" className={`adm-side${open ? ' is-open' : ''}`}>
        <div className="adm-brand">
          <span className="adm-logo" aria-hidden="true">
            LH
          </span>
          <span>
            <strong>Learning Hub</strong>
            <small>Admin console</small>
          </span>
        </div>

        <nav className="adm-nav" aria-label="Admin sections">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={close}>
              <Icon name={n.icon} />
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="adm-side-foot">
          <Link className="adm-back" to="/languages">
            Back to student site
          </Link>
          <div className="adm-user">
            <span className="adm-avatar" aria-hidden="true">
              {(user?.name ?? 'A').slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{user?.name}</strong>
              <small>Administrator</small>
            </span>
          </div>
          <div className="adm-foot-actions">
            <ThemeToggle />
            <button type="button" className="btn btn-outline-light btn-sm" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </aside>

      <main className="adm-main">
        <div className="adm-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
