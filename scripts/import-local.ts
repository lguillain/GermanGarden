/** Import every local SQLite profile into this project's local Supabase stack.
 * Auth accounts are created through the Admin API; data loads in one SQL transaction.
 * No hosted project URLs or keys are accepted.
 */
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, renameSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

type Account = { email: string; password: string | null; userId?: string };
type Credentials = { url: string; accounts: Record<string, Account> };
const root = resolve(import.meta.dirname, '..');
process.chdir(root);
const profiles = readdirSync('data/profiles').filter(name => name.endsWith('.sqlite')).sort();
if (!profiles.length) throw new Error('No profiles found in data/profiles.');
for (const file of profiles) if (!/^[a-z0-9_-]+\.sqlite$/i.test(file)) throw new Error(`Unsupported profile filename: ${file}`);
const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
if (!/^http:\/\/(127\.0\.0\.1|localhost):55321$/.test(status.API_URL)) throw new Error('This importer only supports the local vocab-garden Supabase stack on port 55321.');
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const credentialsPath = 'data/local-supabase-accounts.json';
const credentials: Credentials = existsSync(credentialsPath) ? JSON.parse(readFileSync(credentialsPath, 'utf8')) : { url: status.API_URL, accounts: {} };
if (credentials.url !== status.API_URL) throw new Error('The saved accounts belong to a different local Supabase URL.');
function privateFile(path: string, content: string) {
  writeFileSync(`${path}.tmp`, content, { mode: 0o600 });
  chmodSync(`${path}.tmp`, 0o600);
  renameSync(`${path}.tmp`, path);
}
function saveCredentials() { privateFile(credentialsPath, JSON.stringify(credentials, null, 2) + '\n'); }
const accounts = [];
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw error;
  accounts.push(...data.users);
  if (data.users.length < 100) break;
}
// Validate every source before creating any accounts. These dummy UUIDs are used
// only to build the preflight SQL; it is never executed.
const preflight = Object.fromEntries(profiles.map((file, i) => [`data/profiles/${file}`, `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`]));
mkdirSync('data', { recursive: true });
privateFile('data/local-supabase-profiles.json', JSON.stringify(preflight));
execFileSync('python3', ['scripts/export-supabase.py', '--profiles-map', 'data/local-supabase-profiles.json', '--skip-existing', '--output', 'data/local-supabase-import.sql'], { stdio: ['ignore', 'pipe', 'pipe'] });
const mapping: Record<string, string> = {};
const imported: { slug: string; email: string; userId: string; existing: boolean }[] = [];
for (const file of profiles) {
  const slug = file.slice(0, -7), email = `${slug}@vocab-garden.test`;
  let user = accounts.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (user && (user.app_metadata?.local_profile !== slug || user.app_metadata?.imported_by !== 'vocab-garden')) {
    throw new Error(`Account ${email} already exists and was not created by this importer. It has not been changed.`);
  }
  if (!user) {
    const password = credentials.accounts[slug]?.password || randomBytes(24).toString('base64url');
    credentials.accounts[slug] = { email, password };
    saveCredentials(); // Save before creation so an interrupted run can resume.
    const result = await admin.auth.admin.createUser({ email, password, email_confirm: true,
      app_metadata: { local_profile: slug, imported_by: 'vocab-garden' }, user_metadata: { name: slug } });
    if (result.error) throw result.error;
    user = result.data.user;
  }
  credentials.accounts[slug] = { email, password: credentials.accounts[slug]?.password || null, userId: user.id };
  saveCredentials();
  mapping[`data/profiles/${file}`] = user.id;
  const result = await admin.from('learner_state').select('user_id').eq('user_id', user.id).maybeSingle();
  if (result.error) throw result.error;
  imported.push({ slug, email, userId: user.id, existing: !!result.data });
}
privateFile('data/local-supabase-profiles.json', JSON.stringify(mapping, null, 2) + '\n');
execFileSync('python3', ['scripts/export-supabase.py', '--profiles-map', 'data/local-supabase-profiles.json', '--skip-existing', '--output', 'data/local-supabase-import.sql'], { stdio: ['ignore', 'pipe', 'pipe'] });
// Avoid passing SQL or secrets in process arguments or printing private records.
try {
  execFileSync('docker', ['exec', '-i', 'supabase_db_vocab-garden', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
    input: readFileSync('data/local-supabase-import.sql'), stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 10 * 1024 * 1024,
  });
} catch { throw new Error('The data transaction failed and was rolled back. Accounts and saved credentials remain available for retry. Check the private data/local-supabase-import.sql file.'); }
for (const account of imported) {
  const { data, error } = await admin.from('learner_state').select('data').eq('user_id', account.userId).single();
  if (error) throw error;
  console.log(`${account.slug}: ${account.existing ? 'existing progress preserved' : 'imported'} (${data.data.swipes.length} word decisions, ${data.data.reviews.length} reviews) — ${account.email}`);
}
console.log(`All ${imported.length} profiles processed. Login passwords are saved in ${credentialsPath} (private, ignored by Git).`);
