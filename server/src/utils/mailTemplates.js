import { env } from '../config/env.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const paragraphs = (text) => esc(text).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/\n/g, '<br>')}</p>`).join('');

// Learning Hub ke rang: gehra navy + purple
function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f1f0fa;padding:24px 12px;font-family:Segoe UI,Arial,sans-serif;color:#0d1033">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#0d1033;padding:18px 24px;color:#ffffff;font-size:20px;font-weight:700">Learning <span style="color:#a78bfa">Hub</span></td></tr>
<tr><td style="padding:26px 24px 8px"><h1 style="margin:0 0 16px;font-size:20px">${esc(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:8px 24px 22px;color:#6b7280;font-size:12px">Learn · Practice · Grow</td></tr>
</table></td></tr></table></body></html>`;
}

export function otpEmail({ name, otp, minutes }) {
  const first = String(name || '').split(' ')[0] || 'there';
  return {
    subject: `${otp} is your Learning Hub password reset code`,
    text: `Hi ${first},\n\nYour Learning Hub password reset code is ${otp}.\nIt is valid for ${minutes} minutes. Do not share it with anyone.\n\nIf you did not ask for this, you can ignore this email. Your password will not change.\n`,
    html: layout(
      'Reset your password',
      `<p style="margin:0 0 14px;line-height:1.6">Hi ${esc(first)}, use this code to reset your password:</p>
<p style="margin:0 0 14px;font-size:34px;letter-spacing:8px;font-weight:700;color:#4814c4">${esc(otp)}</p>
<p style="margin:0 0 14px;line-height:1.6">It is valid for ${minutes} minutes. Do not share it with anyone.</p>
<p style="margin:0;color:#6b7280;font-size:13px">If you did not ask for this, you can ignore this email. Your password will not change.</p>`
    ),
  };
}

// Teacher/admin ka paigham ek student ko
export function studentEmail({ name, subject, message }) {
  const first = String(name || '').split(' ')[0] || 'there';
  const link = String(env.clientOrigin || '').replace(/\/+$/, '');
  return {
    subject,
    text: `Hi ${first},\n\n${message}\n\n${link ? `Open Learning Hub: ${link}\n` : ''}`,
    html: layout(
      subject,
      `<p style="margin:0 0 14px;line-height:1.6">Hi ${esc(first)},</p>${paragraphs(message)}${
        link ? `<p style="margin:18px 0 0"><a href="${esc(link)}" style="background:#4814c4;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block">Open Learning Hub</a></p>` : ''
      }`
    ),
  };
}
