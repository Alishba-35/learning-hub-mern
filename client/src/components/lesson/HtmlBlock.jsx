import { useMemo } from 'react';
import { sanitizeLessonHtml } from '../../services/sanitize.js';

export default function HtmlBlock({ html }) {
  const clean = useMemo(() => sanitizeLessonHtml(html), [html]);
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
