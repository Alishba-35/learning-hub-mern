import User from '../models/User.js';
import { MailNotConfiguredError, sendMail } from '../utils/mailer.js';
import { studentEmail } from '../utils/mailTemplates.js';

const BATCH = 5; // ek saath itni emails (SMTP server par bojh na pare)

// Admin ke chune hue students ko seedha email. Har student ko alag email jati hai, taake kisi ko doosron ke address na dikhein.
export async function emailStudents(req, res) {
  const { userIds, subject, message } = req.body;
  const users = await User.find({ _id: { $in: userIds }, role: 'student', disabled: { $ne: true } })
    .select('name email')
    .lean();
  if (users.length === 0) return res.status(404).json({ message: 'No active students found for this email' });

  let sent = 0;
  let failed = 0;
  let logged = 0;
  for (let i = 0; i < users.length; i += BATCH) {
    const results = await Promise.allSettled(
      users.slice(i, i + BATCH).map((u) => sendMail({ to: u.email, ...studentEmail({ name: u.name, subject, message }) }))
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        sent += 1;
        if (r.value.logged) logged += 1;
      } else if (r.reason instanceof MailNotConfiguredError) {
        return res.status(503).json({ message: 'Email is not set up on the server yet. Add the SMTP settings (see .env.example).' });
      } else {
        failed += 1;
        console.error('Could not email a student:', r.reason?.message);
      }
    }
  }
  res.json({ sent, failed, skipped: userIds.length - users.length, devLogged: logged > 0 });
}
