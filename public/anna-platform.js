import { planningMessages, normalizePlan } from './ai-contract.js';

// Keep runtime injection explicit so contract tests can verify the real adapter.
export function createAnnaPlatform(runtime, apiBase, connectionError = '', aiMode = 'live') {
  return {
    apiBase,
    name: 'Anna OS',
    status: runtime ? `Anna runtime connected · Cases saved to ExceptionOS · ${aiMode === 'disabled' ? 'AI disabled until Anna sign-in' : 'AI through Anna'}` : `Anna disconnected · ${connectionError || 'Open this app inside Anna’s development harness.'}`,
    consentLabel: 'Anna OS and its configured model provider (may use Anna credits)',
    async generatePlan({ caseRecord, sources, baseline, consent }) {
      if (consent !== true) throw Error('Explicit AI processing consent is required');
      if (!runtime) throw Error('Anna is not connected. Open the app in the Anna harness and authorize your developer account.');
      if(aiMode === 'disabled') throw Error('Anna AI is disabled in this local session. Sign in with anna-app login, then restart using npm run anna:dev.');
      const [system, user] = planningMessages(caseRecord, sources);
      const result = await runtime.llm.complete({ systemPrompt: system.content, messages: [{ role: 'user', content: { type: 'text', text: user.content } }], maxTokens: 1800, temperature: 0 }, { timeoutMs: 120000 });
      // Anna uses the MCP sampling envelope: {role, content: {type: "text", text}}.
      const raw = typeof result === 'string' ? result : result?.content?.text ?? result?.text ?? result?.content ?? result?.choices?.[0]?.message?.content;
      return normalizePlan(raw, sources, baseline, 'Anna OS');
    }
  };
}
