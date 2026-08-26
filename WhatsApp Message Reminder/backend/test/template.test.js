'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  renderTemplate,
  renderForCustomer,
  extractPlaceholders,
  unknownPlaceholders,
  buildVariables,
} = require('../lib/template');

const CUSTOMER = { name: 'Aflah', phone: '96891234567' };
const AT = { timezone: 'Asia/Muscat', now: new Date('2026-08-26T05:30:00Z') }; // 09:30 local

test('substitutes {name} instead of sending it literally', () => {
  // The original backend passed template.body straight to WhatsApp, so every
  // client received a message starting "Hi {name},".
  const out = renderForCustomer('Hi {name}, your drone is due for a check.', CUSTOMER, AT);
  assert.strictEqual(out, 'Hi Aflah, your drone is due for a check.');
  assert.ok(!out.includes('{'), 'no placeholder may survive into a sent message');
});

test('supports both {name} and {{name}} styles, and inner spacing', () => {
  assert.strictEqual(renderForCustomer('{name}|{{name}}|{ name }', CUSTOMER, AT), 'Aflah|Aflah|Aflah');
});

test('renders date, time and day in the configured timezone', () => {
  const vars = buildVariables(CUSTOMER, AT);
  assert.strictEqual(vars.day, 'Wednesday');
  assert.strictEqual(vars.time, '09:30', 'Muscat is UTC+4, so 05:30Z is 09:30 local');
  assert.strictEqual(vars.date, '26 August 2026');
  assert.strictEqual(vars.phone, '+968 91234567');
});

test('an unknown placeholder is left visible rather than blanked', () => {
  // "Hi ," reads like a broken system; "{nmae}" tells you exactly what to fix.
  assert.strictEqual(renderTemplate('Hi {nmae},', { name: 'Aflah' }), 'Hi {nmae},');
});

test('detects unknown placeholders so templates can be rejected at save time', () => {
  assert.deepStrictEqual(unknownPlaceholders('Hi {name}, ref {order_id}'), ['order_id']);
  assert.deepStrictEqual(unknownPlaceholders('Hi {name} on {day}'), []);
});

test('extractPlaceholders lists each placeholder once, in order', () => {
  assert.deepStrictEqual(extractPlaceholders('{name} {day} {name}'), ['name', 'day']);
});

test('handles templates with no placeholders and empty bodies', () => {
  assert.strictEqual(renderForCustomer('Workshop closed Friday.', CUSTOMER, AT), 'Workshop closed Friday.');
  assert.strictEqual(renderForCustomer('', CUSTOMER, AT), '');
  assert.strictEqual(renderForCustomer(null, CUSTOMER, AT), '');
});

test('a missing customer name does not crash the render', () => {
  assert.strictEqual(renderForCustomer('Hi {name}!', {}, AT), 'Hi !');
});
