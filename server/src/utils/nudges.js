import { loadAtRiskGroups } from '../controllers/insightsController.js';
import NudgeLog from '../models/NudgeLog.js';
import Setting from '../models/Setting.js';
import { env } from '../config/env.js';
import { MailNotConfiguredError, sendMail } from './mailer.js';
import { studentEmail } from './mailTemplates.js';

export const GROUP_KEYS = ['inactive', 'neverStarted', 'streakBroken'];
export const COOLDOWN_DAYS = 7; // ek student ko hafte mein ek se zyada nudge nahi
const BATCH = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

// Tayyar paigham har group ka (client mein bhi yahi alfaaz hain)
export const NUDGE_MESSAGES = {
  inactive: { subject: 'We miss you on Learning Hub', body: 'We have not seen you for a while. Pick up where you left off, your next lesson is waiting.' },
  neverStarted: { subject: 'Start your first lesson on Learning Hub', body: 'Welcome to Learning Hub! Begin with your first lesson. It only takes a few minutes.' },
  streakBroken: { subject: 'Keep your streak going on Learning Hub', body: 'Your learning streak took a break. Finish one lesson today to start a new one!' },
};

const DEFAULT_AUTO = { enabled: false, groups: [...GROUP_KEYS], lastRun: null };

export async function getAutoSettings() {
  const doc = await Setting.findOne({ key: 'autoNudges' }).lean();
  return { ...DEFAULT_AUTO, ...(doc?.value || {}) };
}

export async function saveAutoSettings(patch) {
  const next = { ...(await getAutoSettings()), ...patch };
  await Setting.findOneAndUpdate({ key: 'autoNudges' }, { value: next }, { upsert: true });
  return next;
}

// Chune hue groups ke students ko tayyar paigham bhejo. Jise pichle 7 din mein nudge gayi ho, use chhod do.
// max: ek baar mein zyada se zyada itni emails (Gmail ki roz ki hadd ke liye).
export async function sendNudges({ groups, auto = false, max = Infinity }) {
  const rows = await loadAtRiskGroups();
  const since = new Date(Date.now() - COOLDOWN_DAYS * DAY_MS);
  const recent = new Set((await NudgeLog.find({ sentAt: { $gte: since } }).select('user -_id').lean()).map((l) => String(l.user)));

  const queue = [];
  let skippedRecent = 0;
  for (const group of groups) {
    for (const s of rows[group] || []) {
      if (recent.has(s.id)) skippedRecent += 1;
      else queue.push({ group, student: s });
    }
  }

  const result = { sent: 0, failed: 0, skippedRecent, waiting: 0, devLogged: false };
  let i = 0;
  while (i < queue.length) {
    if (result.sent >= max) {
      result.waiting = queue.length - i; // kal agli baari
      break;
    }
    const part = queue.slice(i, i + Math.min(BATCH, max - result.sent));
    i += part.length;
    const settled = await Promise.allSettled(
      part.map(({ group, student }) => sendMail({ to: student.email, ...studentEmail({ name: student.name, ...NUDGE_MESSAGES[group], message: NUDGE_MESSAGES[group].body }) }))
    );
    const logs = [];
    settled.forEach((r, k) => {
      if (r.status === 'fulfilled') {
        result.sent += 1;
        if (r.value.logged) result.devLogged = true;
        logs.push({ user: part[k].student.id, group: part[k].group, auto });
      } else if (r.reason instanceof MailNotConfiguredError) {
        throw r.reason;
      } else {
        result.failed += 1;
        console.error('Could not send a nudge email:', r.reason?.message);
      }
    });
    if (logs.length) await NudgeLog.insertMany(logs);
  }
  return result;
}

// Roz wali (Vercel Cron) automatic emails: sirf tab jab admin ne on ki hon
export async function runAutoNudges() {
  const settings = await getAutoSettings();
  if (!settings.enabled) return { ran: false, reason: 'Automatic emails are switched off' };
  const groups = settings.groups.filter((g) => GROUP_KEYS.includes(g));
  const result = await sendNudges({ groups, auto: true, max: env.autoNudgeMax });
  await saveAutoSettings({ lastRun: { at: new Date().toISOString(), sent: result.sent, failed: result.failed, skippedRecent: result.skippedRecent, waiting: result.waiting } });
  return { ran: true, ...result };
}
