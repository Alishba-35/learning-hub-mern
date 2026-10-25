import DOMPurify from 'dompurify';

// Sirf YouTube ke embed videos ki ijazat hai, baqi har iframe hata diya jata hai
const YOUTUBE_EMBED = /^https:\/\/www\.youtube(-nocookie)?\.com\/embed\//;

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'IFRAME' && !YOUTUBE_EMBED.test(node.getAttribute('src') || '')) {
    node.remove();
    return;
  }
  if (node.tagName === 'A' && /^https?:/i.test(node.getAttribute('href') || '')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function sanitizeLessonHtml(html) {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'referrerpolicy', 'target'],
    FORBID_TAGS: ['style', 'script'],
    FORBID_ATTR: ['action', 'formaction'],
  });
}
