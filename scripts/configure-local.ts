/** Configure the frontend for the local stack without exposing server keys. */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
process.chdir(resolve(import.meta.dirname, '..'));
let status;
try {
  status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
} catch {
  console.error('Cannot read local Supabase status. Start Docker and run supabase start, then retry. Docker access is required.');
  process.exit(1);
}
if (!/^http:\/\/(127\.0\.0\.1|localhost):55321$/.test(status.API_URL)) throw new Error('Expected the local vocab-garden stack on port 55321.');
const key = status.PUBLISHABLE_KEY || status.ANON_KEY;
if (typeof key !== 'string' || !key) throw new Error('Local Supabase did not return a public key.');
const values: Record<string, string> = {
  VITE_SUPABASE_URL: status.API_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: key,
  VITE_BASE_PATH: '/',
};
const previous = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
const lines = previous.split('\n').filter(line => !/^\s*(?:export\s+)?(VITE_SUPABASE_URL|VITE_SUPABASE_PUBLISHABLE_KEY|VITE_BASE_PATH)\s*=/.test(line));
const content = [lines.join('\n').trimEnd(), ...Object.entries(values).map(([name, value]) => `${name}=${value}`)].filter(Boolean).join('\n') + '\n';
writeFileSync('.env.local', content, { mode: 0o600 });
chmodSync('.env.local', 0o600);
console.log('Configured .env.local for local Supabase. Only the public browser key was saved. Restart Vite if it is running.');
