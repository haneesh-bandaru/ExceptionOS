import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnnaPlatform } from '../public/anna-platform.js';
const caseRecord = { title: 'Need a response', description: 'Waiting for a response to my request', userId: 'private-user-id' };
const source = { title: 'Policy', url: 'https://example.org/policy', reviewStatus: 'reviewed', type: 'official', userId: 'private-user-id' };
const answer = { summary: 'Gather records', questions: ['When did you apply?'], steps: [{ text: 'Check the policy', basis: 'Reviewed policy', sourceUrl: source.url }, { text: 'Confirm next steps', basis: 'Invented source', sourceUrl: 'https://untrusted.example' }] };

test('Anna adapter requires consent, uses real runtime contract and bounds source claims', async () => {
  let calls = 0, sent;
  const adapter = createAnnaPlatform({ llm: { complete: async args => { calls++; sent = args; return { role: 'assistant', content: { type: 'text', text: JSON.stringify(answer) } }; } } }, 'http://localhost:3001');
  await assert.rejects(() => adapter.generatePlan({ caseRecord, sources: [source], consent: false }), /consent/);
  assert.equal(calls, 0);
  const result = await adapter.generatePlan({ caseRecord, sources: [source], baseline: {}, consent: true });
  assert.equal(calls, 1);
  assert.equal(sent.maxTokens, 1800);
  assert.equal(sent.messages[0].content.type, 'text');
  assert.match(sent.systemPrompt, /UNTRUSTED/);
  assert.equal(result.provider, 'Anna OS');
  assert.equal(result.steps[0].sourceUrl, source.url);
  assert.equal(result.steps[1].sourceUrl, '');
  assert.doesNotMatch(JSON.stringify(sent), /private-user-id/);
});

test('Anna missing runtime, unavailable model and malformed output stay explicit errors', async () => {
  const input = { caseRecord, sources: [], baseline: {}, consent: true };
  await assert.rejects(() => createAnnaPlatform(null, '').generatePlan(input), /not connected/);
  await assert.rejects(() => createAnnaPlatform({ llm: { complete: async () => { throw Error('llm_disabled'); } } }, '').generatePlan(input), /llm_disabled/);
  await assert.rejects(() => createAnnaPlatform({ llm: { complete: async () => ({ text: 'not json' }) } }, '').generatePlan(input));
});

test('offline harness never calls the model or labels templates as Anna inference', async () => {
  const platform = createAnnaPlatform({llm:{complete:async()=>{throw Error('must not call');}}}, '', '', 'disabled');
  assert.match(platform.status, /AI disabled/);
  await assert.rejects(()=>platform.generatePlan({caseRecord,sources:[],baseline:{},consent:true}),/disabled in this local session/);
});
