import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Requires the live APS-backed harness. Never sends an email; it creates and
// removes only its uniquely named synthetic goal, including after failures.
const title = `ExceptionOS reply QA ${Date.now()}`;
const source = 'Your application is on hold until we receive two campaign examples. Please reply by Friday.';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
let frame, created = false;
const idle = () => frame.locator('.sync-indicator').waitFor({ state: 'detached', timeout: 140000 });
const appFrame = () => page.frames().find(item => item !== page.mainFrame() && item.url().includes('/anna-apps/'));

try {
  await page.goto(process.env.ANNA_HARNESS_URL || 'http://127.0.0.1:5180', { waitUntil: 'networkidle' });
  frame = appFrame(); assert.ok(frame);
  await frame.getByRole('button', { name: '+ New goal' }).click();
  await frame.getByLabel('Short title').fill(title);
  await frame.getByLabel('What outcome do you want?').fill('Understand what is blocking a marketing application and prepare a useful response.');
  await frame.getByText('Add more detail (optional)').click();
  await frame.getByLabel('What is happening?').fill('Synthetic QA scenario only. No real person or organization is involved.');
  await frame.getByRole('button', { name: 'Create goal', exact: true }).click(); await idle();
  await frame.getByRole('heading', { name: title }).waitFor(); created = true;
  await frame.getByRole('button', { name: /^Replies & follow-ups/ }).click();
  await frame.getByLabel('Who sent it?').fill('Example recruiting team');
  await frame.getByLabel('Reply text', { exact: true }).fill(source);
  await frame.getByRole('button', { name: 'Save reply', exact: true }).click(); await idle();
  await frame.locator('#analysis-consent').check();
  await frame.getByRole('button', { name: 'Analyze reply with Anna' }).click(); await idle();
  if (await frame.locator('.error-notice').count()) throw Error(await frame.locator('.error-notice').innerText());
  const quotes = await frame.locator('.source-evidence blockquote').allTextContents();
  assert.ok(quotes.length, 'live analysis should cite the original reply');
  for (const quote of quotes) assert.ok(source.includes(quote), 'every displayed quote must match its source');
  assert.match(await frame.locator('.blocker-card').innerText(), /examples|campaign/i);
  assert.equal(await frame.getByLabel('Next check-in', { exact: true }).inputValue(), '', 'relative deadline must not be auto-scheduled');
  console.log(`PASS live reply analysis: ${quotes.length} matching quotes, campaign-example blocker, no automatic deadline`);
  await frame.locator('#draft-request-form [name=extraContext]').fill('Use a polite, concise tone. Leave placeholders for my name and the missing portfolio links.');
  await frame.locator('#draft-request-form [name=consent]').check();
  await frame.getByRole('button', { name: 'Prepare response', exact: true }).click(); await idle();
  if (await frame.locator('.error-notice').count()) throw Error(await frame.locator('.error-notice').innerText());
  const response = frame.locator('#response-form');
  const draft = await response.locator('[name=body]').inputValue();
  assert.ok(draft.length > 40, 'live drafting returns usable text');
  assert.match(draft, /\[[^\]]+\]/, 'missing information should be a visible placeholder');
  console.log('PASS live response draft with visible placeholders');
  await response.locator('[name=body]').fill('Synthetic QA response record. No external message was sent.');
  await response.locator('[name=checkInDate]').fill('2099-12-31');
  await response.locator('[name=sentConfirmed]').check();
  await response.getByRole('button', { name: 'Record as sent' }).click(); await idle();
  assert.match(await frame.locator('.followup-summary').innerText(), /Waiting for a reply/);
  await page.reload({ waitUntil: 'networkidle' }); frame = appFrame();
  await frame.getByRole('button', { name: new RegExp(title) }).click();
  await frame.getByRole('button', { name: /^Replies & follow-ups/ }).click();
  await frame.locator('.sent-history summary').click();
  assert.match(await frame.locator('.sent-history').innerText(), /No external message was sent/);
  assert.equal(await frame.getByLabel('Next check-in', { exact: true }).inputValue(), '2099-12-31');
  console.log('PASS live APS restore: recorded response, waiting status and chosen check-in');
} finally {
  if (created && frame) {
    try {
      await idle();
      await frame.getByRole('button', { name: 'Delete goal', exact: true }).click();
      await frame.getByRole('dialog').getByRole('button', { name: 'Delete goal', exact: true }).click(); await idle();
      await frame.getByText('Goal deleted.', { exact: true }).waitFor();
      console.log('CLEANED synthetic reply QA goal');
    } catch (error) { console.error(`Cleanup required for ${title}: ${error.message}`); }
  }
  await browser.close();
}
