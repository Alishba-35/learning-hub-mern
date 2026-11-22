import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export class MailNotConfiguredError extends Error {
  constructor() {
    super('Email is not set up on the server yet');
    this.name = 'MailNotConfiguredError';
  }
}

export const mailConfigured = () => Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);

let transport;
const getTransport = () => {
  transport ??= nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465, // 465 par seedha TLS, 587 par STARTTLS
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
  return transport;
};

// Ek email bhejo. SMTP set na ho: development mein email console mein dikhti hai (OTP wagera yahin se dekh sakte hain),
// production mein MailNotConfiguredError, taake koi chup-chap "bhej diya" na samjhe.
export async function sendMail({ to, subject, text, html }) {
  if (!mailConfigured()) {
    if (env.isProd) throw new MailNotConfiguredError();
    console.log(`\n[mail - SMTP not set, printing instead]\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return { sent: false, logged: true };
  }
  await getTransport().sendMail({ from: env.smtp.from, to, subject, text, html });
  return { sent: true, logged: false };
}
