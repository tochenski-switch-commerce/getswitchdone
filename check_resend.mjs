import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');

const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.join('=').trim();
  }
});

const resend = new Resend(env.RESEND_API_KEY);

async function checkDomains() {
  try {
    const { data, error } = await resend.domains.list();
    if (error) {
      console.error('Error fetching domains:', error);
      return;
    }
    console.log('Domains:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('API call failed:', err.message);
  }
}

checkDomains();
