import { MailNotConfiguredError } from '../utils/mailer.js';
import { COOLDOWN_DAYS, getAutoSettings, saveAutoSettings, sendNudges } from '../utils/nudges.js';
import { env } from '../config/env.js';

const notConfigured = (res) => res.status(503).json({ message: 'Email is not set up on the server yet. Add the SMTP settings (see .env.example).' });

// Ek click: ek group ke SAARE students ko tayyar paigham (sirf pehle 50 nahi)
export async function sendGroup(req, res) {
  try {
    res.json(await sendNudges({ groups: [req.body.group] }));
  } catch (err) {
    if (err instanceof MailNotConfiguredError) return notConfigured(res);
    throw err;
  }
}

export async function getAuto(req, res) {
  const s = await getAutoSettings();
  res.json({ ...s, cooldownDays: COOLDOWN_DAYS, dailyMax: env.autoNudgeMax, cronReady: Boolean(env.cronSecret) });
}

export async function setAuto(req, res) {
  const { enabled, groups } = req.body;
  const s = await saveAutoSettings({ enabled, ...(groups ? { groups } : {}) });
  res.json({ ...s, cooldownDays: COOLDOWN_DAYS, dailyMax: env.autoNudgeMax, cronReady: Boolean(env.cronSecret) });
}
