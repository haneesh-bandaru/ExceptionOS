// Accepts fenced JSON or JSON surrounded by stray prose, which models occasionally emit.
export function parseJson(raw) {
  const cleaned = String(raw).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); } catch (error) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) throw error;
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

const isGrounded = item => item && typeof item === 'object' && typeof item.text === 'string';
export const isAnalysis = r => r && typeof r.summary === 'string' && isGrounded(r.blocker) && Array.isArray(r.facts) && Array.isArray(r.recommendations) && Array.isArray(r.questions) && Array.isArray(r.assumptions);
export const isDraft = r => r && typeof r.subject === 'string' && typeof r.body === 'string' && Boolean(r.body.trim()) && Array.isArray(r.missingInformation);
