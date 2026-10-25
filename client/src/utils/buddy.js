import { pickContinue } from './recommend.js';
import { plural } from './format.js';

// Study Buddy: aap ke apne numbers se jawab deta hai. Sab kuch isi browser mein hota hai:
// koi internet, koi API key, koi data bahar nahi jata.

export const SUGGESTIONS = [
  'How much XP did I earn this week?',
  'What should I learn next?',
  'Which language am I best at?',
  'How is my streak?',
  'Compare this week to last week',
  'Which badge can I earn next?',
];

const ALIASES = {
  cpp: ['c++', 'cpp'],
  javascript: ['javascript', 'js'],
  node: ['node', 'nodejs', 'express'],
  mongodb: ['mongo', 'mongodb'],
  git: ['git', 'github'],
  sql: ['sql', 'database', 'databases'],
};

const normalize = (text) => text.toLowerCase().replace(/[^a-z0-9+#\s]/g, ' ').replace(/\s+/g, ' ').trim();
const has = (text, word) => new RegExp(`(^| )${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(text);

function findLanguage(text, languages) {
  return languages.find((l) => [l.slug, l.name.toLowerCase(), ...(ALIASES[l.slug] ?? [])].some((alias) => has(text, alias)));
}

// strong = ek hi lafz kaafi hai (wazan 3), weak = sirf ishara (wazan 1). Sab se zyada score wala intent jeetta hai.
const INTENTS = [
  { id: 'greeting', strong: [], weak: [/^(hi|hello|hey|salam|assalam o alaikum|hola)( |$)/], bonus: 2 },
  { id: 'help', strong: [/\bhelp\b/, /what can you/, /what do you do/], weak: [] },
  { id: 'compare', strong: [/\bcompare\b/, /last week/, /previous week/, /than last/, /\bvs\b/, /versus/], weak: [] },
  { id: 'xpWeek', strong: [/this week/, /last 7 days/], weak: [/\bxp\b/, /\bweek\b/, /earn/] },
  { id: 'goal', strong: [/\bgoal\b/, /\btarget\b/], weak: [] },
  { id: 'next', strong: [/should i/, /learn next/, /study next/, /what now/, /recommend/, /suggest/, /continue/], weak: [/\bnext\b/, /\blearn\b/, /study today/] },
  { id: 'weakest', strong: [/\bweak/, /\bworst\b/, /struggl/, /lowest/], weak: [/\bleast\b/] },
  { id: 'best', strong: [/\bbest\b/, /strongest/, /good at/, /favou?rite/], weak: [/\btop\b/] },
  { id: 'streak', strong: [/streak/, /in a row/, /consisten/], weak: [] },
  { id: 'level', strong: [/\blevel\b/, /total xp/, /how much xp/], weak: [/\bxp\b/] },
  { id: 'badges', strong: [/badge/, /achievement/, /unlock/], weak: [] },
  { id: 'quizzes', strong: [/quiz/], weak: [/\btest\b/, /\bscore\b/] },
  { id: 'lessons', strong: [/lesson/, /completed/, /finished/], weak: [/\bdone\b/] },
];

function detectIntent(text) {
  let best = null;
  for (const intent of INTENTS) {
    const hits = intent.strong.filter((p) => p.test(text)).length * 3 + intent.weak.filter((p) => p.test(text)).length;
    const score = hits > 0 ? hits + (intent.bonus ? intent.bonus - 1 : 0) : 0;
    if (score > 0 && (!best || score > best.score)) best = { id: intent.id, score };
  }
  return best?.id ?? null;
}

const CAPABILITIES = 'I can answer questions about your XP, level, streak, weekly goal, lessons, quizzes, badges and each language.';

function languageSummary(l) {
  const parts = [`${l.name}: ${l.completed} of ${plural(l.total, 'lesson')} done (${l.percent}%), ${l.quizzes.taken} of ${plural(l.quizzes.total, 'quiz')} taken, ${l.xp} XP from lessons.`];
  if (l.nextTopic) parts.push(`Next up: "${l.nextTopic.title}".`);
  else if (l.total > 0) parts.push('You finished every lesson. Take the quizzes to test yourself!');
  return { text: parts.join(' '), link: l.nextTopic ? { to: `/learn/${l.slug}/${l.nextTopic.slug}`, label: `Open "${l.nextTopic.title}"` } : null };
}

export function answer(question, ctx) {
  if (!ctx) return { text: 'I am still loading your numbers. Please ask again in a moment.' };
  const text = normalize(question);
  if (!text) return { text: `Ask me something about your learning. ${CAPABILITIES}` };

  const { name, stats, languages, week, badges } = ctx;
  const started = languages.filter((l) => l.completed > 0);
  const intent = detectIntent(text);
  const language = findLanguage(text, languages);
  const link = (to, label) => ({ to, label });

  // Agar kisi language ka naam aaya aur koi aur khaas sawal nahi, to us language ka khulasa
  if (language && !['compare', 'xpWeek', 'streak', 'badges', 'level', 'goal'].includes(intent)) return languageSummary(language);

  switch (intent) {
    case 'greeting':
      return { text: `Hi ${name}! ${CAPABILITIES}` };
    case 'help':
      return { text: `${CAPABILITIES} Try: "${SUGGESTIONS[0]}"` };

    case 'xpWeek': {
      if (week.weekXp === 0) {
        const next = pickContinue(languages, ctx.recent);
        return {
          text: 'You have not earned any XP in the last 7 days. Finish one lesson today to get +10 XP and start a streak!',
          link: next ? link(`/learn/${next.slug}/${next.nextTopic.slug}`, `Start "${next.nextTopic.title}"`) : null,
        };
      }
      const goal = week.goal;
      const tail = goal.percent >= 100 ? `You reached your weekly goal of ${goal.target} XP. Great work!` : `Your weekly goal is ${goal.target} XP, so you are ${goal.percent}% there (${goal.target - goal.earned} XP to go).`;
      return { text: `You earned ${week.weekXp} XP in the last 7 days. ${tail}` };
    }

    case 'compare': {
      const diff = week.weekXp - week.prevWeekXp;
      if (week.weekXp === 0 && week.prevWeekXp === 0) return { text: 'You have no XP in either of the last two weeks yet. Complete a lesson to get started!' };
      if (diff === 0) return { text: `You earned ${week.weekXp} XP this week, exactly the same as last week.` };
      if (week.prevWeekXp === 0) return { text: `You earned ${week.weekXp} XP this week and nothing the week before. A great start!` };
      const pct = Math.round((Math.abs(diff) / week.prevWeekXp) * 100);
      return {
        text: diff > 0
          ? `You earned ${week.weekXp} XP this week versus ${week.prevWeekXp} last week: ${diff} XP more (+${pct}%). Keep it up!`
          : `You earned ${week.weekXp} XP this week versus ${week.prevWeekXp} last week: ${-diff} XP less (-${pct}%). One lesson today would help.`,
      };
    }

    case 'goal': {
      const goal = week.goal;
      return { text: goal.percent >= 100 ? `Weekly goal reached: ${goal.earned} of ${goal.target} XP.` : `Your weekly goal is ${goal.target} XP. You have ${goal.earned} so far (${goal.percent}%), ${goal.target - goal.earned} XP to go.` };
    }

    case 'next': {
      const pick = pickContinue(languages, ctx.recent);
      if (!pick) return { text: 'You have finished every lesson! Take a quiz to test yourself, or revisit a topic you liked.', link: link('/languages', 'Browse languages') };
      return {
        text: `I suggest "${pick.nextTopic.title}" in ${pick.name}. You have finished ${pick.completed} of ${plural(pick.total, 'lesson')} there.`,
        link: link(`/learn/${pick.slug}/${pick.nextTopic.slug}`, `Open "${pick.nextTopic.title}"`),
      };
    }

    case 'best': {
      if (!started.length) return { text: 'You have not completed a lesson yet, so there is no best language so far. Start one today!' };
      const top = [...started].sort((a, b) => b.percent - a.percent || b.xp - a.xp)[0];
      return { text: `Your strongest language is ${top.name}: ${top.completed} of ${plural(top.total, 'lesson')} done (${top.percent}%).` };
    }

    case 'weakest': {
      if (!started.length) return { text: 'You have not started any language yet. Pick one and finish a lesson!' };
      const low = [...started].sort((a, b) => a.percent - b.percent)[0];
      return {
        text: `Among the languages you started, ${low.name} has the lowest progress (${low.percent}%).`,
        link: low.nextTopic ? link(`/learn/${low.slug}/${low.nextTopic.slug}`, `Open "${low.nextTopic.title}"`) : null,
      };
    }

    case 'streak': {
      const s = stats.streak;
      const status = stats.activeToday ? 'You already learned today.' : s > 0 ? 'Finish a lesson or quiz today to keep it alive.' : 'Complete a lesson today to start a new streak.';
      return { text: `Your streak is ${plural(s, 'day')} and your best is ${plural(stats.longestStreak, 'day')}. ${status}` };
    }

    case 'level':
      return { text: `You have ${stats.xp} XP and you are level ${stats.level}. ${stats.xpForNext - stats.xpIntoLevel} XP to reach level ${stats.level + 1}.` };

    case 'badges': {
      const earned = badges.filter((b) => b.earned).length;
      const locked = badges.filter((b) => !b.earned).slice(0, 3);
      if (!locked.length) return { text: `You earned all ${badges.length} badges. Amazing!` };
      return { text: `You earned ${earned} of ${badges.length} badges. Next to unlock: ${locked.map((b) => `${b.title} (${b.description.toLowerCase()})`).join('; ')}.` };
    }

    case 'quizzes': {
      const q = stats.quizzes;
      return { text: `You passed ${q.passed} of ${plural(q.total, 'quiz')} (${q.taken} taken, ${q.perfect} perfect). Each checkpoint quiz is at the end of a lesson section.` };
    }

    case 'lessons': {
      return { text: `You completed ${plural(stats.completedTotal, 'lesson')} across ${plural(started.length, 'language')}.` };
    }

    default:
      return { text: `Sorry ${name}, I did not understand that. ${CAPABILITIES} Try: "${SUGGESTIONS[1]}"` };
  }
}
