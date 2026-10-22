import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

// Real application modules; only the Anna SDK boundary is replaced.
// Model fixtures verify UI/data flow, not live model quality or Cloud Agent parity.
let server, base, stored, failSave, failLoad, failModel, saveDelay, lastInput, lastSystemPrompt, modelCalls, malformedOnce;
const replyText = 'Your application is on hold until we receive two campaign examples. Please reply by Friday.';
const replyAnalysis = {
  summary: 'The recruiter is waiting for campaign examples.',
  blocker: { text: 'Two examples are needed to continue.', quote: 'on hold until we receive two campaign examples' },
  facts: [{ kind: 'request', text: 'Provide two examples.', quote: 'two campaign examples' }, { kind: 'deadline', text: 'Friday is mentioned; confirm the actual date.', quote: 'Please reply by Friday.' }, { kind: 'fact', text: 'A claim requiring confirmation', quote: 'An invented quotation' }],
  recommendations: [{ text: 'Choose two relevant examples and explain your contribution.', quote: 'two campaign examples' }],
  questions: ['Which Friday is intended?'], assumptions: ['The team may be assessing practical experience.']
};
const sampleQuotes = ['Before we can move you to the interview stage', 'please send two examples of campaigns you worked on', 'confirm your availability for a 30-minute call next week', 'Please reply by Friday.'];
const sampleAnalysis = {
  summary: 'Daniel needs two campaign examples and your availability before scheduling an interview.',
  blocker: { text: 'The interview stage is waiting on two campaign examples.', quote: sampleQuotes[0] },
  facts: [{ kind: 'request', text: 'Send two examples of campaigns you worked on.', quote: sampleQuotes[1] }, { kind: 'request', text: 'Confirm availability for a 30-minute call next week.', quote: sampleQuotes[2] }, { kind: 'deadline', text: 'Reply by Friday; confirm which Friday is meant.', quote: sampleQuotes[3] }],
  recommendations: [{ text: 'Pick two campaigns where you can describe your role and results.', quote: sampleQuotes[1] }, { text: 'Offer two or three specific time slots for the call.', quote: sampleQuotes[2] }],
  questions: ['Which time zone is the call in?'], assumptions: ['Links to published campaigns are acceptable.']
};
const sampleDraft = { subject: 'Campaign examples and availability', body: 'Hi Daniel,\n\nThank you for the update. Here are two campaigns I worked on:\n\n1. [CAMPAIGN 1 LINK] - [YOUR ROLE AND RESULT]\n2. [CAMPAIGN 2 LINK] - [YOUR ROLE AND RESULT]\n\nI am available for a 30-minute call next week on [DAY AND TIME OPTIONS].\n\nBest regards,\nPriya', missingInformation: ['Campaign links', 'Your role and results', 'Time slots'] };
const nudgeDraft = { title: 'Analyst application at Acme', subject: 'Following up on my analyst application', body: 'Hello,\n\nI applied for the analyst role on October 2 and followed up once. I remain very interested and would appreciate an update on the timeline when convenient.\n\nBest regards,\n[YOUR NAME]', missingInformation: ['Your name'] };
const responseDraft = { subject: 'Marketing application: campaign examples', body: 'Hello,\n\nThank you for the update. Here are two examples: [ADD PORTFOLIO LINK].\n\nBest,\n[YOUR NAME]', missingInformation: ['Portfolio link', 'Your name'] };
const initialPlan = {
  summary: 'Prepare a focused autumn recruiting campaign.', questions: ['What is your target industry or job role?'],
  steps: ['Prepare your CV', 'Choose target roles', 'Shortlist employers', 'Send applications', 'Review responses'].map(title => ({
    title, why: 'Focus the next move on useful evidence.', doneWhen: `${title} is recorded.`, sourceUrl: ''
  }))
};
const updatedPlan = {
  summary: 'Focus applications on marketing roles.',
  changeSummary: 'Your latest update identifies marketing roles. The role question is answered.',
  questions: ['Which locations work for you?'],
  steps: [{ title: 'Shortlist five marketing roles', why: 'Your update narrows the search to marketing.', doneWhen: 'Five relevant roles are recorded.', sourceUrl: '' }]
};
const applicationPlan = {
  summary: 'Find the current status of your marketing application and agree on a clear next contact.',
  questions: ['Has the recruiting team acknowledged your follow-up?'],
  steps: [
    { title: 'Gather the application and follow-up receipts', why: 'Keep the dates and messages together before asking for a status update.', doneWhen: 'The application date and last follow-up are in the progress log.' },
    { title: 'Ask the recruiting team for the current status', why: 'Use the contact from your application acknowledgement to clarify what is pending.', doneWhen: 'A concise status request has been sent and recorded.' },
    { title: 'Record the reply and the next agreed action', why: 'Use the reply to choose the next step without assuming a decision date.', doneWhen: 'The response and any agreed follow-up are in the progress log.' }
  ]
};
const applicationUpdate = {
  summary: 'Provide the requested portfolio, then track confirmation.',
  changeSummary: 'The recruiter confirmed the application is pending a portfolio. Replace the generic status follow-up with the requested evidence.',
  questions: [],
  steps: [
    { title: 'Select two relevant marketing examples', why: 'The recruiter asked for campaign work; choose examples that show your contribution.', doneWhen: 'Two examples and a short explanation of your work are ready.' },
    { title: 'Reply with the portfolio through the existing thread', why: 'Keep the requested evidence attached to the same application conversation.', doneWhen: 'The portfolio has been sent through the verified recruiting thread.' },
    { title: 'Log acknowledgement and the next agreed contact', why: 'Track the response without inventing a hiring timeline.', doneWhen: 'Receipt and any agreed next contact are recorded.' }
  ]
};
const sdk = `export const AnnaAppRuntime = { async connect() {
  const request = async (method, args) => {
    const response = await fetch('/test-api/' + method, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(args)});
    const result = await response.json();
    if (!response.ok) throw Error(result.message);
    return result;
  };
  return { storage:{get: args => request('get', args), set: args => request('set', args)},
    llm:{complete: args => request('model', args)}, window:{ready: async()=>{}, set_title:async()=>{}} };
}};`;

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
    if (req.url.startsWith('/test-api/')) {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const args = JSON.parse(Buffer.concat(chunks).toString());
      if (req.url.endsWith('/get')) return failLoad ? send(503, { message: 'Storage temporarily unavailable' }) : send(200, { value: stored });
      if (req.url.endsWith('/set')) {
        if (saveDelay) await new Promise(resolve => setTimeout(resolve, saveDelay));
        if (failSave) return send(503, { message: 'Test write failed' });
        stored = args.value; return send(200, { ok: true });
      }
      if (req.url.endsWith('/model')) {
        modelCalls++;
        lastInput = JSON.parse(args.messages[0].content.text.split('\n').slice(1).join('\n').split('\n\nYour previous answer')[0]);
        lastSystemPrompt = args.systemPrompt;
        if (failModel) return send(503, { message: 'Model temporarily unavailable' });
        if (malformedOnce) { malformedOnce = false; return send(200, { content: { text: 'Sure! Here is a summary without the JSON you asked for.' } }); }
        if (lastInput.task === 'quick_reply') return send(200, { content: { text: '```json\n' + JSON.stringify({ title: 'Content marketing interview', analysis: lastInput.reply.sourceText.includes('Content Marketing Associate') ? sampleAnalysis : replyAnalysis, draft: sampleDraft }) + '\n```' } });
        if (lastInput.task === 'draft_nudge') return send(200, { content: { text: JSON.stringify(nudgeDraft) } });
        if (lastInput.task === 'analyze_reply') return send(200, { content: { text: JSON.stringify(lastInput.title === 'Get a decision on my application' ? { ...replyAnalysis, facts: replyAnalysis.facts.slice(0, 2) } : replyAnalysis) } });
        if (lastInput.task === 'draft_response') return send(200, { content: { text: JSON.stringify(responseDraft) } });
        const plan = lastInput.title === 'Get a decision on my application'
          ? (lastInput.recentUpdates.some(update => update.note.includes('portfolio')) ? applicationUpdate : applicationPlan)
          : (lastInput.recentUpdates.some(update => update.note.includes('市场')) ? updatedPlan : initialPlan);
        return send(200, { content: { text: JSON.stringify(plan) } });
      }
      return send(404, {});
    }
    if (req.url === '/static/anna-apps/_sdk/latest/index.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(sdk);
    }
    const name = req.url === '/' ? 'index.html' : req.url.slice(1);
    if (!['index.html', 'app.js', 'domain.js', 'platform.js', 'style.css', 'followup.js', 'followup-view.js', 'i18n.js', 'json.js'].includes(name)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html' });
    res.end(await readFile(path.resolve('anna/src', name)));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { await new Promise(resolve => server.close(resolve)); });
test.beforeEach(() => { stored = null; failSave = false; failLoad = false; failModel = false; saveDelay = 0; lastInput = null; lastSystemPrompt = ''; modelCalls = 0; malformedOnce = false; });

async function createGoal(page, title = '秋招') {
  await page.getByRole('button', { name: '+ New goal' }).click();
  await page.getByLabel('Short title').fill(title);
  await page.getByLabel('What outcome do you want?').fill('拿到2个offer');
  await page.getByRole('button', { name: 'Create goal', exact: true }).click();
  await expect(page.locator('.sync-indicator')).toHaveCount(0);
}
async function build(page) {
  await page.locator('#ai-consent').check();
  await page.getByRole('button', { name: 'Build my action plan' }).click();
}
async function rebuild(page) {
  await page.getByRole('button', { name: 'Rebuild with Anna', exact: true }).click();
  await page.locator('#replan-consent').check();
  await page.getByRole('button', { name: 'Generate updated plan' }).click();
}

async function openReplies(page) {
  await page.getByRole('button', { name: /^Replies & follow-ups/ }).click();
}
async function pasteReply(page, body = replyText) {
  const panel = page.locator('.paste-reply');
  if (!await panel.evaluate(node => node.open)) await panel.locator('summary').click();
  await page.getByLabel('Who sent it?').fill('Recruiting team');
  await page.getByLabel('Reply text', { exact: true }).fill(body);
  await page.getByRole('button', { name: 'Save reply', exact: true }).click();
  await expect(page.locator('.sync-indicator')).toHaveCount(0);
}

test('reply evidence, editable response, retry, copy, waiting and persistence work end to end', async ({ page, context, browser }) => {
  await page.goto(base); await createGoal(page, 'Marketing follow-up'); await openReplies(page);
  await pasteReply(page);
  expect(modelCalls).toBe(0);
  await page.getByRole('button', { name: 'Analyze reply with Anna' }).click();
  await expect(page.locator('#toast')).toContainText('Confirm Anna processing');
  expect(modelCalls).toBe(0);
  failModel = true; await page.locator('#analysis-consent').check();
  await page.getByRole('button', { name: 'Analyze reply with Anna' }).click();
  await expect(page.locator('.error-notice')).toContainText('Anna could not finish');
  expect(stored.goals[0].replies[0].sourceText).toBe(replyText);
  failModel = false; await page.locator('#analysis-consent').check();
  await page.getByRole('button', { name: 'Analyze reply with Anna' }).click();
  await expect(page.locator('.sync-indicator')).toHaveCount(0);
  await expect(page.locator('.reply-analysis')).toContainText('Two examples are needed');
  await expect(page.locator('.reply-analysis')).toContainText('Needs confirmation');
  await expect(page.locator('.reply-analysis')).not.toContainText('An invented quotation');
  await page.getByRole('button', { name: 'Read original reply' }).first().click();
  await expect(page.locator('.original-source blockquote')).toHaveText(replyText);
  await expect(page.getByLabel('Next check-in', { exact: true })).toHaveValue('');
  const request = page.locator('#draft-request-form');
  await request.getByLabel('Details to include').fill('Keep the response concise.');
  await request.getByRole('button', { name: 'Prepare response', exact: true }).click();
  await expect(page.locator('#toast')).toContainText('Confirm Anna processing');
  await request.locator('[name=consent]').check(); failModel = true;
  await request.getByRole('button', { name: 'Prepare response', exact: true }).click();
  await expect(page.locator('.error-notice')).toBeVisible();
  await expect(request.getByLabel('Details to include')).toHaveValue('Keep the response concise.');
  failModel = false; await request.locator('[name=consent]').check();
  await request.getByRole('button', { name: 'Prepare response', exact: true }).click();
  await expect(page.locator('#response-form')).toBeVisible();
  expect(lastInput.task).toBe('draft_response');
  expect(lastInput.extraContext).toBe('Keep the response concise.');
  expect(lastInput.reply.sourceText).toBe(replyText);
  const response = page.locator('#response-form');
  await response.locator('[name=sentConfirmed]').check();
  await response.getByRole('button', { name: 'Record as sent' }).click();
  await expect(page.locator('#toast')).toContainText('placeholders');
  expect(stored.goals[0].followUp.stage).toBe('needs_action');
  const finalBody = 'Hello,\n\nHere are my two campaign examples: https://example.com/portfolio\n\nBest,\nTest Applicant';
  await response.getByLabel('Response', { exact: true }).fill(finalBody);
  failSave = true;
  await response.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.locator('#toast')).toContainText('Could not save');
  await expect(response.getByLabel('Response', { exact: true })).toHaveValue(finalBody);
  expect(stored.goals[0].replies[0].draft.body).toContain('[ADD PORTFOLIO LINK]');
  failSave = false;
  await response.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.locator('.sync-indicator')).toHaveCount(0);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await response.getByRole('button', { name: 'Copy response' }).click();
  await expect(page.locator('#toast')).toContainText('Response copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(finalBody);
  expect(stored.goals[0].replies[0].sentResponses).toHaveLength(0);
  await response.getByLabel('Check in after sending').fill('2099-12-31');
  await response.locator('[name=sentConfirmed]').check();
  failSave = true;
  await response.getByRole('button', { name: 'Record as sent' }).click();
  await expect(page.locator('#toast')).toContainText('Could not save');
  expect(stored.goals[0].followUp.stage).toBe('needs_action');
  await expect(response.getByLabel('Response', { exact: true })).toHaveValue(finalBody);
  failSave = false; await response.locator('[name=sentConfirmed]').check();
  await response.getByRole('button', { name: 'Record as sent' }).click();
  await expect(page.locator('.sync-indicator')).toHaveCount(0);
  await expect(page.locator('.followup-summary')).toContainText('Waiting for a reply');
  expect(stored.goals[0].replies[0].draft).toBeNull();
  expect(stored.goals[0].replies[0].sentResponses[0].body).toBe(finalBody);
  await page.locator('.brand').click();
  await expect(page.getByRole('region', { name: 'Attention today' })).toContainText('Nothing needs action today');
  const cleanContext = await browser.newContext(); const reopened = await cleanContext.newPage();
  await reopened.goto(base); await reopened.getByRole('button', { name: 'Continue last goal' }).click(); await openReplies(reopened);
  await expect(reopened.locator('.followup-summary')).toContainText('Waiting for a reply');
  await reopened.locator('.sent-history summary').click();
  await expect(reopened.locator('.sent-history')).toContainText(finalBody);
  await reopened.getByLabel('Next check-in', { exact: true }).fill('2000-01-01');
  await reopened.getByRole('button', { name: 'Save follow-up' }).click(); await expect(reopened.locator('.sync-indicator')).toHaveCount(0);
  await reopened.locator('.brand').click();
  await expect(reopened.getByRole('region', { name: 'Attention today' })).toContainText('Follow-up due');
  await reopened.locator('.attention-row').click();
  await pasteReply(reopened, 'Thank you. Please confirm your availability for an interview.');
  await expect(reopened.locator('.followup-summary')).toContainText('Needs your action');
  expect(stored.goals[0].replies).toHaveLength(2);
  expect(stored.goals[0].replies[1].sentResponses[0].body).toBe(finalBody);
  await cleanContext.close();
});

test('mobile reply workflow fits, keeps drafts between tabs, and resolves without a plan', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base); await createGoal(page, 'Application reply'); await openReplies(page);
  failSave = true;
  await pasteReply(page);
  await expect(page.locator('#toast')).toContainText('Could not save');
  await expect(page.getByLabel('Reply text', { exact: true })).toHaveValue(replyText);
  failSave = false; await page.getByRole('button', { name: 'Save reply', exact: true }).click();
  await expect(page.locator('.sync-indicator')).toHaveCount(0);
  await page.locator('#analysis-consent').check();
  await page.getByRole('button', { name: 'Analyze reply with Anna' }).click();
  await expect(page.locator('.sync-indicator')).toHaveCount(0);
  await page.locator('#draft-request-form [name=consent]').check();
  await page.getByRole('button', { name: 'Prepare response', exact: true }).click();
  await expect(page.locator('#response-form')).toBeVisible();
  await page.locator('#response-form [name=body]').fill('My unsaved response remains here.');
  await page.getByRole('button', { name: 'Plan & progress', exact: true }).click();
  await openReplies(page);
  await expect(page.locator('#response-form [name=body]')).toHaveValue('My unsaved response remains here.');
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw Error('Clipboard unavailable in this host'); }; });
  await page.getByRole('button', { name: 'Copy response' }).click();
  await expect(page.locator('#toast')).toContainText('selected');
  expect(await page.locator('#response-form [name=body]').evaluate(node => node.selectionEnd - node.selectionStart)).toBe('My unsaved response remains here.'.length);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 8000 });
  await page.screenshot({ path: 'docs/review-preview/reply-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: 'docs/review-preview/reply-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Close as resolved', exact: true }).click();
  await page.locator('#resolution-input').fill('The application received a decision.');
  await page.getByRole('dialog').getByRole('button', { name: 'Close as resolved' }).click();
  await expect(page.locator('.resolved-card')).toContainText('received a decision');
  await expect(page.locator('#response-form')).toHaveCount(0);
  await page.locator('.brand').click();
  await expect(page.getByRole('region', { name: 'Attention today' })).toHaveCount(0);
});

test('failed model and save calls recover; rebuild is reviewed, preserves work and survives a fresh browser', async ({ page, browser }) => {
  await page.goto(base);
  await createGoal(page);
  failModel = true;
  await build(page);
  await expect(page.getByText('Anna could not finish the plan.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Build my action plan' })).toBeEnabled();
  failModel = false; await build(page);
  await expect(page.getByText('0 of 5 completed')).toBeVisible();
  saveDelay = 700;
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await expect(page.locator('.sync-indicator')).toHaveText('Saving progress…');
  await expect(page.getByText('20%', { exact: true })).toBeVisible();
  await expect(page.locator('.sync-indicator')).toHaveCount(0);
  saveDelay = 0;
  failSave = true;
  await page.locator('#update-form textarea').fill('市场相关岗位');
  await page.getByRole('button', { name: 'Save update' }).click();
  await expect(page.locator('#toast')).toContainText('Could not save');
  await expect(page.locator('#update-form textarea')).toHaveValue('市场相关岗位');
  expect(stored.goals[0].updates.some(update => update.body === '市场相关岗位')).toBe(false);
  failSave = false;
  await page.getByRole('button', { name: 'Save update' }).click();
  await expect(page.locator('.sync-indicator')).toHaveCount(0);
  failModel = true; await rebuild(page);
  await expect(page.getByText('Anna could not finish the plan.')).toBeVisible();
  await expect(page.getByText('1 of 5 completed')).toBeVisible();
  expect(stored.goals[0].steps.length).toBe(5);
  failModel = false; await rebuild(page);
  await expect(page.getByRole('region', { name: 'Review updated plan' })).toBeVisible();
  expect(lastInput.recentUpdates[0].note).toBe('市场相关岗位');
  expect(lastInput.currentPlan[0].completed).toBe(true);
  expect(stored.goals[0].steps.length).toBe(5);
  await page.getByRole('button', { name: 'Keep current plan' }).click();
  await expect(page.getByText('1 of 5 completed')).toBeVisible();
  await rebuild(page);
  failSave = true;
  await page.getByRole('button', { name: 'Apply updated plan' }).click();
  await expect(page.locator('#toast')).toContainText('Could not save');
  expect(stored.goals[0].steps.length).toBe(5);
  await expect(page.getByRole('button', { name: 'Apply updated plan' })).toBeEnabled();
  failSave = false; await page.getByRole('button', { name: 'Apply updated plan' }).click();
  await expect(page.getByText('1 of 2 completed')).toBeVisible();
  await expect(page.locator('.questions')).not.toContainText('What is your target industry');
  await expect(page.locator('.next-card')).toContainText('marketing');
  expect(stored.goals[0].planHistory).toHaveLength(1);
  const context = await browser.newContext();
  const reopened = await context.newPage();
  await reopened.goto(base);
  await reopened.getByRole('button', { name: 'Continue last goal' }).click();
  await expect(reopened.getByText('1 of 2 completed')).toBeVisible();
  await expect(reopened.locator('.timeline')).toContainText('市场相关岗位');
  await reopened.getByRole('button', { name: 'Close as resolved' }).click();
  await reopened.locator('#resolution-input').fill('Received two offers.');
  failSave = true;
  await reopened.getByRole('dialog').getByRole('button', { name: 'Close as resolved' }).click();
  await expect(reopened.locator('#toast')).toContainText('Could not save');
  await expect(reopened.locator('#resolution-input')).toHaveValue('Received two offers.');
  expect(stored.goals[0].status).toBe('active');
  failSave = false;
  await reopened.getByRole('dialog').getByRole('button', { name: 'Close as resolved' }).click();
  await expect(reopened.locator('.resolved-card')).toContainText('Received two offers.');
  await expect(reopened.getByRole('dialog')).toHaveCount(0);
  await context.close();
});

test('failed storage load cannot overwrite history or revive a stale local cache', async ({ page }) => {
  await page.goto(base); await createGoal(page, 'Existing application');
  failLoad = true; await page.reload();
  await expect(page.getByRole('heading', { name: 'Your workspace could not be loaded' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ New goal' })).toHaveCount(0);
  failLoad = false; await page.getByRole('button', { name: 'Retry connection' }).click();
  await expect(page.getByRole('button', { name: 'Existing application Needs your action' })).toBeVisible();
  await page.evaluate(value => localStorage.setItem('exceptionos.workspace.v1', JSON.stringify(value)), stored);
  stored = null; await page.reload();
  await expect(page.getByRole('button', { name: 'Continue last goal' })).toHaveCount(0);
});

test('mobile users can switch between goals and review updates without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await createGoal(page, 'First application');
  await createGoal(page, 'Second application');
  const firstId = stored.goals.find(goal => goal.title === 'First application').id;
  await page.getByLabel('Switch goal').selectOption(firstId);
  await expect(page.getByRole('heading', { name: 'First application' })).toBeVisible();
  await build(page);
  await expect(page.getByText('0 of 5 completed')).toBeVisible();
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await expect(page.locator('.sync-indicator')).toHaveCount(0);
  await page.locator('#update-form textarea').fill('市场相关岗位');
  await page.getByRole('button', { name: 'Save update' }).click();
  await expect(page.locator('.sync-indicator')).toHaveCount(0);
  await rebuild(page);
  await expect(page.getByRole('button', { name: 'Apply updated plan' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Apply updated plan' }).click();
  await expect(page.locator('.sync-indicator')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await mkdir('docs/review-preview', { recursive: true });
  await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 8000 });
  await page.screenshot({ path: 'docs/review-preview/mobile.png', fullPage: true });
});


const quickConsent = page => page.locator('#quick-form [name=consent]');

test('quick start reads a pasted message and lands on an editable draft in one Anna call, retrying malformed output', async ({ page }) => {
  await page.goto(base);
  await page.getByRole('button', { name: 'Read it and draft my reply' }).click();
  expect(stored).toBeNull();
  await page.getByRole('button', { name: 'Try it with a sample message' }).click();
  await expect(page.getByLabel('Paste the message')).toHaveValue(/Content Marketing Associate/);
  await page.getByRole('button', { name: 'Read it and draft my reply' }).click();
  await expect(page.locator('#toast')).toContainText('Confirm Anna processing');
  expect(modelCalls).toBe(0); expect(stored).toBeNull();
  await page.getByLabel('What do you want to happen?').fill('Get an interview date');
  await quickConsent(page).check();
  malformedOnce = true;
  await page.getByRole('button', { name: 'Read it and draft my reply' }).click();
  await expect(page.locator('#response-form')).toBeVisible();
  await expect(page.locator('.sync-indicator')).toHaveCount(0);
  expect(modelCalls).toBe(2);
  expect(lastInput.task).toBe('quick_reply');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Content marketing interview');
  await expect(page.locator('.reply-analysis')).toContainText('waiting on two campaign examples');
  await expect(page.locator('.reply-analysis .inference-label')).toHaveCount(0);
  await expect(page.locator('#placeholder-hint')).toContainText('[CAMPAIGN 1 LINK]');
  const goal = stored.goals[0];
  expect(goal.outcome).toBe('Get an interview date');
  expect(goal.replies[0].analysis.blocker.supported).toBe(true);
  expect(goal.replies[0].draft.subject).toBe('Campaign examples and availability');
  await page.locator('.brand').click();
  await expect(page.getByRole('region', { name: 'Attention today' })).toContainText('Content marketing interview');
  await page.getByRole('button', { name: 'Continue last goal' }).click();
  await expect(page.locator('#response-form')).toBeVisible();
});

test('quick start keeps the saved message when Anna fails, and mobile shows the draft before the analysis', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.getByLabel('Paste the message').fill(replyText);
  await quickConsent(page).check();
  failModel = true;
  await page.getByRole('button', { name: 'Read it and draft my reply' }).click();
  await expect(page.locator('.error-notice')).toContainText('Anna could not finish');
  expect(stored.goals[0].replies[0].sourceText).toBe(replyText);
  failModel = false;
  await page.locator('#analysis-consent').check();
  await page.getByRole('button', { name: 'Analyze reply with Anna' }).click();
  await expect(page.locator('.sync-indicator')).toHaveCount(0);
  await page.locator('#draft-request-form [name=consent]').check();
  await page.getByRole('button', { name: 'Prepare response', exact: true }).click();
  await expect(page.locator('#response-form')).toBeVisible();
  const draftTop = (await page.locator('.response-panel').boundingBox()).y;
  const analysisTop = (await page.locator('.analysis-panel').boundingBox()).y;
  expect(draftTop).toBeLessThan(analysisTop);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('no-reply route drafts a follow-up, records it as sent, and schedules a check-in', async ({ page, browser }) => {
  await page.goto(base);
  await page.getByRole('button', { name: 'I haven’t heard back' }).click();
  await page.getByLabel('Who are you waiting on?').fill('Acme recruiting');
  await page.getByLabel('What did you last send them?').fill('Applied for the analyst role on October 2 and followed up once on October 9.');
  await page.getByLabel('When did you send it?').fill('2026-10-09');
  await quickConsent(page).check();
  failModel = true;
  await page.getByRole('button', { name: 'Draft my follow-up' }).click();
  await expect(page.locator('#nudge-panel .error-notice')).toBeVisible();
  expect(stored.goals[0].outreach.lastContact).toContain('analyst role');
  expect(stored.goals[0].replies).toHaveLength(0);
  failModel = false;
  const request = page.locator('#nudge-request-form');
  await expect(request.getByLabel('What did you last send them?')).toHaveValue(/analyst role/);
  await request.getByLabel('Details to include').fill('Mention I am still available next week.');
  await request.locator('[name=consent]').check();
  await request.getByRole('button', { name: 'Draft a follow-up' }).click();
  await expect(page.locator('#nudge-form')).toBeVisible();
  expect(lastInput.task).toBe('draft_nudge');
  expect(lastInput.lastContact).toEqual({ text: 'Applied for the analyst role on October 2 and followed up once on October 9.', on: '2026-10-09' });
  expect(lastInput.extraContext).toBe('Mention I am still available next week.');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Acme recruiting');
  const nudge = page.locator('#nudge-form');
  await nudge.locator('[name=sentConfirmed]').check();
  await nudge.getByRole('button', { name: 'Record as sent' }).click();
  await expect(page.locator('#toast')).toContainText('placeholders');
  const body = 'Hello,\n\nI applied for the analyst role on October 2. Could you share an update on the timeline?\n\nBest regards,\nSam Rivera';
  await nudge.getByLabel('Follow-up message').fill(body);
  await nudge.getByLabel('Check in after sending').fill('2099-12-31');
  await nudge.locator('[name=sentConfirmed]').check();
  await nudge.getByRole('button', { name: 'Record as sent' }).click();
  await expect(page.locator('.sync-indicator')).toHaveCount(0);
  await expect(page.locator('.followup-summary')).toContainText('Waiting for a reply');
  expect(stored.goals[0].outreach.sent[0].body).toBe(body);
  expect(stored.goals[0].followUp.checkInDate).toBe('2099-12-31');
  const fresh = await browser.newContext(); const reopened = await fresh.newPage();
  await reopened.goto(base); await reopened.getByRole('button', { name: 'Continue last goal' }).click();
  await expect(reopened.locator('#nudge-panel')).toHaveAttribute('open', '');
  await reopened.locator('#nudge-panel .sent-history summary').click();
  await expect(reopened.locator('#nudge-panel .sent-history')).toContainText('Sam Rivera');
  await fresh.close();
});

test('proposed plans survive navigation, dialogs keep focus, and resolved checklists are locked', async ({ page }) => {
  await page.goto(base);
  await createGoal(page, 'First application');
  await build(page);
  await page.locator('#update-form textarea').fill('市场相关岗位');
  await page.getByRole('button', { name: 'Save update' }).click();
  await expect(page.locator('.sync-indicator')).toHaveCount(0);
  await rebuild(page);
  await expect(page.getByRole('region', { name: 'Review updated plan' })).toBeVisible();
  const calls = modelCalls;
  await page.getByRole('button', { name: /^First application/ }).click();
  await expect(page.getByRole('region', { name: 'Review updated plan' })).toBeVisible();
  await page.getByRole('button', { name: '+ New goal' }).click();
  await page.locator('.brand').click();
  await expect(page.getByRole('button', { name: /Plan update to review/ })).toBeVisible();
  await page.getByRole('button', { name: 'Continue last goal' }).click();
  await expect(page.getByRole('region', { name: 'Review updated plan' })).toBeVisible();
  expect(modelCalls).toBe(calls);
  await page.getByRole('button', { name: 'Keep current plan' }).click();

  const opener = page.locator('aside .resolve-button');
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(page.locator('#resolution-input')).toBeFocused();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement.closest('.modal-card')))).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement.closest('.modal-card')))).toBe(true);
  expect(await page.locator('.shell').getAttribute('inert')).not.toBeNull();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();

  await page.getByRole('button', { name: 'Delete goal' }).click();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Delete goal' })).toBeFocused();

  await opener.click();
  await page.locator('#resolution-input').fill('Received an offer.');
  await dialog.getByRole('button', { name: 'Close as resolved' }).click();
  await expect(page.locator('.resolved-card')).toBeVisible();
  const before = stored.goals[0].steps.map(step => step.completed);
  await expect(page.locator('.check').first()).toBeDisabled();
  await page.locator('.check').first().click({ force: true });
  expect(stored.goals[0].steps.map(step => step.completed)).toEqual(before);
  await page.getByRole('button', { name: 'Reopen' }).click();
  await expect(page.locator('.check').first()).toBeEnabled();
});

test('the interface switches to Chinese and asks Anna to answer in Chinese when the message language is unclear', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.getByRole('button', { name: '切换到中文' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('读懂对方要什么');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await page.getByRole('button', { name: '用示例消息试一试' }).click();
  await expect(page.getByLabel('粘贴消息')).toHaveValue(/内容营销专员/);
  await quickConsent(page).check();
  await page.getByRole('button', { name: '读懂消息并起草回复' }).click();
  await expect(page.locator('#response-form')).toBeVisible();
  expect(lastSystemPrompt).toContain('Simplified Chinese');
  await expect(page.getByRole('button', { name: '复制回复' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 8000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'docs/review-preview/zh-mobile-reply.png', fullPage: true });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Switch to English' })).toBeVisible();
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Know what they want');
});

test('capture current listing screens from synthetic workflows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const settle = async () => { await expect(page.locator('.sync-indicator')).toHaveCount(0); await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 8000 }); await page.evaluate(() => window.scrollTo(0, 0)); };
  await page.goto(base);
  await page.getByRole('button', { name: 'Try it with a sample message' }).click();
  await page.getByLabel('What do you want to happen?').fill('Get an interview date');
  await quickConsent(page).check();
  await settle();
  await page.screenshot({ path: 'anna/listing-assets/01-home.png' });
  await page.getByRole('button', { name: 'Read it and draft my reply' }).click();
  await expect(page.locator('#response-form')).toBeVisible(); await settle();
  await page.screenshot({ path: 'anna/listing-assets/02-reply-draft.png' });

  await page.locator('.brand').click();
  await page.getByRole('button', { name: 'I haven’t heard back' }).click();
  await page.getByLabel('Who are you waiting on?').fill('Acme recruiting');
  await page.getByLabel('What did you last send them?').fill('Applied for the analyst role on October 2 and followed up once on October 9.');
  await page.getByLabel('When did you send it?').fill('2026-10-09');
  await quickConsent(page).check();
  await page.getByRole('button', { name: 'Draft my follow-up' }).click();
  await expect(page.locator('#nudge-form')).toBeVisible(); await settle();
  await page.locator('#nudge-panel').evaluate(node => window.scrollTo(0, node.getBoundingClientRect().top + window.scrollY - 24));
  await page.screenshot({ path: 'anna/listing-assets/03-follow-up.png' });

  await page.getByRole('button', { name: '+ New goal' }).click();
  await page.getByLabel('Short title').fill('Get a decision on my application');
  await page.getByLabel('What outcome do you want?').fill('Understand what is holding up my marketing application and get a clear next step.');
  await page.getByLabel('Area', { exact: true }).selectOption('Work');
  await page.getByText('Add more detail (optional)').click();
  await page.getByLabel('What is happening?').fill('I applied for a marketing role last week and received an automated acknowledgement. I have no decision yet.');
  await page.getByLabel('What have you tried?').fill('I sent one follow-up in the existing recruiting thread.');
  await page.getByRole('button', { name: 'Create goal', exact: true }).click();
  await expect(page.locator('.sync-indicator')).toHaveCount(0);
  await build(page); await expect(page.getByText('0 of 3 completed')).toBeVisible(); await settle();
  await page.screenshot({ path: 'anna/listing-assets/04-action-plan.png' });
});
