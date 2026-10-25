import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { sanitizeLessonHtml } from '../../services/sanitize.js';
import DemoBlock from './DemoBlock.jsx';
import PlaygroundBlock from './PlaygroundBlock.jsx';

function Widget({ block, draftIndex }) {
  return block.kind === 'demo' ? (
    <DemoBlock code={block.code} output={block.output} />
  ) : (
    <PlaygroundBlock code={block.code} draftIndex={draftIndex} />
  );
}

// Lesson ka HTML ek hi tukde mein render hota hai (taake cards/sections ki nesting na tootay).
// Demo aur playground us HTML ke andar khali jagah (placeholder) par React se lagte hain.
export default function LessonBody({ blocks }) {
  const { html, widgets } = useMemo(() => {
    const widgets = [];
    let raw = '';
    let playgrounds = 0;
    for (const b of blocks) {
      if (b.kind === 'html') raw += b.html;
      else {
        raw += `<div data-widget="${widgets.length}"></div>`;
        // draftIndex: lesson ke kitne-wein playground ka draft hai (server isi se pehchanta hai)
        widgets.push({ block: b, draftIndex: b.kind === 'playground' ? playgrounds++ : 0 });
      }
    }
    return { html: sanitizeLessonHtml(raw), widgets };
  }, [blocks]);

  const [hosts, setHosts] = useState([]);
  // html badalne par naya ref callback chalta hai aur placeholders dobara dhoonde jate hain
  const setRoot = useCallback(
    (node) => setHosts(node ? Array.from(node.querySelectorAll('[data-widget]')) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [html]
  );

  return (
    <>
      <div ref={setRoot} dangerouslySetInnerHTML={{ __html: html }} />
      {hosts.map((host, i) => widgets[i] && createPortal(<Widget {...widgets[i]} />, host, i))}
    </>
  );
}
