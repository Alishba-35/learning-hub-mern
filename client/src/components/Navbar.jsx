import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

// onToggleTopics diya ho (lesson pages) to left par topics-sidebar ka button dikhta hai
export default function Navbar({ onToggleTopics }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <nav className="navbar navbar-expand-lg navbar-dark app-navbar sticky-top">
      <div className="container-fluid">
        {onToggleTopics && (
          <button type="button" className="btn topics-toggle me-2" onClick={onToggleTopics} aria-label="Toggle topics sidebar">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          </button>
        )}
        <Link className="navbar-brand" to="/languages" onClick={close}>
          Learning Hub
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          aria-controls="main-nav"
          aria-expanded={open}
          aria-label="Toggle navigation"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className={`collapse navbar-collapse${open ? ' show' : ''}`} id="main-nav">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item">
              <NavLink className="nav-link" to="/languages" onClick={close}>
                Home
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink className="nav-link" to="/dashboard" onClick={close}>
                Dashboard
              </NavLink>
            </li>
          </ul>

          <div className="d-flex align-items-center gap-3">
            <NavLink className="btn btn-outline-light btn-sm" to="/shorts" onClick={close}>
              Shorts Study
            </NavLink>
            {user && (
              <>
                <span className="navbar-text">Hi, {user.name}</span>
                <button type="button" className="btn btn-outline-light btn-sm" onClick={logout}>
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
