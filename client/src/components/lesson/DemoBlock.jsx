import { useEffect, useRef, useState } from 'react';

// C++ "Run demo": code ke sath pehle se likha hua output dikhata hai (asal mein code compile nahi hota)
export default function DemoBlock({ code, output }) {
  const [shown, setShown] = useState('');
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const run = () => {
    clearTimeout(timer.current);
    setShown('Running...');
    timer.current = setTimeout(() => setShown(`Output:\n${output}`), 300);
  };
  const clear = () => {
    clearTimeout(timer.current);
    setShown('');
  };

  return (
    <>
      <div className="code">
        <pre>{code}</pre>
      </div>
      <div className="btn-row">
        <button type="button" className="btn" onClick={run}>
          Run demo
        </button>
        <button type="button" className="btn secondary" onClick={clear}>
          Clear
        </button>
      </div>
      <pre className="output-box out" aria-live="polite">
        {shown}
      </pre>
    </>
  );
}
