import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Run only against a live APS-backed local harness. Uses one uniquely named
// synthetic goal and deletes only that goal in finally, including on failure.
const baseUrl = process.env.ANNA_HARNESS_URL || 'http://127.0.0.1:5180';
const title = `ExceptionOS live review ${Date.now()}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
let frame;
let created = false;
const idle = () => frame.locator('.sync-indicator').waitFor({ state: 'detached', timeout: 140000 });
const appFrame = () => page.frames().find(candidate => candidate !== page.mainFrame() && candidate.url().includes('/anna-apps/'));

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  frame = appFrame();
  assert.ok(frame, 'Anna App iframe must exist');
  await frame.getByRole('button', { name: '+ New goal' }).click();
  await frame.getByLabel('Short title').fill(title);
  await frame.getByLabel('What outcome do you want?').fill('秋招：拿到2个offer');
  await frame.locator('[name="category"]').selectOption('Work');
  await frame.getByText('Add more detail (optional)').click();
  await frame.getByLabel('What is happening?').fill('这是一条合成测试记录，不是真实求职申请。我在准备秋招，尚未决定职位方向。');
  await frame.getByRole('button', { name: 'Create goal', exact: true }).click();
  await idle();
  await frame.getByRole('heading', { name: title }).waitFor();
  created = true;
  await frame.locator('#ai-consent').check();
  await frame.getByRole('button', { name: 'Build my action plan' }).click();
  await idle();
  if (await frame.locator('.error-notice').count()) throw Error(await frame.locator('.error-notice').innerText());
  await frame.getByRole('button', { name: 'Mark complete' }).waitFor();
  console.log('PASS live initial plan');
  const completedStep = await frame.getByRole('button', { name: 'Mark complete' }).getAttribute('data-step');
  await frame.getByRole('button', { name: 'Mark complete' }).click();
  await idle();
  await frame.getByLabel('Progress update').fill('市场相关岗位，主要是内容营销和品牌营销。希望新的行动计划围绕这些岗位。');
  await frame.getByRole('button', { name: 'Save update' }).click();
  await idle();
  await frame.getByRole('button', { name: 'Rebuild with Anna', exact: true }).click();
  await frame.locator('#replan-consent').check();
  await frame.getByRole('button', { name: 'Generate updated plan' }).click();
  await idle();
  if (await frame.locator('.error-notice').count()) throw Error(await frame.locator('.error-notice').innerText());
  const proposed = await frame.locator('.plan-preview').innerText();
  assert.match(proposed, /营销|市场|marketing/i, 'live rebuild should reflect marketing context');
  console.log('LIVE proposal for synthetic reviewer case:\n' + proposed);
  await frame.getByRole('button', { name: 'Apply updated plan' }).click();
  await idle();
  assert.equal(await frame.locator(`button[data-step="${completedStep}"]`).getAttribute('aria-label'), 'Reopen step');
  await page.reload({ waitUntil: 'networkidle' });
  frame = appFrame();
  await frame.getByRole('button', { name: new RegExp(title) }).click();
  await frame.locator('.timeline').getByText('市场相关岗位，主要是内容营销和品牌营销。希望新的行动计划围绕这些岗位。', { exact: true }).waitFor();
  await frame.getByRole('button', { name: 'Close as resolved' }).click();
  await frame.locator('#resolution-input').fill('Synthetic review completed; no real application was sent.');
  await frame.getByRole('dialog').getByRole('button', { name: 'Close as resolved' }).click();
  await idle();
  await frame.locator('.resolved-card').waitFor();
  console.log('PASS live APS flow: rebuilt plan, completed work, new harness session history, and resolution');
} finally {
  if (created && frame) {
    try {
      await idle();
      const cancel = frame.getByRole('button', { name: 'Keep current plan' });
      if (await cancel.count()) await cancel.click();
      await frame.getByRole('button', { name: 'Delete goal', exact: true }).click();
      await frame.getByRole('dialog').getByRole('button', { name: 'Delete goal', exact: true }).click();
      await idle();
      await frame.getByText('Goal deleted.', { exact: true }).waitFor();
      console.log('CLEANED unique synthetic live-review goal');
    } catch (error) {
      console.error(`Cleanup needs attention for "${title}": ${error.message}`);
    }
  }
  await browser.close();
}
