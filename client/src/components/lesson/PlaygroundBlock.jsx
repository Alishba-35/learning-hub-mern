import { useCallback, useEffect, useRef, useState } from 'react';
import { useLesson } from '../../context/lessonContext.js';
import { clearLocalDraft, readLocalDraft, writeLocalDraft } from '../../services/draftStore.js';

const TIMEOUT_MS = 5000;

const STATUS_TEXT = {
  saving: 'Saving...',
  saved: 'Saved',
  offline: 'Offline: saved on this device',
  restored: 'Your draft was restored',
};

// User ka code ek sandboxed iframe mein chalta hai: wo is app ke cookies, tokens ya page tak pahunch hi nahi sakta.
function buildRunnerDoc(code, runId) {
  const payload = JSON.stringify({ code, runId }).replace(/</g, '\\u003c');
  return `<!doctype html><html><body><script>
const { code, runId } = ${payload};
const send = (type, text) => parent.postMessage({ runId, type, text }, '*');
const fmt = (v) => {
  if (typeof v === 'string') return v;
  try { const s = JSON.stringify(v); return s === undefined ? String(v) : s; } catch { return String(v); }
};
for (const m of ['log', 'info', 'warn', 'error']) {
  console[m] = (...a) => send(m === 'error' ? 'error' : 'log', a.map(fmt).join(' '));
}
addEventListener('error', (e) => send('error', e.message));
addEventListener('unhandledrejection', (e) => send('error', String(e.reason)));
try { new Function(code)(); } catch (e) { send('error', e.message); }
send('done', '');
</script></body></html>`;
}

// Server aur is device ki copy mein se jo nayi ho wohi wapas aati hai
function findDraft(lesson, index) {
  const server = lesson.drafts[`${lesson.topic}__${index}`];
  const local = readLocalDraft(lesson.userId, lesson.slug, lesson.topic, index);
  if (!server && !local) return null;
  const serverTime = server ? Date.parse(server.updatedAt) || 0 : -1;
  const localTime = local ? local.savedAt : -1;
  return localTime > serverTime ? { code: local.code, fromLocal: true } : { code: server.code, fromLocal: false };
}

export default function PlaygroundBlock({ code: original, draftIndex = 0 }) {
  const lesson = useLesson();
  const [restored] = useState(() => (lesson ? findDraft(lesson, draftIndex) : null));
  const [code, setCode] = useState(restored ? restored.code : original);
  const [status, setStatus] = useState(restored ? 'restored' : '');
  const [lines, setLines] = useState([]);
  const [run, setRun] = useState({ id: 0, running: false });
  const frameRef = useRef(null);
  const runIdRef = useRef(0);

  // Agar is device ki copy server se nayi thi (offline likha tha) to ab server ko bhi bhej do
  useEffect(() => {
    if (lesson && restored?.fromLocal) lesson.saveDraft(lesson.topic, draftIndex, restored.code, setStatus);
    // sirf pehli baar (mount par)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeCode = (value) => {
    setCode(value);
    if (!lesson) return;
    if (value === original) {
      // original jaisa ho gaya: draft ki zaroorat nahi, server se bhi hata do
      clearLocalDraft(lesson.userId, lesson.slug, lesson.topic, draftIndex);
      lesson.saveDraft(lesson.topic, draftIndex, '', setStatus);
    } else {
      writeLocalDraft(lesson.userId, lesson.slug, lesson.topic, draftIndex, value);
      lesson.saveDraft(lesson.topic, draftIndex, value, setStatus);
    }
  };

  const onMessage = useCallback((e) => {
    const d = e.data;
    if (!d || e.source !== frameRef.current?.contentWindow || d.runId !== runIdRef.current) return;
    if (d.type === 'done') setRun((r) => ({ ...r, running: false }));
    else setLines((l) => [...l, { error: d.type === 'error', text: d.text }]);
  }, []);

  useEffect(() => {
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onMessage]);

  // Agar code kabhi khatam na ho (jaise infinite loop wala async kaam) to 5 second baad rok do
  useEffect(() => {
    if (!run.running) return undefined;
    const t = setTimeout(() => {
      setLines((l) => [...l, { error: true, text: 'Execution timed out' }]);
      setRun((r) => ({ ...r, running: false }));
    }, TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [run.running, run.id]);

  const execute = () => {
    runIdRef.current += 1;
    setLines([]);
    setRun({ id: runIdRef.current, running: true });
  };

  return (
    <div className="playground">
      <textarea
        className="w-100 p-2 text-light rounded"
        rows={8}
        style={{ backgroundColor: '#343a40' }}
        value={code}
        spellCheck={false}
        aria-label="Code editor"
        onChange={(e) => changeCode(e.target.value)}
      />
      <div className="d-flex align-items-center flex-wrap gap-2 mt-2">
        <button type="button" className="btn btn-success" onClick={execute} disabled={run.running}>
          {run.running ? 'Running...' : 'Run Code'}
        </button>
        {code !== original && (
          <button type="button" className="btn btn-outline-light btn-sm" onClick={() => changeCode(original)}>
            Reset code
          </button>
        )}
        <span className="draft-status" role="status">
          {STATUS_TEXT[status] || ''}
        </span>
      </div>
      <h3 className="mt-3">Console Output:</h3>
      <div
        className="bg-dark p-3 rounded"
        style={{ height: 150, overflowY: 'auto', color: 'white', whiteSpace: 'pre-wrap' }}
        aria-live="polite"
      >
        {run.id === 0 && 'Your console messages will appear here...'}
        {lines.map((l, i) => (
          <div key={i} style={l.error ? { color: '#f87171' } : undefined}>
            {l.error ? `Error: ${l.text}` : l.text}
          </div>
        ))}
      </div>
      {run.id > 0 && (
        <iframe
          key={run.id}
          ref={frameRef}
          title="code runner"
          sandbox="allow-scripts"
          srcDoc={buildRunnerDoc(code, run.id)}
          hidden
        />
      )}
    </div>
  );
}
