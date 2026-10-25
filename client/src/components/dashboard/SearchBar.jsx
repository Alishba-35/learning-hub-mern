import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../../services/api.js';
import Icon from './Icon.jsx';

const EMPTY = { query: '', languages: [], lessons: [] };

export default function SearchBar({ onAsk }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState(EMPTY);
  const [active, setActive] = useState(0);
  const trimmed = query.trim();

  // Ctrl+K ya Cmd+K se search par jao
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Bahar click karne par list band
  useEffect(() => {
    const onDown = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Typing rukne ke baad hi server se poochho
  useEffect(() => {
    if (trimmed.length < 2) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      request(`/search?q=${encodeURIComponent(trimmed)}`)
        .then((data) => !cancelled && setFound({ query: trimmed, ...data }))
        .catch(() => {});
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  const fresh = found.query === trimmed ? found : EMPTY;
  const options = trimmed
    ? [
        { id: 'ask', kind: 'ask', label: `Ask Study Buddy: \u201c${trimmed}\u201d` },
        ...fresh.languages.map((l) => ({ id: `lang-${l.slug}`, kind: 'language', label: l.name, hint: 'Language', to: `/learn/${l.slug}` })),
        ...fresh.lessons.map((l) => ({ id: `lesson-${l.languageSlug}-${l.slug}`, kind: 'lesson', label: l.title, hint: l.languageName, to: `/learn/${l.languageSlug}/${l.slug}` })),
      ]
    : [];

  const choose = (option) => {
    if (!option) return;
    if (option.kind === 'ask') onAsk(trimmed);
    else navigate(option.to);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(options.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="search" ref={wrapRef} role="search">
      <form
        className="search-box"
        onSubmit={(e) => {
          e.preventDefault();
          choose(options[active] ?? options[0]);
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          role="combobox"
          aria-label="Search lessons or ask Study Buddy"
          aria-expanded={open && options.length > 0}
          aria-controls="search-options"
          aria-activedescendant={open && options[active] ? `opt-${options[active].id}` : undefined}
          placeholder="Search lessons or ask Study Buddy..."
          autoComplete="off"
          maxLength={80}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <kbd aria-hidden="true">Ctrl K</kbd>
        <button type="submit" aria-label="Search">
          <Icon name="search" size={16} />
        </button>
      </form>

      {open && options.length > 0 && (
        <ul className="search-options" id="search-options" role="listbox" aria-label="Search results">
          {options.map((o, i) => (
            <li
              key={o.id}
              id={`opt-${o.id}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : ''}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
            >
              <span>{o.label}</span>
              {o.hint && <small>{o.hint}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
