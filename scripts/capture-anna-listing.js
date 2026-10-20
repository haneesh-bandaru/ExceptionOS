import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.ANNA_HARNESS_URL || 'http://127.0.0.1:5182';
const outputDir = path.resolve('anna/listing-assets');
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(baseUrl, { waitUntil: 'networkidle' });
const frameElement = page.locator('iframe').first();
await frameElement.waitFor({ state: 'attached' });
const frame = page.frames().find(candidate => candidate !== page.mainFrame() && candidate.url().includes('/bundle/'))
  || page.frames().find(candidate => candidate !== page.mainFrame());
if (!frame) throw new Error('Anna App iframe was not found.');

await frameElement.screenshot({ path: path.join(outputDir, '01-home.png') });
await frame.getByRole('button', { name: 'Start with a goal' }).click();
await frame.locator('[name="title"]').fill('秋招');
await frame.locator('[name="outcome"]').fill('拿到2个offer');
await frame.locator('[name="category"]').selectOption('Work');
await frame.locator('[name="context"]').fill('I am preparing for autumn recruiting and need a focused application process.');
await frame.locator('[name="attempted"]').fill('Reviewed several job boards and drafted a general resume.');
await frame.getByRole('button', { name: 'Create goal' }).click();
await frame.locator('#ai-consent').check();
await frame.getByRole('button', { name: 'Build my action plan' }).click();
await frame.getByText('Your action plan is ready.', { exact: true }).waitFor();

await frame.getByText('ACTION PLAN', { exact: true }).scrollIntoViewIfNeeded();
await frameElement.screenshot({ path: path.join(outputDir, '02-action-plan.png') });

await frame.locator('#update-form textarea').fill('市场相关岗位');
await frame.getByRole('button', { name: 'Save update' }).click();
await frame.getByText('Update saved. Rebuild with Anna to refresh the plan.', { exact: true }).waitFor();
await frame.getByText('New context is saved.').waitFor();
await frameElement.screenshot({ path: path.join(outputDir, '03-progress-update.png') });

await browser.close();
