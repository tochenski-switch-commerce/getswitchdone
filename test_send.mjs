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

async function testSend() {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Lumio <test@getlumio.app>',
      to: 'trip@lumio.app',
      subject: 'Domain Test',
      html: '<p>Testing domain verification status.</p>'
    });
    
    if (error) {
      console.log('Send Error:', JSON.stringify(error, null, 2));
    } else {
      console.log('Send Success:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Execution failed:', err.message);
  }
}

testSend();
