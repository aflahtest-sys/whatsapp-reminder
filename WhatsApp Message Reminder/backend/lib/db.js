'use strict';

const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

// The service role key bypasses row level security, which is why every query in
// this codebase must filter by user_id. See the note at the bottom of schema.sql.
const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = supabase;
