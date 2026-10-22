import { attentionGoals, followUpStatus, localDay, missingPlaceholders } from './followup.js';
import { locale, t } from './i18n.js';

const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const dayLabel = value => value ? new Intl.DateTimeFormat(locale(), { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : t('No date chosen');
const chosenReply = (goal, selected) => goal.replies.find(reply => reply.id === selected) || goal.replies[0];
const statusChip = goal => `<span class="status-chip ${followUpStatus(goal) === 'Follow-up due' ? 'due' : ''}">${esc(t(followUpStatus(goal)))}</span>`;

export function renderAttention(goals) {
  if (!goals.some(goal => goal.status !== 'resolved')) return '';
  const attention = attentionGoals(goals);
  const waiting = goals.filter(goal => goal.status !== 'resolved' && !attention.includes(goal));
  const row = goal => `<button class="attention-row" data-goal="${esc(goal.id)}" data-tab="replies"><span><strong>${esc(goal.title)}</strong><small>${goal.followUp.checkInDate ? esc(t('Check in {date}', { date: dayLabel(goal.followUp.checkInDate) })) : esc(t('Choose your next move'))}</small></span>${statusChip(goal)}</button>`;
  return `<section class="attention-section" aria-label="${esc(t('Attention today'))}"><div class="section-heading"><div><span class="eyebrow">${t('YOUR FOLLOW-UPS')}</span><h2>${t('Attention today')}</h2></div><span>${esc(t('{count} to review', { count: attention.length }))}</span></div>${attention.length ? attention.map(row).join('') : `<p class="muted">${t('Nothing needs action today. Your waiting goals are below.')}</p>`}${waiting.length ? `<details class="waiting-list"><summary>${esc(t('Waiting or scheduled ({count})', { count: waiting.length }))}</summary>${waiting.map(row).join('')}</details>` : ''}<p class="muted">${t('Check-ins appear here when you open the app. Dates use your local calendar.')}</p></section>`;
}

export function renderFollowupSummary(goal) {
  return `<div class="followup-summary">${statusChip(goal)}${goal.followUp.checkInDate && goal.status !== 'resolved' ? `<span>${esc(t('Check in {date}', { date: dayLabel(goal.followUp.checkInDate) }))}</span>` : ''}<button class="text-button" data-action="open-replies">${goal.status === 'resolved' ? t('View reply history') : t('Paste a reply or prepare a response →')}</button></div>`;
}

function sourceEvidence(item, reply) {
  return item.supported
    ? `<div class="source-evidence"><span>${t('From the pasted reply')}</span><blockquote>${esc(item.quote)}</blockquote><button class="text-button" data-source="${esc(reply.id)}">${t('Read original reply')}</button></div>`
    : `<p class="inference-label">${t('Needs confirmation · No matching source quote')}</p>`;
}

function renderAnalysis(reply) {
  const analysis = reply.analysis;
  if (!analysis) return `<p class="muted">${t('Ask Anna to identify the request, possible blocker, stated dates, and useful next actions.')}</p>`;
  const kind = fact => fact.kind === 'deadline' ? t('Date as stated · confirm its meaning') : fact.kind === 'request' ? t('Requested from you') : t('Stated information');
  return `<div class="reply-analysis"><h3>${t('Anna’s interpretation')}</h3><p>${esc(analysis.summary)}</p><section class="blocker-card"><span class="eyebrow">${t('WHAT MAY BE BLOCKING THIS')}</span><p><strong>${esc(analysis.blocker.text)}</strong></p>${sourceEvidence(analysis.blocker, reply)}</section>
    ${analysis.facts.length ? `<h3>${t('Requests and stated facts')}</h3>${analysis.facts.map(fact => `<article class="finding"><span class="finding-kind">${kind(fact)}</span><p>${esc(fact.text)}</p>${sourceEvidence(fact, reply)}</article>`).join('')}` : `<p class="muted">${t('No specific requests or dates extracted.')}</p>`}
    ${analysis.recommendations.length ? `<h3>${t('Suggested next actions')}</h3><ol class="recommendations">${analysis.recommendations.map(item => `<li><p>${esc(item.text)}</p>${sourceEvidence(item, reply)}</li>`).join('')}</ol>` : ''}
    ${analysis.questions.length ? `<h3>${t('Still unclear')}</h3><ul>${analysis.questions.map(question => `<li>${esc(question)}</li>`).join('')}</ul>` : ''}
    ${analysis.assumptions.length ? `<div class="assumptions"><strong>${t('Assumptions to check')}</strong><ul>${analysis.assumptions.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}
    <p class="muted">${t('Quotes match text you pasted. Review Anna’s interpretation against the original message.')}</p></div>`;
}

const placeholderHint = draft => {
  const missing = missingPlaceholders(draft);
  return missing.length ? t('Replace these placeholders: {list}', { list: missing.join(', ') }) : t('Review the facts, links, and tone before sending.');
};

const errorNotice = (error, kept) => `<section class="error-notice" role="alert"><strong>${t('Anna could not finish this request.')}</strong><p>${esc(t(error))}</p><p>${kept}</p></section>`;

function sentHistory(items, label) {
  return items.length ? `<details class="sent-history"><summary>${esc(t(label, { count: items.length }))}</summary>${items.map(item => `<article><h4>${esc(item.subject || t('Response'))}</h4><pre class="response-text">${esc(item.body)}</pre><small>${esc(t('Recorded {date}', { date: item.sentAt?.slice(0, 10) || '' }))}</small></article>`).join('')}</details>` : '';
}

function recordSent(goal) {
  return `<div class="record-sent"><label>${t('Check in after sending (optional)')}<input type="date" name="checkInDate" value="${esc(goal.followUp.checkInDate)}"></label><label class="consent"><input type="checkbox" name="sentConfirmed"><span>${t('I sent this response outside ExceptionOS.')}</span></label><button class="primary wide" type="submit" data-intent="sent">${t('Record as sent')}</button></div>`;
}

function renderNudge(goal, error) {
  const resolved = goal.status === 'resolved';
  const outreach = goal.outreach;
  const draft = outreach.draft;
  if (resolved && !draft && !outreach.sent.length) return '';
  const open = (!goal.replies.length && outreach.lastContact) || draft || error;
  return `<details class="panel nudge-panel" id="nudge-panel" ${open ? 'open' : ''}><summary>${t('Haven’t heard back? Draft a follow-up')}</summary>
    <p class="muted">${t('Use this when nobody has replied to your last message. Anna writes a short, polite follow-up from what you sent and the history saved here.')}</p>
    ${error ? errorNotice(error, t('Your saved message and previous draft remain available. Confirm processing and retry.')) : ''}
    ${draft ? `<section class="nudge-draft"><h3>${t('Edit your follow-up')}</h3>${draft.missingInformation.length ? `<details class="missing-information"><summary>${t('Anna flagged details to check')}</summary><ul>${draft.missingInformation.map(item => `<li>${esc(item)}</li>`).join('')}</ul></details>` : ''}
      ${resolved ? `<h4>${esc(draft.subject)}</h4><pre class="response-text">${esc(draft.body)}</pre>` : `<form id="nudge-form"><label>${t('Subject')}<input name="subject" maxlength="200" value="${esc(draft.subject)}"></label><label>${t('Follow-up message')}<textarea name="body" aria-label="${esc(t('Follow-up message'))}" maxlength="6000" required>${esc(draft.body)}</textarea></label><p class="muted placeholder-hint" data-hint-for="nudge-form">${esc(placeholderHint(draft))}</p><div class="response-actions"><button class="secondary" type="submit">${t('Save draft')}</button><button class="secondary" type="button" data-action="copy-nudge">${t('Copy follow-up')}</button></div>${recordSent(goal)}</form>`}</section>` : ''}
    ${!resolved ? `<details class="draft-generator" ${!draft ? 'open' : ''}><summary>${draft ? t('Generate a replacement follow-up') : t('Your last message')}</summary><form id="nudge-request-form"><label>${t('What did you last send them?')}<textarea name="lastContact" maxlength="3000" required placeholder="${esc(t('Paste your last message, or summarize it: “Applied for the analyst role on Oct 2 and sent one follow-up.”'))}">${esc(outreach.lastContact)}</textarea></label><label>${t('When did you send it? (optional)')}<input type="date" name="lastContactOn" value="${esc(outreach.lastContactOn)}"></label><label>${t('Details to include (optional)')}<textarea name="extraContext" maxlength="2000" placeholder="${esc(t('Anything new to mention, preferred tone, or language.'))}"></textarea></label><label class="consent"><input type="checkbox" name="consent"><span>${t('Allow Anna and its model provider to process this goal, your last message, and the conversation history saved here.')}</span></label><button class="primary wide" type="submit">${draft ? t('Generate replacement follow-up') : t('Draft a follow-up')}</button></form></details>` : ''}
    ${sentHistory(outreach.sent, 'Follow-ups you recorded as sent ({count})')}
  </details>`;
}

export function renderReplies(goal, selectedId, error = '', nudgeError = '') {
  const reply = chosenReply(goal, selectedId);
  const resolved = goal.status === 'resolved';
  const draft = reply?.draft;
  const waitingStart = !reply && goal.outreach.lastContact;
  const followupForm = !resolved ? `<form id="followup-form" class="panel followup-form"><label>${t('Status')}<select name="stage" aria-label="${esc(t('Follow-up status'))}"><option value="needs_action" ${goal.followUp.stage === 'needs_action' ? 'selected' : ''}>${t('Needs your action')}</option><option value="waiting" ${goal.followUp.stage === 'waiting' ? 'selected' : ''}>${t('Waiting for a reply')}</option></select></label><label>${t('Next check-in')}<input type="date" name="checkInDate" aria-label="${esc(t('Next check-in'))}" value="${esc(goal.followUp.checkInDate)}"></label><button type="submit" class="secondary">${t('Save follow-up')}</button><p class="muted">${t('Choose a date yourself. Anna never schedules an inferred deadline automatically. Clear the date to remove the check-in.')}</p></form>` : '';
  const pasteBox = !resolved ? `<details class="panel paste-reply" ${!reply && !waitingStart ? 'open' : ''}><summary>${reply || waitingStart ? t('Paste a new reply') : t('Paste a reply')}</summary><form id="reply-form"><label>${t('Who sent it? (optional)')}<input name="sender" maxlength="160" placeholder="${esc(t('e.g. Recruiting team'))}"></label><label>${t('Date received (optional)')}<input name="receivedOn" type="date" value="${localDay()}"></label><label>${t('Reply text')}<textarea name="sourceText" maxlength="6000" required placeholder="${esc(t('Paste the message you want to understand. Remove sensitive identifiers first.'))}"></textarea></label><p class="muted">${t('Saving an older message? Set the date it arrived; the newest message stays current.')} ${t('Analysis is a separate step that requires your consent.')}</p><button class="primary" type="submit">${t('Save reply')}</button></form></details>` : '';
  return `<section class="reply-workbench" aria-label="${esc(t('Replies and follow-ups'))}">
    <div class="section-heading"><div><span class="eyebrow">${t('FROM REPLY TO RESPONSE')}</span><h2>${t('Make the next reply count.')}</h2></div></div>
    ${!reply && !waitingStart ? pasteBox : ''}
    ${!reply ? (waitingStart ? '' : `<div class="reply-empty"><h3>${t('Your next move starts with the latest reply.')}</h3><p>${t('Anna can identify what is requested, show supporting quotes, and help you prepare a response.')}</p></div>`) : `
      ${goal.replies.length > 1 ? `<div class="reply-picker"><label>${t('Saved reply')}<select id="reply-switch" aria-label="${esc(t('Saved reply'))}">${goal.replies.map(item => `<option value="${esc(item.id)}" ${item.id === reply.id ? 'selected' : ''}>${esc(item.sender || t('Reply'))} · ${esc(item.receivedOn || t('Date not specified'))} · ${esc(item.sourceText.slice(0, 65))}</option>`).join('')}</select></label></div>` : ''}
      <details class="panel original-source" id="source-${esc(reply.id)}"><summary>${t('Original reply')}${reply.sender ? ` · ${esc(reply.sender)}` : ''}</summary><blockquote>${esc(reply.sourceText)}</blockquote></details>
      ${error ? errorNotice(error, t('Your saved reply and previous draft remain available. Confirm processing and retry.')) : ''}
      <div class="reply-columns ${draft ? 'has-draft' : ''}"><section class="panel analysis-panel" aria-label="${esc(t('Reply analysis'))}"><span class="eyebrow">${t('UNDERSTAND THE REPLY')}</span>${renderAnalysis(reply)}
        ${!resolved ? `<label class="consent"><input type="checkbox" id="analysis-consent"><span>${reply.analysis ? t('Allow Anna and its model provider to process this reply and goal context, replacing this analysis.') : t('Allow Anna and its model provider to process this reply and goal context.')}</span></label><button class="secondary wide" data-action="analyze-reply">${reply.analysis ? t('Analyze again with Anna') : t('Analyze reply with Anna')}</button>` : ''}
      </section><section class="panel response-panel" aria-label="${esc(t('Response draft'))}"><span class="eyebrow">${t('PREPARE YOUR RESPONSE')}</span>
        ${draft ? `<h3>${t('Edit your draft')}</h3>${draft.missingInformation.length ? `<details class="missing-information"><summary>${t('Anna flagged details to check')}</summary><ul>${draft.missingInformation.map(item => `<li>${esc(item)}</li>`).join('')}</ul></details>` : ''}
          ${resolved ? `<h4>${esc(draft.subject)}</h4><pre class="response-text">${esc(draft.body)}</pre>` : `<form id="response-form" data-reply="${esc(reply.id)}"><label>${t('Subject')}<input name="subject" maxlength="200" value="${esc(draft.subject)}"></label><label>${t('Response')}<textarea name="body" aria-label="${esc(t('Response'))}" maxlength="6000" required>${esc(draft.body)}</textarea></label><p id="placeholder-hint" class="muted placeholder-hint" data-hint-for="response-form">${esc(placeholderHint(draft))}</p><div class="response-actions"><button class="secondary" type="submit">${t('Save draft')}</button><button class="secondary" type="button" data-action="copy-response">${t('Copy response')}</button></div>${reply.id === goal.replies[0].id ? recordSent(goal) : `<p class="muted">${t('This is an older reply. Use the latest reply to record a new response.')}</p>`}</form>`}` : `<h3>${t('Leave with a response you can use.')}</h3><p>${t('Anna drafts from the reply and your saved context. Missing details appear as placeholders for you to fill in.')}</p>`}
        ${!resolved ? `<details class="draft-generator" ${!draft ? 'open' : ''}><summary>${draft ? t('Generate a replacement draft') : t('Prepare a response with Anna')}</summary><form id="draft-request-form" data-reply="${esc(reply.id)}"><label>${t('Details to include (optional)')}<textarea name="extraContext" maxlength="2000" placeholder="${esc(t('Your actual portfolio links, facts, preferred tone, or language.'))}"></textarea></label><label class="consent"><input type="checkbox" name="consent"><span>${draft ? t('Allow Anna and its model provider to process this reply, goal context, earlier messages saved here, and these details. Replace the current draft after success.') : t('Allow Anna and its model provider to process this reply, goal context, earlier messages saved here, and these details.')}</span></label><button class="primary wide" type="submit">${draft ? t('Generate replacement draft') : t('Prepare response')}</button></form></details>` : ''}
        <p class="muted">${t('ExceptionOS does not send messages. Copying a draft does not mark it as sent.')}</p>
        ${sentHistory(reply.sentResponses, 'Responses you recorded as sent ({count})')}
      </section></div>`}
    ${renderNudge(goal, nudgeError)}
    ${reply || waitingStart ? pasteBox : ''}
    ${followupForm}
    ${!resolved ? `<div class="reply-footer"><button class="text-button" data-action="open-plan">${t('Back to plan and progress →')}</button><button class="resolve-button" data-action="resolve">${t('Close as resolved')}</button></div>` : ''}
  </section>`;
}
