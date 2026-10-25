import { describe, expect, it } from 'vitest';
import { SUGGESTIONS, answer } from '../utils/buddy.js';
import { pickContinue } from '../utils/recommend.js';
import { formatDay, formatWhen, plural } from '../utils/format.js';

const lang = (slug, name, o = {}) => ({
  slug, name, color: '#000', total: 10, completed: 0, percent: 0, xp: 0, lastTopic: '', firstTopic: 'a',
  nextTopic: { slug: 'next-' + slug, title: 'Next ' + name }, quizzes: { total: 3, taken: 0 }, ...o,
});
const ctx = (o = {}) => ({
  name: 'Ayesha',
  stats: { xp: 140, level: 2, xpIntoLevel: 40, xpForNext: 100, streak: 3, longestStreak: 5, activeToday: true, completedTotal: 14, quizzes: { total: 24, taken: 5, passed: 4, perfect: 1 } },
  languages: [
    lang('html', 'HTML', { completed: 8, percent: 80, xp: 80 }),
    lang('css', 'CSS', { completed: 3, percent: 30, xp: 30 }),
    lang('cpp', 'C++', { completed: 0 }),
    lang('javascript', 'JavaScript', { completed: 1, percent: 10, xp: 10, nextTopic: null }),
  ],
  week: { weekXp: 60, prevWeekXp: 40, goal: { target: 100, earned: 60, percent: 60 } },
  badges: [
    { id: 'a', title: 'First Step', description: 'Complete your first lesson', earned: true },
    { id: 'b', title: 'On a Roll', description: 'Complete 10 lessons', earned: true },
    { id: 'c', title: 'Quiz Ace', description: 'Get a perfect score on a quiz', earned: false },
    { id: 'd', title: '7-Day Streak', description: 'Learn 7 days in a row', earned: false },
  ],
  recent: [{ type: 'lesson', languageSlug: 'css', title: 'Grid', xp: 10, at: '2026-10-20T10:00:00Z' }],
  ...o,
});
const ask = (q, c = ctx()) => answer(q, c);

describe('Study Buddy answers from the user\'s own numbers', () => {
  it('answers every suggested question without falling back', () => {
    for (const q of SUGGESTIONS) expect(ask(q).text, q).not.toMatch(/did not understand/);
  });

  it('XP this week with the goal status', () => {
    expect(ask('How much XP did I earn this week?').text).toBe(
      'You earned 60 XP in the last 7 days. Your weekly goal is 100 XP, so you are 60% there (40 XP to go).'
    );
    const reached = ask('xp this week', ctx({ week: { weekXp: 120, prevWeekXp: 0, goal: { target: 100, earned: 120, percent: 100 } } }));
    expect(reached.text).toContain('reached your weekly goal');
  });

  it('no XP this week encourages and links to the next lesson (the language used most recently first)', () => {
    const r = ask('how much xp this week', ctx({ week: { weekXp: 0, prevWeekXp: 0, goal: { target: 100, earned: 0, percent: 0 } } }));
    expect(r.text).toContain('not earned any XP');
    expect(r.link).toEqual({ to: '/learn/css/next-css', label: 'Start "Next CSS"' });
  });

  it('compares this week with last week (more, less, same, nothing before)', () => {
    expect(ask('Compare this week to last week').text).toContain('20 XP more (+50%)');
    const less = ctx({ week: { weekXp: 20, prevWeekXp: 40, goal: { target: 100, earned: 20, percent: 20 } } });
    expect(ask('compare with last week', less).text).toContain('20 XP less (-50%)');
    const same = ctx({ week: { weekXp: 40, prevWeekXp: 40, goal: { target: 100, earned: 40, percent: 40 } } });
    expect(ask('vs last week', same).text).toContain('exactly the same');
    const fresh = ctx({ week: { weekXp: 30, prevWeekXp: 0, goal: { target: 100, earned: 30, percent: 30 } } });
    expect(ask('compare', fresh).text).toContain('nothing the week before');
    const none = ctx({ week: { weekXp: 0, prevWeekXp: 0, goal: { target: 100, earned: 0, percent: 0 } } });
    expect(ask('compare', none).text).toContain('no XP in either');
  });

  it('suggests the next lesson with a link, and handles "everything finished"', () => {
    const r = ask('What should I learn next?');
    expect(r.text).toContain('"Next CSS" in CSS');
    expect(r.link.to).toBe('/learn/css/next-css');
    const done = ctx({ languages: ctx().languages.map((l) => ({ ...l, nextTopic: null })) });
    expect(ask('what should i study next', done).text).toContain('finished every lesson');
  });

  it('best and weakest language use only languages that were started', () => {
    expect(ask('Which language am I best at?').text).toContain('HTML');
    expect(ask('which one is my weakest language?').text).toContain('JavaScript');
    const none = ctx({ languages: ctx().languages.map((l) => ({ ...l, completed: 0, percent: 0 })) });
    expect(ask('what is my best language', none).text).toContain('not completed a lesson');
  });

  it('streak: today done, still alive, or none', () => {
    expect(ask('How is my streak?').text).toBe('Your streak is 3 days and your best is 5 days. You already learned today.');
    const alive = ctx({ stats: { ...ctx().stats, activeToday: false } });
    expect(ask('streak', alive).text).toContain('keep it alive');
    const zero = ctx({ stats: { ...ctx().stats, streak: 0, longestStreak: 1, activeToday: false } });
    expect(ask('my streak', zero).text).toContain('start a new streak');
    expect(ask('streak', ctx({ stats: { ...ctx().stats, streak: 1 } })).text).toContain('1 day and');
  });

  it('level, total XP, lessons, quizzes and goal', () => {
    expect(ask('what is my level').text).toBe('You have 140 XP and you are level 2. 60 XP to reach level 3.');
    expect(ask('how much xp do i have in total').text).toContain('140 XP');
    expect(ask('how many lessons have i completed').text).toBe('You completed 14 lessons across 3 languages.');
    expect(ask('how did i do in quizzes').text).toContain('passed 4 of 24 quizzes (5 taken, 1 perfect)');
    expect(ask('what is my weekly goal').text).toContain('60%');
  });

  it('badges: lists what to unlock next, or says all are earned', () => {
    const r = ask('Which badge can I earn next?');
    expect(r.text).toContain('2 of 4 badges');
    expect(r.text).toContain('Quiz Ace (get a perfect score on a quiz)');
    expect(r.text).toContain('7-Day Streak');
    const all = ctx({ badges: ctx().badges.map((b) => ({ ...b, earned: true })) });
    expect(ask('any badges left to unlock', all).text).toContain('all 4 badges');
  });

  it('a language name gives that language\'s summary; aliases like js and c++ work', () => {
    expect(ask('How am I doing in CSS?').text).toBe('CSS: 3 of 10 lessons done (30%), 0 of 3 quizzes taken, 30 XP from lessons. Next up: "Next CSS".');
    expect(ask('how am i doing in C++?').text).toContain('C++: 0 of 10 lessons');
    expect(ask('tell me about js').text).toContain('JavaScript: 1 of 10 lessons');
    expect(ask('javascript').text).toContain('finished every lesson');
    expect(ask('how is my html progress').link.to).toBe('/learn/html/next-html');
  });

  it('"java" does not match "javascript" and a general question still wins over a language mention', () => {
    const c = ctx({ languages: [...ctx().languages, lang('java', 'Java')] });
    expect(answer('how am i doing in java', c).text).toContain('Java: 0 of 10');
    expect(answer('how am i doing in javascript', c).text).toContain('JavaScript: 1 of 10');
    expect(answer('how much xp did I earn this week in css', c).text).toContain('earned 60 XP');
  });

  it('greetings, help, empty and unknown questions give a helpful reply', () => {
    expect(ask('hello').text).toContain('Hi Ayesha');
    expect(ask('salam').text).toContain('Hi Ayesha');
    expect(ask('help').text).toContain('I can answer questions');
    expect(ask('   ').text).toContain('Ask me something');
    expect(ask('what is the weather').text).toMatch(/did not understand/);
    expect(ask('!!!').text).toContain('Ask me something');
  });

  it('says it is still loading when there is no data yet, and never throws on odd input', () => {
    expect(answer('streak', null).text).toContain('still loading');
    for (const q of ['<script>alert(1)</script>', 'a'.repeat(500), '(((', 'c++ c++ c++', '\n\t']) {
      expect(() => ask(q), q).not.toThrow();
    }
  });
});

describe('helpers', () => {
  it('pickContinue prefers the language used last, then the most advanced one with lessons left', () => {
    const l = ctx().languages;
    expect(pickContinue(l, [{ languageSlug: 'css' }]).slug).toBe('css');
    expect(pickContinue(l, []).slug).toBe('html');
    expect(pickContinue(l, [{ languageSlug: 'javascript' }]).slug).toBe('html'); // JS has nothing left
    expect(pickContinue(l.map((x) => ({ ...x, nextTopic: null })), [])).toBeNull();
    expect(pickContinue([lang('x', 'X'), lang('y', 'Y')], []).slug).toBe('x'); // nothing started: first
  });

  it('formatWhen says Today, Yesterday or the date', () => {
    const now = new Date(2026, 9, 20, 15, 0);
    expect(formatWhen(new Date(2026, 9, 20, 9, 5).toISOString(), now)).toBe('Today 09:05');
    expect(formatWhen(new Date(2026, 9, 19, 23, 30).toISOString(), now)).toBe('Yesterday 23:30');
    expect(formatWhen(new Date(2026, 9, 12, 10, 0).toISOString(), now)).toBe('Oct 12');
    expect(formatWhen('not a date', now)).toBe('');
  });

  it('formatDay and plural', () => {
    expect(formatDay('2026-10-07')).toBe('Oct 7');
    expect(plural(1, 'day')).toBe('1 day');
    expect(plural(0, 'day')).toBe('0 days');
  });
});
