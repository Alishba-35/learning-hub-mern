import { useEffect } from 'react';

const SITE = 'Learning Hub';
const DEFAULT_TITLE = 'Learning Hub | Learn to code with lessons, quizzes and certificates';

function setMeta(name, content) {
  let el = document.head.querySelector(`meta[name="${name}"]`);
  const existed = Boolean(el);
  const before = el ? el.getAttribute('content') : null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
  // Page chhorne par pehle jaisa kar do
  return () => {
    if (!existed) el.remove();
    else el.setAttribute('content', before ?? '');
  };
}

// Har page ka apna title (browser tab aur Google ke liye). Private pages (login ke andar) ke liye noindex: Google unhein index na kare.
//   usePageTitle('Dashboard', { noindex: true })
//   usePageTitle('Learn to code for free', { description: '...', bare: true })   // bare: title ke aage/peeche "| Learning Hub" nahi
export function usePageTitle(title, { description, noindex = false, bare = false } = {}) {
  useEffect(() => {
    const previous = document.title;
    document.title = !title ? DEFAULT_TITLE : bare ? title : `${title} | ${SITE}`;
    const undo = [];
    if (description) undo.push(setMeta('description', description));
    if (noindex) undo.push(setMeta('robots', 'noindex, nofollow'));
    return () => {
      document.title = previous;
      undo.forEach((fn) => fn());
    };
  }, [title, description, noindex, bare]);
}
