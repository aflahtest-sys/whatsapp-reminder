'use strict';

require('dotenv').config();

const {
  SUPABASE_URL,
  SUPABASE_KEY,
  JWT_SECRET,
  PORT,
  CLIENT_ORIGIN,
  WA_SESSION_PATH,
  PUPPETEER_EXECUTABLE_PATH,
  DEFAULT_COUNTRY_CODE,
  APP_TIMEZONE,
  NODE_ENV,
} = process.env;

const missing = [];
if (!SUPABASE_URL) missing.push('SUPABASE_URL');
if (!SUPABASE_KEY) missing.push('SUPABASE_KEY');
if (!JWT_SECRET) missing.push('JWT_SECRET');

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill it in.');
  process.exit(1);
}

// A short secret makes the JWT signature guessable. Refuse to start in production.
if (JWT_SECRET.length < 32) {
  const message =
    'JWT_SECRET is shorter than 32 characters. Generate one with: openssl rand -hex 32';
  if (NODE_ENV === 'production') {
    console.error(message);
    process.exit(1);
  }
  console.warn(`[config] WARNING: ${message}`);
}

const allowedOrigins = String(CLIENT_ORIGIN || '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

if (!allowedOrigins.length && NODE_ENV === 'production') {
  console.warn(
    '[config] WARNING: CLIENT_ORIGIN is not set, so CORS allows every origin. ' +
      'Set it to your frontend URL before going live.'
  );
}

module.exports = {
  isProduction: NODE_ENV === 'production',
  supabaseUrl: SUPABASE_URL,
  supabaseKey: SUPABASE_KEY,
  jwtSecret: JWT_SECRET,
  port: Number(PORT) || 8080,
  allowedOrigins,

  // Where whatsapp-web.js keeps its logged-in browser profile. On Railway this
  // MUST point at a mounted volume, otherwise every redeploy wipes the login
  // and you have to scan the QR code again.
  waSessionPath: WA_SESSION_PATH || './.wwebjs_auth',
  puppeteerExecutablePath: PUPPETEER_EXECUTABLE_PATH || undefined,

  // Numbers typed without a country code are assumed to be from here.
  // 968 = Oman. Change it if your clients are elsewhere.
  defaultCountryCode: String(DEFAULT_COUNTRY_CODE || '968').replace(/\D/g, ''),

  // Used to render {date} / {time} / {day} inside message templates.
  timezone: APP_TIMEZONE || 'Asia/Muscat',

  scheduler: {
    // How many schedules to look at per tick.
    batchSize: 25,
    // Pause between individual messages. Sending dozens back-to-back is the
    // single strongest signal WhatsApp uses to flag an account as a spammer.
    minGapMs: 5000,
    maxGapMs: 14000,
    // Upper bound on recipients for a single run of one schedule. Anything above
    // this is logged rather than silently truncated.
    maxRecipientsPerRun: 500,
    // Give up on a one-off send that has been stuck this long.
    graceHours: 24,
    // How many real send failures before a one-off send is marked failed.
    maxAttempts: 5,
    // A claimed job older than this is assumed to be from a crashed process.
    lockTimeoutMs: 10 * 60 * 1000,
  },
};
