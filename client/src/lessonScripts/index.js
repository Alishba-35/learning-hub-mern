import { attachCommon } from './common.js';
import { attachEventDemos } from './event.js';
import { attachClassDemo } from './class.js';

// Jin lessons mein khaas live demos hain (key = "language/topic")
const perLesson = {
  'javascript/event': attachEventDemos,
  'javascript/class': attachClassDemo,
};

export function attachLessonScripts(root, key, context) {
  const cleanups = [attachCommon(root, context), perLesson[key]?.(root)];
  return () => cleanups.forEach((fn) => fn?.());
}
