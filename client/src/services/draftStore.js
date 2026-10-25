// Code drafts ki ek copy isi device par bhi rakhi jati hai: internet na ho to bhi kaam nahi jata.
const PREFIX = 'lh:draft:';
const key = (user, slug, topic, index) => `${PREFIX}${user}:${slug}:${topic}:${index}`;

export function readLocalDraft(user, slug, topic, index) {
  try {
    const value = JSON.parse(localStorage.getItem(key(user, slug, topic, index)));
    return typeof value?.code === 'string' && typeof value?.savedAt === 'number' ? value : null;
  } catch {
    return null;
  }
}

export function writeLocalDraft(user, slug, topic, index, code) {
  try {
    localStorage.setItem(key(user, slug, topic, index), JSON.stringify({ code, savedAt: Date.now() }));
  } catch {
    // storage band ya bhara hua ho to server wali copy kaafi hai
  }
}

export function clearLocalDraft(user, slug, topic, index) {
  try {
    localStorage.removeItem(key(user, slug, topic, index));
  } catch {
    // ignore
  }
}

export function clearAllLocalDrafts() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
