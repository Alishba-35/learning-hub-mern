import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SUGGESTIONS } from '../../utils/buddy.js';
import Icon from './Icon.jsx';
import Orb from './Orb.jsx';

export default function AssistantPanel({ name, messages, onAsk, onClose }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  const logRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape hamesha kaam kare, chahe focus kahin bhi ho
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAsk(text);
    setText('');
    inputRef.current?.focus(); // agla sawal foran likh sako
  };

  return (
    <aside className="buddy" role="dialog" aria-label="Study Buddy">
      <header className="buddy-head">
        <Orb size={34} />
        <div>
          <strong>Study Buddy</strong>
          <small>Built-in helper, works on this device</small>
        </div>
        <button type="button" className="icon-btn" aria-label="Close Study Buddy" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </header>

      <div className="buddy-body" ref={logRef} role="log" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 ? (
          <div className="buddy-welcome">
            <Orb size={84} />
            <h2>
              Hi {name}, I&rsquo;m <span>Study Buddy</span>
            </h2>
            <p>Ask me anything about your learning. I answer from your own numbers, right here on this device. No internet, no API key.</p>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => onAsk(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`bubble ${m.role}`}>
              <p>{m.text}</p>
              {m.link && (
                <Link className="bubble-link" to={m.link.to}>
                  {m.link.label}
                </Link>
              )}
            </div>
          ))
        )}
      </div>

      <form className="buddy-form" onSubmit={submit}>
        <input
          ref={inputRef}
          value={text}
          maxLength={200}
          aria-label="Ask Study Buddy"
          placeholder="Ask about XP, streak, lessons..."
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" aria-label="Send question" disabled={!text.trim()}>
          <Icon name="send" size={16} />
        </button>
      </form>
      <p className="buddy-note">Answers are worked out on this device. No internet, no API key.</p>
    </aside>
  );
}
