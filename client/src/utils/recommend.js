// "Aage kya parhun?": pehle wohi language jis mein abhi kaam kiya, warna sab se zyada progress wali
export function pickContinue(languages, recent = []) {
  const withNext = languages.filter((l) => l.nextTopic);
  if (!withNext.length) return null;
  const recentSlug = recent[0]?.languageSlug;
  return (
    withNext.find((l) => l.slug === recentSlug) ??
    withNext.filter((l) => l.completed > 0).sort((a, b) => b.percent - a.percent)[0] ??
    withNext[0]
  );
}
