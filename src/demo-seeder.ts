/**
 * Demo Seeder — runs inside Docker, continuously injects jobs
 * so the dashboard always has live activity for demos.
 * 
 * This is intentionally simple: just a loop that authenticates once,
 * then POSTs a job every 4 seconds, rotating through job types.
 */

import dotenv from 'dotenv';
dotenv.config();

const API_URL = process.env.API_URL || 'http://api:3000';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'secret123';
const INTERVAL_MS = parseInt(process.env.SEED_INTERVAL_MS || '4000', 10);

const JOB_TYPES = ['welcome_email', 'password_reset', 'weekly_digest'];

let token: string | null = null;
let jobIndex = 0;

async function authenticate(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    });
    const data = await res.json() as { token?: string };
    if (data.token) {
      token = data.token;
      console.log('[SEEDER] Authenticated successfully.');
      return true;
    }
    return false;
  } catch (err) {
    console.error('[SEEDER] Auth failed:', (err as Error).message);
    return false;
  }
}

async function injectJob(): Promise<void> {
  if (!token) return;

  const type = JOB_TYPES[jobIndex % JOB_TYPES.length];
  jobIndex++;

  try {
    const res = await fetch(`${API_URL}/api/v1/queues/emails/jobs`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ 
        type,
        payload: { seeder: true, demo: true, index: jobIndex } 
      }),
    });

    if (res.status === 401) {
      console.log('[SEEDER] Token expired, re-authenticating...');
      token = null;
      await authenticate();
      return;
    }

    console.log(`[SEEDER] Injected job #${jobIndex}: ${type}`);
  } catch (err) {
    console.error('[SEEDER] Inject failed:', (err as Error).message);
  }
}

async function main() {
  console.log(`[SEEDER] Starting demo seeder — injecting jobs every ${INTERVAL_MS}ms`);
  
  // Wait 8 seconds for the API to be ready before first request
  console.log('[SEEDER] Waiting 8s for API to be ready...');
  await new Promise(r => setTimeout(r, 8000));

  const authed = await authenticate();
  if (!authed) {
    console.error('[SEEDER] Could not authenticate. Retrying in 10s...');
    await new Promise(r => setTimeout(r, 10000));
    await main();
    return;
  }

  setInterval(injectJob, INTERVAL_MS);
}

main();
