/* cloud-config.js - the only file you edit to connect a Supabase project.
 *
 * FILL IN THE TWO VALUES BELOW. Until you do, every page behaves exactly as it
 * did before cloud sync existed: work is kept in localStorage, no network call
 * is ever made, and the account control does not appear. That inert default is
 * deliberate - it is what lets this file be committed, and what makes "the
 * feature is off" the same code path as "the feature is offline".
 *
 * Both values are on the Supabase dashboard under Project Settings > API.
 *
 * THE ANON KEY IS NOT A SECRET, and it is important not to treat it as one. It
 * is designed to ship to browsers: it identifies the project and nothing else,
 * it grants no authority by itself, and it is visible in this file to anyone who
 * opens the page. What keeps one learner's work private is row-level security in
 * Baerilog/tools/schema.sql, where every policy tests `user_id = auth.uid()`
 * against a signed JWT. So committing this file is fine; what must never be
 * committed is the SERVICE ROLE key, which bypasses RLS entirely and belongs
 * nowhere near a browser.
 *
 * Loaded as a plain classic script before cloud.js, like every other file on
 * these pages - no module, no fetch, no build step, so a page still opens
 * straight off the filesystem.
 */
var BAERILOG_CLOUD_CONFIG = {
  url: 'https://jdzsbqrbatsjngfervvp.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkenNicXJiYXRzam5nZmVydnZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NTc2NjgsImV4cCI6MjEwMjAzMzY2OH0.7r01L4i6MvsiLFnfCV-bYT-qJoccwufOp1yelfUYMOQ'
};
