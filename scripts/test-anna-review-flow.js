import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const baseUrl = process.env.ANNA_HARNESS_URL || 'http://127.0.0.1:5182';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

let delayNextStorageWrite = false;
await page.route('**/api/session/call', async route => {
  let payload = {};
  try { payload = JSON.parse(route.request().postData() || '{}'); } catch {}
  if (delayNextStorageWrite && payload.ns === 'storage' && payload.method === 'set') {
    delayNextStorageWrite = false;
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  await route.continue();
});

await page.goto(baseUrl, { waitUntil: 'networkidle' });
const findAppFrame = () => page.frames().find(candidate => candidate !== page.mainFrame() && candidate.url().includes('/anna-apps/'));
let frame = findAppFrame();
if (!frame) throw new Error('Anna App iframe was not found.');

await frame.getByRole('button', { name: 'Start with a goal' }).click();
await frame.locator('[name="title"]').fill('秋招');
await frame.locator('[name="outcome"]').fill('拿到2个offer');
await frame.locator('[name="category"]').selectOption('Work');
await frame.getByRole('button', { name: 'Create goal' }).click();
await frame.locator('#ai-consent').check();
await frame.getByRole('button', { name: 'Build my action plan' }).click();
await frame.getByText('Your action plan is ready.', { exact: true }).waitFor();

delayNextStorageWrite = true;
await frame.getByRole('button', { name: 'Mark complete' }).click();
await frame.getByText('20%', { exact: true }).waitFor();
await frame.locator('.sync-indicator').getByText('Saving progress…', { exact: true }).waitFor();
assert.equal(await frame.getByText('20%', { exact: true }).isVisible(), true, 'completion should update immediately');
await frame.getByText('Progress saved.', { exact: true }).waitFor();

await frame.locator('#update-form textarea').fill('市场相关岗位');
await frame.getByRole('button', { name: 'Save update' }).click();
await frame.getByText('New context is saved.', { exact: true }).waitFor();
await frame.getByText('The current plan and questions have not changed yet. Rebuild with Anna to include your latest update.', { exact: true }).waitFor();

await frame.goto(frame.url(), { waitUntil: 'networkidle' });
await frame.getByRole('button', { name: 'Continue last goal' }).click();
await frame.getByText('市场相关岗位', { exact: true }).waitFor();
assert.equal(await frame.getByText('20%', { exact: true }).isVisible(), true, 'progress should persist after remount');

await frame.getByRole('button', { name: 'Rebuild plan with Anna' }).click();
await frame.getByRole('button', { name: 'Rebuild plan', exact: true }).click();
await frame.locator('#ai-consent').check();
await frame.getByRole('button', { name: 'Build my action plan' }).click();
await frame.getByText('Your action plan is ready.', { exact: true }).waitFor();
await frame.getByText('市场相关岗位', { exact: true }).waitFor();
assert.equal(await frame.getByText('New context is saved.', { exact: true }).count(), 0, 'rebuild should clear the stale-plan notice');

await frame.getByRole('button', { name: 'Close as resolved' }).click();
await frame.locator('#resolution-input').fill('Received two offers and selected the best fit.');
await frame.getByRole('button', { name: 'Close as resolved', exact: true }).last().click();
await frame.getByText('Goal closed as resolved.', { exact: true }).waitFor();
await frame.getByText('Received two offers and selected the best fit.', { exact: true }).waitFor();
assert.equal(await frame.getByRole('button', { name: 'Reopen' }).isVisible(), true, 'resolved goal should show a reopen action');

console.log('PASS reviewer flow: completion feedback, update guidance, remount persistence, rebuild, and resolution');
await browser.close();
