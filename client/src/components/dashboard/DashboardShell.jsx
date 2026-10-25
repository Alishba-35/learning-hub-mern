import { useCallback, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { answer } from '../../utils/buddy.js';
import AssistantPanel from './AssistantPanel.jsx';
import { DashboardContext } from './dashboardContext.js';
import Icon from './Icon.jsx';
import Orb from './Orb.jsx';
import SearchBar from './SearchBar.jsx';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { to: '/languages', label: 'Languages', icon: 'book' },
  { to: '/shorts', label: 'Shorts Study', icon: 'play' },
];

// Video wala layout: floating sidebar + header (greeting, search) + content + assistant panel
export default function DashboardShell({ user, onLogout, ctx, title, subtitle, children }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const nextId = useRef(1);
  const firstName = user.name.split(' ')[0];

  const askBuddy = useCallback(
    (question) => {
      const q = question.trim();
      if (!q) return;
      const reply = answer(q, ctx);
      setMessages((list) => [
        ...list,
        { id: nextId.current++, role: 'user', text: q },
        { id: nextId.current++, role: 'bot', text: reply.text, link: reply.link ?? null },
      ]);
      setOpen(true);
    },
    [ctx]
  );

  const value = useMemo(() => ({ askBuddy }), [askBuddy]);

  return (
    <DashboardContext.Provider value={value}>
      <div className="dash">
        <a className="skip-link" href="#dash-main">
          Skip to content
        </a>

        <aside className="dash-sidebar">
          <nav aria-label="Main">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className="side-btn" aria-label={item.label} data-tip={item.label}>
                <Icon name={item.icon} />
              </NavLink>
            ))}
          </nav>
          <div className="side-bottom">
            <button type="button" className="side-btn" aria-label="Log out" data-tip="Log out" onClick={onLogout}>
              <Icon name="logout" />
            </button>
            <span className="side-avatar" aria-hidden="true">
              {firstName[0]?.toUpperCase()}
            </span>
          </div>
        </aside>

        <div className="dash-main" id="dash-main" tabIndex={-1}>
          <header className="dash-header">
            <span className="dash-logo" aria-hidden="true">
              <Icon name="bolt" size={22} />
            </span>
            <div className="dash-title">
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            <SearchBar onAsk={askBuddy} />
            <button type="button" className="round-btn" aria-label="Open Study Buddy" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              <Icon name="chat" size={18} />
            </button>
          </header>

          {children}
        </div>

        {!open && (
          <button type="button" className="buddy-fab" onClick={() => setOpen(true)}>
            <Orb size={26} />
            Ask Buddy
          </button>
        )}
        {open && <AssistantPanel name={firstName} messages={messages} onAsk={askBuddy} onClose={() => setOpen(false)} />}
      </div>
    </DashboardContext.Provider>
  );
}
