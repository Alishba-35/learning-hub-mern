const pick = (t) => (t ? { slug: t.slug, title: t.title } : null);

// topics order ke mutabiq sorted hon. Pichla aur agla topic wapas deta hai.
export function neighbours(topics, slug) {
  const i = topics.findIndex((t) => t.slug === slug);
  if (i === -1) return { prev: null, next: null };
  return { prev: pick(topics[i - 1]), next: pick(topics[i + 1]) };
}
