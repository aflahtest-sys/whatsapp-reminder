'use strict';

const { formatPhone } = require('./phone');

// Placeholders a template author may use. Anything else is rejected when the
// template is saved, so a client can never receive a literal "{nmae}".
const PLACEHOLDERS = {
  name: "The customer's name",
  phone: "The customer's phone number, e.g. +968 91234567",
  date: "Today's date, e.g. 26 August 2026",
  time: 'The time the message is sent, e.g. 09:00',
  day: 'The day of the week, e.g. Wednesday',
};

const PLACEHOLDER_KEYS = Object.keys(PLACEHOLDERS);

// Matches {name} and {{name}}, tolerating inner spaces: { name }
const TOKEN_RE = /\{\{?\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}?\}/g;

/** Every placeholder used in a template body, in order of appearance. */
function extractPlaceholders(body) {
  const found = [];
  const text = String(body || '');
  let match;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (!found.includes(match[1])) found.push(match[1]);
  }
  return found;
}

/** Placeholders that are not in the supported list. */
function unknownPlaceholders(body) {
  return extractPlaceholders(body).filter((k) => !PLACEHOLDER_KEYS.includes(k));
}

function formatInZone(date, timezone, options) {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, ...options }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-GB', options).format(date);
  }
}

/** The values a placeholder can resolve to for one specific recipient. */
function buildVariables(customer, { timezone = 'UTC', now = new Date() } = {}) {
  return {
    name: (customer && customer.name) || '',
    phone: customer && customer.phone ? formatPhone(customer.phone) : '',
    date: formatInZone(now, timezone, { day: 'numeric', month: 'long', year: 'numeric' }),
    time: formatInZone(now, timezone, { hour: '2-digit', minute: '2-digit', hour12: false }),
    day: formatInZone(now, timezone, { weekday: 'long' }),
  };
}

/**
 * Substitute placeholders into a template body.
 *
 * The original backend sent `template.body` straight to WhatsApp, so every client
 * received a message beginning "Hi {name},". Unknown tokens are deliberately left
 * untouched rather than blanked -- "Hi ," reads like a broken system, whereas the
 * visible token tells you exactly which placeholder to fix.
 */
function renderTemplate(body, variables = {}) {
  const text = String(body || '');
  TOKEN_RE.lastIndex = 0;
  return text.replace(TOKEN_RE, (whole, key) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : whole
  );
}

/** Convenience: render for a customer in one call. */
function renderForCustomer(body, customer, options) {
  return renderTemplate(body, buildVariables(customer, options));
}

module.exports = {
  PLACEHOLDERS,
  PLACEHOLDER_KEYS,
  extractPlaceholders,
  unknownPlaceholders,
  buildVariables,
  renderTemplate,
  renderForCustomer,
};
