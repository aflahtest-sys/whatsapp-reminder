#!/usr/bin/env node
'use strict';

/**
 * Set an account's password from the command line.
 *
 * The escape hatch for when nobody can get in: the email service is down, the
 * reset link never arrives, or the only admin has forgotten everything. Runs
 * against the database directly, so it needs the same .env as the server.
 *
 *   cd backend
 *   node scripts/set-password.js someone@ifdc.om
 *
 * The password is typed at a prompt, not passed as an argument, so it does not
 * end up in shell history or in the list of running processes.
 */

const readline = require('readline');
const bcrypt = require('bcryptjs');

const config = require('../lib/config');
const supabase = require('../lib/db');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => (rl.close(), resolve(a.trim()))));
}

/** Prompt without echoing what is typed. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;

    rl._writeToOutput = function write(chunk) {
      if (!muted) rl.output.write(chunk);
    };

    rl.question(question, (answer) => {
      muted = false;
      rl.output.write('\n');
      rl.close();
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  const email = String(process.argv[2] || '').toLowerCase().trim();

  if (!email) {
    console.error('\nUsage: node scripts/set-password.js <email>\n');
    const { data } = await supabase.from('users').select('email').order('created_at');
    if (data && data.length) {
      console.error('Accounts in this database:');
      for (const u of data) console.error(`  ${u.email}`);
      console.error('');
    }
    process.exit(1);
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error(`\nCould not reach the database: ${error.message}\n`);
    process.exit(1);
  }
  if (!user) {
    console.error(`\nNo account with the email "${email}".\n`);
    process.exit(1);
  }

  console.log(`\nSetting a new password for ${user.email}`);
  console.log('(nothing is shown as you type)\n');

  const password = await askHidden('New password: ');
  if (password.length < 8) {
    console.error('\nPassword must be at least 8 characters. Nothing was changed.\n');
    process.exit(1);
  }

  const again = await askHidden('Type it again: ');
  if (password !== again) {
    console.error('\nThose did not match. Nothing was changed.\n');
    process.exit(1);
  }

  const confirm = await ask(`\nChange the password for ${user.email}? (yes/no) `);
  if (confirm.toLowerCase() !== 'yes') {
    console.log('\nCancelled. Nothing was changed.\n');
    process.exit(0);
  }

  const now = new Date().toISOString();
  const password_hash = await bcrypt.hash(password, 12);

  const { error: updateError } = await supabase
    .from('users')
    .update({ password_hash, password_changed_at: now })
    .eq('id', user.id);

  if (updateError) {
    console.error(`\nFailed: ${updateError.message}\n`);
    process.exit(1);
  }

  // Any reset emails still sitting in an inbox are now void.
  await supabase.from('password_resets').delete().eq('user_id', user.id).is('used_at', null);

  console.log(`\nDone. ${user.email} can sign in with the new password.`);
  console.log('Sessions on other devices have been signed out.');
  console.log(`Database: ${config.supabaseUrl}\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`\nUnexpected error: ${err.message}\n`);
  process.exit(1);
});
