import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Live gate for the one-step quick start and the no-reply follow-up, against the
// APS-backed harness and a real model. Never sends a message; it removes the two
// synthetic goals it creates, including after failures.
const marker = `QA ${Date.now()}`;
const source = `Hi, thanks for applying for the Content Marketing Associate role (${marker}). Before we can move you to the interview stage, please send two examples of campaigns you worked on and confirm your availability for a 30-minute call next week. Please reply by Friday.`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
let frame;
const created = [];
const idle = () => frame.locator('.sync-indicator').waitFor({ state: 'detached', timeout: 160000 });
const appFrame = () => page.frames().find(item => item !== page.mainFrame() && item.url().includes('/anna-apps/'));
const failIfError = async () => { if (await frame.locator('.error-notice').count()) throw Error(await frame.locator('.error-notice').innerText()); };

try {
  await page.goto(process.env.ANNA_HARNESS_URL || 'http://127.0.0.1:5180', { waitUntil: 'networkidle' });
  frame = appFrame(); assert.ok(frame);

  const started = Date.now();
  await frame.getByLabel('Paste the message').fill(source);
  await frame.locator('#quick-form [name=consent]').check();
  await frame.getByRole('button', { name: 'Read it and draft my reply' }).click();
  await frame.locator('.workspace-page').waitFor(); created.push(await frame.getByRole('heading', { level: 1 }).innerText());
  await idle(); await failIfError();
  const seconds = Math.round((Date.now() - started) / 1000);
  const quotes = await frame.locator('.source-evidence blockquote').allTextContents();
  assert.ok(quotes.length >= 2, 'expected grounded quotes');
  for (const quote of quotes) assert.ok(source.includes(quote), `quote not found in source: ${quote}`);
  const body = await frame.locator('#response-form [name=body]').inputValue();
  assert.match(body, /campaign|example/i);
  assert.match(body, /\[[^\]]+\]/, 'missing details should be placeholders');
  assert.equal(await frame.getByLabel('Next check-in', { exact: true }).inputValue(), '', 'Friday must not be auto-scheduled');
  created[0] = await frame.getByRole('heading', { level: 1 }).innerText();
  console.log(`PASS live quick reply in ${seconds}s: "${created[0]}", ${quotes.length} grounded quotes, draft with placeholders`);

  await frame.locator('.brand').click();
  await frame.getByRole('button', { name: 'I haven’t heard back' }).click();
  await frame.getByLabel('Who are you waiting on?').fill(`Example recruiting ${marker}`);
  await frame.getByLabel('What did you last send them?').fill('Synthetic QA only. Applied for an analyst role on October 2 and followed up once on October 9.');
  await frame.locator('#quick-form [name=consent]').check();
  await frame.getByRole('button', { name: 'Draft my follow-up' }).click();
  await frame.locator('.workspace-page').waitFor(); created.push(`Example recruiting ${marker}`);
  await idle(); await failIfError();
  const nudge = await frame.locator('#nudge-form [name=body]').inputValue();
  assert.match(nudge, /analyst|application|follow/i);
  console.log('PASS live no-reply follow-up draft');
} finally {
  for (const title of created) {
    try {
      await idle();
      await frame.getByRole('button', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 25)) }).first().click();
      await frame.getByRole('button', { name: 'Delete goal', exact: true }).click();
      await frame.getByRole('dialog').getByRole('button', { name: 'Delete goal', exact: true }).click(); await idle();
      console.log(`CLEANED ${title}`);
    } catch (error) { console.error(`Cleanup required for ${title}: ${error.message}`); }
  }
  await browser.close();
}
