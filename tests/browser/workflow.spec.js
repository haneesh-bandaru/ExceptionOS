import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { makeServer } from '../../src/server.js';
let server, dir, base;
test.beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exceptionos-browser-'));
  server = makeServer({ dbFile: path.join(dir, 'db.sqlite'), aiOptions: { endpoint: '', key: '' } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});
async function register(page, email) {
  await page.goto(base);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.locator('[name=email]').fill(email);
  await page.locator('[name=password]').fill('browser-secret-123');
  await page.locator('#authsubmit').click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}
async function createCase(page) {
  await page.getByRole('button', { name: '+ Start a new case', exact: true }).click();
  await page.locator('[name=title]').fill('Records request pending');
  await page.locator('[name=description]').fill('I submitted a request two weeks ago and have not received a response.');
  await page.getByRole('button', { name: 'Create case', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Records request pending' })).toBeVisible();
}

test('case lifecycle, persisted action, AI consent, sharing and deletion', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await register(page, 'workflow@example.com');
  await createCase(page);
  await page.locator('#actionform [name=text]').fill('Collect supporting records');
  await page.locator('#actionform button').click();
  await expect(page.locator('[data-actionid]')).toHaveCount(1);
  await page.locator('[data-actionid]').check();
  await expect(page.locator('[data-actionid]')).toBeChecked();
  await page.reload();
  await page.locator('[data-case]').click();
  await expect(page.locator('[data-actionid]')).toBeChecked();
  await page.getByRole('button', { name: 'Generate AI-assisted plan' }).click();
  await expect(page.locator('#toast')).toContainText('Please consent');
  await page.locator('#ai-consent').check();
  await page.getByRole('button', { name: 'Generate AI-assisted plan' }).click();
  await expect(page.locator('#aimode')).toContainText('Offline:');
  await page.locator('#status').selectOption('resolved');
  await expect(page.locator('#contribution')).toBeVisible();
  await page.locator('#contribution [name=outcome]').fill('The records arrived after a written follow-up.');
  await page.locator('#contribution [name=consent]').check();
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await expect(page.locator('#contribution')).toContainText('Not publicly visible yet');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete case', exact: true }).click();
  await expect(page.locator('[data-case]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.locator('#authsubmit')).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile intake fits the viewport and another account has no cases', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page, 'mobile@example.com');
  await expect(page.locator('[data-case]')).toHaveCount(0);
  await createCase(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
