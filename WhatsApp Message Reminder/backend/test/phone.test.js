'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { parsePhone, normalizePhone, formatPhone, toWhatsAppId } = require('../lib/phone');

test('accepts numbers written the way people actually type them', () => {
  const variants = ['+968 9123 4567', '+96891234567', '00968 91234567', '(968) 9123-4567'];
  for (const v of variants) {
    const parsed = parsePhone(v, '968');
    assert.ok(parsed.ok, `${v} should be accepted: ${parsed.error}`);
    assert.strictEqual(parsed.phone, '96891234567', `${v} normalised wrongly`);
  }
});

test('a bare local number takes the default country code', () => {
  const parsed = parsePhone('91234567', '968');
  assert.ok(parsed.ok);
  assert.strictEqual(parsed.phone, '96891234567');
  assert.strictEqual(parsed.assumedCountry, true, 'caller should be told a guess was made');
});

test('a trunk zero is stripped before the country code is added', () => {
  const parsed = parsePhone('091234567', '968');
  assert.ok(parsed.ok);
  assert.strictEqual(parsed.phone, '96891234567');
});

test('a local number is rejected when no default country code is configured', () => {
  // This is the quiet failure worth guarding: without a country code the message
  // does not bounce, it reaches a completely different person.
  const parsed = parsePhone('91234567', '');
  assert.strictEqual(parsed.ok, false);
  assert.match(parsed.error, /country code/i);
});

test('rejects nonsense input', () => {
  for (const bad of ['', '   ', 'abcdef', '+', '12']) {
    assert.strictEqual(parsePhone(bad, '968').ok, false, `${JSON.stringify(bad)} should fail`);
  }
});

test('rejects numbers longer than E.164 allows', () => {
  const parsed = parsePhone('+9689123456789012', '968');
  assert.strictEqual(parsed.ok, false);
  assert.match(parsed.error, /too long/i);
});

test('rejects an unknown country code', () => {
  const parsed = parsePhone('+99912345678', '968');
  assert.strictEqual(parsed.ok, false);
  assert.match(parsed.error, /country code/i);
});

test('recognises other Gulf country codes without help', () => {
  const cases = [
    ['+971501234567', '971501234567'],
    ['+966501234567', '966501234567'],
    ['+97455123456', '97455123456'],
  ];
  for (const [input, expected] of cases) {
    const parsed = parsePhone(input, '968');
    assert.ok(parsed.ok, `${input}: ${parsed.error}`);
    assert.strictEqual(parsed.phone, expected);
    assert.strictEqual(parsed.assumedCountry, false);
  }
});

test('a long number typed without a plus is not double-prefixed', () => {
  // Someone types their own country's full number with no "+". Prepending the
  // default again would produce 968968... and reach nobody.
  const parsed = parsePhone('96891234567', '968');
  assert.ok(parsed.ok);
  assert.strictEqual(parsed.phone, '96891234567');
  assert.strictEqual(parsed.assumedCountry, false);
});

test('a foreign number typed without a plus keeps its own country code', () => {
  const parsed = parsePhone('971501234567', '968');
  assert.ok(parsed.ok, parsed.error);
  assert.strictEqual(parsed.phone, '971501234567', 'must not become 968971...');
});

test('the same digits are never parsed two different ways', () => {
  // Whatever route a number takes through the parser, the stored value must be
  // identical -- otherwise the unique index lets the same client in twice and
  // they get every reminder in duplicate.
  const forms = ['+968 9123 4567', '00968 91234567', '96891234567', '91234567', '091234567'];
  const results = forms.map((f) => parsePhone(f, '968'));
  for (let i = 0; i < forms.length; i += 1) {
    assert.ok(results[i].ok, `${forms[i]}: ${results[i].error}`);
    assert.strictEqual(results[i].phone, '96891234567', `${forms[i]} stored differently`);
  }
});

test('normalizePhone strips everything that is not a digit', () => {
  assert.strictEqual(normalizePhone('+968 (9123) 4567'), '96891234567');
  assert.strictEqual(normalizePhone(null), '');
});

test('display and chat-id helpers', () => {
  assert.strictEqual(formatPhone('96891234567'), '+968 91234567');
  assert.strictEqual(toWhatsAppId('96891234567'), '96891234567@c.us');
});
