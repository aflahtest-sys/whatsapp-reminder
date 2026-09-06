'use strict';

const config = require('./config');

/**
 * Sends email through Resend's HTTP API.
 *
 * Deliberately no SDK: Node 22 has fetch built in, and one more dependency in a
 * project that already pulls a headless browser is not worth it.
 */

const ENDPOINT = 'https://api.resend.com/emails';

function isConfigured() {
  return Boolean(config.resendApiKey && config.mailFrom);
}

async function sendMail({ to, subject, html, text }) {
  if (!isConfigured()) {
    return { ok: false, error: 'Email is not configured on the server', configured: false };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: config.mailFrom, to: [to], subject, html, text }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Resend's message is genuinely useful here (unverified domain, bad key,
      // recipient not allowed on the free tier), so keep it for the logs.
      const detail = body && (body.message || body.name) ? `${body.name || ''} ${body.message || ''}`.trim() : res.statusText;
      console.error(`[mail] send failed (${res.status}): ${detail}`);
      return { ok: false, error: detail, configured: true, status: res.status };
    }

    return { ok: true, id: body.id, configured: true };
  } catch (err) {
    console.error('[mail] send threw:', err.message);
    return { ok: false, error: err.message, configured: true };
  }
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The reset email.
 *
 * Plain, single-column, inline styles only -- that is what survives Outlook and
 * Gmail. The raw link is shown as text as well as linked, because some clients
 * strip anchors and some people paste rather than click.
 */
function resetPasswordEmail({ url, minutes }) {
  const safeUrl = escapeHtml(url);

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f7f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#101619;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dce2e5;border-radius:6px;">
    <tr><td style="padding:28px 28px 8px;">
      <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;">Reset your password</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#47535a;">
        Someone asked to reset the password for this WhatsApp Reminders account.
        If that was you, use the button below. The link works once and expires in
        ${Number(minutes)} minutes.
      </p>
      <p style="margin:0 0 22px;">
        <a href="${safeUrl}" style="display:inline-block;background:#0b666d;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:5px;font-size:15px;font-weight:600;">Set a new password</a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#78858d;">
        If the button does nothing, copy this address into your browser:
      </p>
      <p style="margin:0 0 22px;font-size:12px;line-height:1.5;word-break:break-all;color:#0b666d;">${safeUrl}</p>
      <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#78858d;">
        Didn't ask for this? Ignore this email. Your password stays as it is, and
        nobody can use this link without opening it themselves.
      </p>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    'Reset your password',
    '',
    'Someone asked to reset the password for this WhatsApp Reminders account.',
    `If that was you, open this link. It works once and expires in ${Number(minutes)} minutes.`,
    '',
    url,
    '',
    "Didn't ask for this? Ignore this email. Your password stays as it is.",
  ].join('\n');

  return { subject: 'Reset your WhatsApp Reminders password', html, text };
}

module.exports = { isConfigured, sendMail, resetPasswordEmail, escapeHtml };
