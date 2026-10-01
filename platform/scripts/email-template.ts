// Installs the branded emails in a Supabase project on supabase.com: sign-up confirmation
// (supabase/templates/confirmation.html) and the password reset code (supabase/templates/recovery.html).
// Usage: npm run email:template
//
// Email apps load the logo from a public web address. The template points at the site's own
// /assets/email-logo.png, which only works once the site is online, so this uploads the logo to a public
// "brand" storage bucket in the project and uses that address instead. Then it sets the "Confirm signup" and
// "Reset password" subjects and bodies through the Supabase Management API, with a personal access token:
// SUPABASE_ACCESS_TOKEN in .env.local, or the one `npx supabase login` saved. Without a token it writes
// confirm-signup-email.html and reset-password-email.html to paste into the dashboard by hand. The local Supabase stack (npm run db:start) uses the template
// directly, through supabase/config.toml.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (see .env.example).');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const BUCKET = 'brand';
const LOGO = 'email-logo.png';
// Dashboard name, Management API key, template file, subject, and the file written for pasting by hand.
const EMAILS = [
  { name: 'Confirm signup', key: 'confirmation', file: 'confirmation.html', subject: 'Confirm your email for Last Bite 🥡', out: 'confirm-signup-email.html' },
  { name: 'Reset password', key: 'recovery', file: 'recovery.html', subject: 'Your Last Bite password reset code', out: 'reset-password-email.html' },
];

async function main() {
  const bucket = await db.storage.getBucket(BUCKET);
  if (bucket.error) {
    const created = await db.storage.createBucket(BUCKET, { public: true });
    if (created.error) throw new Error(`create the ${BUCKET} bucket: ${created.error.message}`);
  }
  const upload = await db.storage.from(BUCKET).upload(LOGO, fs.readFileSync(`public/assets/${LOGO}`), {
    contentType: 'image/png', cacheControl: '86400', upsert: true,
  });
  if (upload.error) throw new Error(`upload the logo: ${upload.error.message}`);
  const logoUrl = db.storage.from(BUCKET).getPublicUrl(LOGO).data.publicUrl;

  const html = (file: string) => fs.readFileSync(`supabase/templates/${file}`, 'utf8').replaceAll('{{ .SiteURL }}/assets/email-logo.png', logoUrl);
  console.log(`Logo uploaded: ${logoUrl}`);

  const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(url!)?.[1];
  const token = accessToken();
  if (ref && token) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(EMAILS.flatMap((e) => [
        [`mailer_subjects_${e.key}`, e.subject],
        [`mailer_templates_${e.key}_content`, html(e.file)],
      ]))),
    });
    if (res.ok) {
      console.log(`Installed the ${EMAILS.map((e) => `"${e.name}"`).join(' and ')} emails in project ${ref}.
The sign-up button links to your Site URL (Authentication → URL Configuration), so keep that set to your site's address.
Password resets now email a 6-digit code (keep Authentication → Emails → "Email OTP Length" at 6).`);
      return;
    }
    console.log(`Couldn't install it automatically (${res.status}: ${(await res.text()).slice(0, 200)}).`);
    if (res.status === 401) console.log('The access token is invalid or expired: run npx supabase login again, or set a new SUPABASE_ACCESS_TOKEN.');
  } else if (!ref) {
    console.log('NEXT_PUBLIC_SUPABASE_URL is not a supabase.com project, so there is nothing to install: the local stack uses supabase/config.toml.');
  } else {
    console.log(`No Supabase access token found, so the email can't be installed automatically. Either run npx supabase login, or create
a token at https://supabase.com/dashboard/account/tokens and add SUPABASE_ACCESS_TOKEN=... to .env.local, then run this again.`);
  }

  for (const e of EMAILS) {
    fs.writeFileSync(e.out, html(e.file));
    console.log(`Or paste it by hand: wrote ${e.out}.
  1. Supabase dashboard → Authentication → Emails → "${e.name}".
  2. Subject:  ${e.subject}
  3. Body: switch to the source (<>) view, delete what is there, and paste the whole of ${e.out}. Save.`);
  }
}

// A personal access token: SUPABASE_ACCESS_TOKEN, or the file `npx supabase login` writes when it can't use the
// system keychain.
function accessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim();
  const file = path.join(os.homedir(), '.supabase', 'access-token');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : null;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
