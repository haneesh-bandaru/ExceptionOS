import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const baseUrl = process.env.ANNA_HARNESS_URL || 'http://127.0.0.1:5183';
const mode = process.env.ANNA_APS_TEST_MODE || 'seed';
const title = 'ExceptionOS APS persistence check 2026-10-20';
const update = 'History should survive a completely new Anna App session.';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(baseUrl, { waitUntil: 'networkidle' });
const frame = page.frames().find(candidate => candidate !== page.mainFrame() && candidate.url().includes('/anna-apps/'));
if (!frame) throw new Error('Anna App iframe was not found.');

if (mode === 'seed') {
  const existing = frame.getByRole('button', { name: new RegExp(title) });
  if (await existing.count()) {
    await existing.click();
  } else {
    await frame.getByRole('button', { name: '+ New goal' }).click();
    await frame.locator('[name="title"]').fill(title);
    await frame.locator('[name="outcome"]').fill('Verify production-equivalent Anna storage persistence.');
    await frame.locator('[name="category"]').selectOption('Work');
    await frame.locator('[name="context"]').fill('This synthetic goal is used only for the marketplace review regression.');
    await frame.getByRole('button', { name: 'Create goal' }).click();
  }
  if (!await frame.getByText(update, { exact: true }).count()) {
    await frame.locator('#update-form textarea').fill(update);
    await frame.getByRole('button', { name: 'Save update' }).click();
    await frame.getByText('Update saved. Anna will include it when you build the plan.', { exact: true }).waitFor();
  }
  console.log('SEEDED APS persistence record');
} else {
  const goalButton = frame.getByRole('button', { name: new RegExp(title) });
  await goalButton.waitFor({ timeout: 30000 });
  await goalButton.click();
  await frame.getByText(update, { exact: true }).waitFor();
  assert.equal(await frame.getByText(update, { exact: true }).isVisible(), true);
  console.log('PASS APS persistence: goal history survived a new harness and app session');
  await frame.getByRole('button', { name: 'Delete goal' }).click();
  await frame.getByRole('button', { name: 'Delete goal', exact: true }).last().click();
  await frame.getByText('Goal deleted.', { exact: true }).waitFor();
  console.log('CLEANED APS persistence record');
}

await browser.close();
