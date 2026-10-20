import { platform } from './platform.js';
import { addUpdate, applyPlan, createGoal, emptyWorkspace, nextStep, normalizeWorkspace, progress, reopenGoal, resolveGoal, toggleStep, upsertGoal } from './domain.js';

const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
let workspace = emptyWorkspace();
let view = 'home';
let busy = false;
let modal = null;
let savingMessage = '';

const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const fmt = value => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
const activeGoal = () => workspace.goals.find(goal => goal.id === workspace.activeGoalId) || null;
const announce = (message, kind = '') => { toast.textContent = message; toast.className = `toast show ${kind}`; setTimeout(() => toast.className = 'toast', 3200); };

async function persist(next, message, pendingMessage = 'Saving…') {
  const previous = workspace;
  workspace = normalizeWorkspace(next);
  savingMessage = pendingMessage;
  render();
  announce(pendingMessage);
  try {
    workspace = await platform.save(workspace);
    savingMessage = '';
    render();
    if (message) announce(message);
  } catch (error) {
    workspace = previous;
    savingMessage = '';
    render();
    throw error;
  }
}

function shell(content) {
  return `<div class="shell">
    <aside class="rail">
      <button class="brand" data-action="home"><span class="mark">E</span><span>ExceptionOS</span></button>
      <button class="new-goal" data-action="new">+ New goal</button>
      <nav aria-label="Goals">
        <p class="rail-label">YOUR GOALS</p>
        ${workspace.goals.length ? workspace.goals.map(goal => `<button class="goal-link ${goal.id === workspace.activeGoalId && view === 'goal' ? 'active' : ''}" data-goal="${esc(goal.id)}"><span>${esc(goal.title)}</span><small>${goal.status === 'resolved' ? 'Resolved' : `${progress(goal)}% complete`}</small></button>`).join('') : '<p class="rail-empty">Your active goals will appear here.</p>'}
      </nav>
      <div class="rail-foot"><span class="secure-dot"></span><span>Private Anna storage</span></div>
    </aside>
    <main>${content}</main>
  </div>${savingMessage ? `<div class="sync-indicator" role="status"><span class="spinner"></span>${esc(savingMessage)}</div>` : ''}${renderModal()}`;
}

function renderModal() {
  if (!modal) return '';
  const goal = activeGoal();
  const details = {
    replan: { title: 'Rebuild this plan?', body: 'Anna will replace the current checklist. Your progress log and evidence will stay intact.', confirm: 'Rebuild plan' },
    delete: { title: 'Delete this goal?', body: `This permanently removes “${goal?.title || 'this goal'}” and its local history.`, confirm: 'Delete goal' },
    resolve: { title: 'Close this goal as resolved?', body: 'Record the outcome so you can understand what worked later.', confirm: 'Close as resolved' }
  }[modal];
  return `<div class="modal-backdrop" role="presentation"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <span class="eyebrow">CONFIRM ACTION</span><h2 id="modal-title">${esc(details.title)}</h2><p>${esc(details.body)}</p>
    ${modal === 'resolve' ? '<label>What happened?<textarea id="resolution-input" maxlength="1200" required autofocus placeholder="Record the result…"></textarea></label>' : ''}
    <div class="modal-actions"><button class="secondary" data-action="modal-cancel">Cancel</button><button class="primary ${modal === 'delete' ? 'danger' : ''}" data-action="modal-confirm">${esc(details.confirm)}</button></div>
  </section></div>`;
}

function renderHome() {
  const active = workspace.goals.filter(goal => goal.status === 'active');
  const resolved = workspace.goals.filter(goal => goal.status === 'resolved');
  const latest = active[0] || resolved[0];
  return shell(`<section class="home hero-grid">
    <div class="hero-copy">
      <span class="eyebrow">FROM STUCK TO DONE</span>
      <h1>Move the thing that<br><em>isn't moving.</em></h1>
      <p>ExceptionOS turns a stalled goal into one clear next action, then keeps the plan, evidence, and progress together.</p>
      <div class="hero-actions"><button class="primary" data-action="new">Start with a goal</button>${latest ? `<button class="secondary" data-goal="${esc(latest.id)}">Continue last goal</button>` : ''}</div>
      <div class="trust"><span>✓ No separate account</span><span>✓ Saved privately in Anna</span><span>✓ You control every action</span></div>
    </div>
    <div class="hero-card">
      <div class="mini-head"><span>How it works</span><span class="anna-pill">Powered by Anna</span></div>
      <ol class="flow-list">
        <li><b>1</b><div><strong>Name the outcome</strong><span>Tell us what needs to change and what you already tried.</span></div></li>
        <li><b>2</b><div><strong>Get a practical plan</strong><span>Anna turns the context into ordered, checkable steps.</span></div></li>
        <li><b>3</b><div><strong>Do the next thing</strong><span>Track progress, notes, and evidence until the goal is resolved.</span></div></li>
      </ol>
    </div>
  </section>
  <section class="stats"><div><strong>${active.length}</strong><span>Active goals</span></div><div><strong>${resolved.length}</strong><span>Resolved</span></div><div><strong>${workspace.goals.length ? Math.round(workspace.goals.reduce((sum, goal) => sum + progress(goal), 0) / workspace.goals.length) : 0}%</strong><span>Average progress</span></div></section>`);
}

function renderNew() {
  return shell(`<section class="form-page narrow">
    <button class="back" data-action="home">← Back</button>
    <span class="eyebrow">NEW GOAL</span><h1>What needs to move?</h1>
    <p class="lead">Start with the result. You can add detail now or refine it with Anna later.</p>
    <form id="goal-form" class="goal-form">
      <label>Short title <input name="title" maxlength="160" required placeholder="e.g. Get a decision on my application"></label>
      <label>What outcome do you want? <textarea name="outcome" maxlength="800" required placeholder="Describe what done looks like."></textarea></label>
      <div class="two-col"><label>Area <select name="category"><option>Education</option><option>Work</option><option>Money</option><option>Housing</option><option>Creator</option><option>Administration</option><option>Other</option></select></label><label>Organization (optional) <input name="organization" maxlength="160" placeholder="Who is involved?"></label></div>
      <label>What is happening? <textarea name="context" maxlength="2400" placeholder="Dates, replies, constraints, and useful facts. Do not include passwords or sensitive IDs."></textarea></label>
      <label>What have you tried? <textarea name="attempted" maxlength="1200" placeholder="Messages sent, forms filed, people contacted…"></textarea></label>
      <label class="date-label">Target date (optional) <input type="date" name="deadline"></label>
      <div class="privacy-note"><span>◈</span><p><strong>Private by design.</strong> Your workspace is stored in your Anna account. Goal details are sent to Anna only when you ask it to build a plan.</p></div>
      <button class="primary wide" type="submit">Create goal</button>
    </form>
  </section>`);
}

function renderGoal(goal) {
  if (!goal) return renderHome();
  const done = progress(goal);
  const next = nextStep(goal);
  const resolved = goal.status === 'resolved';
  return shell(`<section class="workspace-page">
    <header class="goal-head"><div><span class="eyebrow">${esc(goal.category)} · ${resolved ? 'RESOLVED' : 'ACTIVE GOAL'}</span><h1>${esc(goal.title)}</h1><p>${esc(goal.outcome)}</p></div><button class="more" data-action="delete" aria-label="Delete goal">Delete</button></header>
    <div class="progress-wrap"><div><span>Progress</span><strong>${done}%</strong></div><div class="progress-track"><i style="width:${done}%"></i></div></div>
    ${resolved ? `<section class="resolved-card"><span>✓</span><div><p>Goal resolved ${goal.resolvedAt ? `on ${fmt(goal.resolvedAt)}` : ''}</p><h2>${esc(goal.resolution)}</h2></div><button class="secondary" data-action="reopen">Reopen</button></section>` : ''}
    ${!goal.steps.length ? renderPlanStart(goal) : `<div class="workspace-grid"><div>
      ${next && !resolved ? `<section class="next-card"><span class="eyebrow">NEXT ACTION</span><h2>${esc(next.title)}</h2><p>${esc(next.why)}</p><div class="done-when"><strong>Done when</strong><span>${esc(next.doneWhen)}</span></div><button class="primary" data-step="${esc(next.id)}">Mark complete</button></section>` : ''}
      <section class="panel"><div class="panel-head"><div><span class="eyebrow">ACTION PLAN</span><h2>${goal.steps.filter(s => s.completed).length} of ${goal.steps.length} completed</h2></div>${!resolved ? '<button class="text-button" data-action="replan">Rebuild with Anna</button>' : ''}</div>
        <div class="steps">${goal.steps.map((step, index) => `<article class="step ${step.completed ? 'complete' : ''}"><button class="check" data-step="${esc(step.id)}" aria-label="${step.completed ? 'Reopen' : 'Complete'} step">${step.completed ? '✓' : index + 1}</button><div><h3>${esc(step.title)}</h3><p>${esc(step.why)}</p><small>DONE WHEN · ${esc(step.doneWhen)}</small>${step.sourceUrl ? `<a href="${esc(step.sourceUrl)}" target="_blank" rel="noopener">User-provided source ↗</a>` : ''}</div></article>`).join('')}</div>
      </section>
    </div><aside>
      ${goal.planNeedsRefresh && !resolved ? `<section class="refresh-notice" role="status"><span>↻</span><div><strong>New context is saved.</strong><p>The current plan and questions have not changed yet. Rebuild with Anna to include your latest update.</p><button class="secondary" data-action="replan">Rebuild plan with Anna</button></div></section>` : ''}
      ${goal.questions.length ? `<section class="panel questions"><span class="eyebrow">ANNA STILL WONDERS</span><ul>${goal.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul><p>Answer in the progress log. After saving, use “Rebuild plan with Anna” to update the plan and questions.</p></section>` : ''}
      ${renderUpdates(goal)}
      ${!resolved ? `<button class="resolve-button" data-action="resolve">Close as resolved</button>` : ''}
    </aside></div>`}
  </section>`);
}

function renderPlanStart(goal) {
  return `<div class="preplan"><section class="plan-start"><div class="plan-symbol">✦</div><span class="eyebrow">ANNA PLANNING</span><h2>Turn this goal into the first move.</h2><p>Anna will read the information below and create 3–6 ordered actions. Review every suggestion before acting.</p>
    <dl><div><dt>Desired outcome</dt><dd>${esc(goal.outcome)}</dd></div>${goal.context ? `<div><dt>Context</dt><dd>${esc(goal.context)}</dd></div>` : ''}${goal.attempted ? `<div><dt>Already tried</dt><dd>${esc(goal.attempted)}</dd></div>` : ''}</dl>
    <label class="consent"><input type="checkbox" id="ai-consent"><span><strong>Build this plan with Anna</strong><small>I understand these goal details will be processed by Anna and its configured model provider.</small></span></label>
    <button class="primary wide" data-action="plan" ${busy ? 'disabled' : ''}>${busy ? '<span class="spinner"></span> Anna is building your plan…' : 'Build my action plan'}</button>
  </section>${renderUpdates(goal)}</div>`;
}

function renderUpdates(goal) {
  return `<section class="panel updates"><span class="eyebrow">PROGRESS LOG</span>
    ${goal.status === 'active' ? `<form id="update-form"><textarea name="body" maxlength="1200" placeholder="What changed? Add an answer, call note, or result." required></textarea><input name="url" type="url" placeholder="Evidence link (optional, https://)"><button class="secondary wide" type="submit">Save update</button></form>` : ''}
    <div class="timeline">${goal.updates.length ? goal.updates.map(update => `<article><i></i><div><small>${fmt(update.createdAt)} · ${update.kind}</small><p>${esc(update.body)}</p>${update.url ? `<a href="${esc(update.url)}" target="_blank" rel="noopener">Open evidence ↗</a>` : ''}</div></article>`).join('') : '<p class="muted">Updates and evidence will appear here.</p>'}</div>
  </section>`;
}

function render() {
  app.innerHTML = view === 'new' ? renderNew() : view === 'goal' ? renderGoal(activeGoal()) : renderHome();
}

async function buildPlan(goal) {
  const consent = document.querySelector('#ai-consent')?.checked;
  if (!consent) return announce('Confirm Anna processing first.', 'error');
  busy = true; render();
  try {
    const plan = await platform.createPlan(goal, true);
    await persist(upsertGoal(workspace, applyPlan(goal, plan)), 'Your action plan is ready.');
  } catch (error) { render(); announce(error.message || 'Anna could not build the plan.', 'error'); }
  finally { busy = false; }
}

app.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (savingMessage) return;
  if (button.dataset.action === 'home') { view = 'home'; render(); return; }
  if (button.dataset.action === 'new') { view = 'new'; render(); return; }
  if (button.dataset.goal) { workspace.activeGoalId = button.dataset.goal; view = 'goal'; render(); return; }
  if (button.dataset.action === 'modal-cancel') { modal = null; render(); return; }
  const goal = activeGoal();
  if (!goal) return;
  try {
    if (button.dataset.step) await persist(upsertGoal(workspace, toggleStep(goal, button.dataset.step)), 'Progress saved.', 'Saving progress…');
    if (button.dataset.action === 'plan') await buildPlan(goal);
    if (button.dataset.action === 'replan') { modal = 'replan'; render(); }
    if (button.dataset.action === 'resolve') { modal = 'resolve'; render(); }
    if (button.dataset.action === 'reopen') await persist(upsertGoal(workspace, reopenGoal(goal)), 'Goal reopened.');
    if (button.dataset.action === 'delete') { modal = 'delete'; render(); }
    if (button.dataset.action === 'modal-confirm') {
      const action = modal;
      if (action === 'resolve') {
        const resolution = document.querySelector('#resolution-input')?.value;
        if (!resolution?.trim()) return announce('Record the outcome before closing the goal.', 'error');
        modal = null;
        await persist(upsertGoal(workspace, resolveGoal(goal, resolution)), 'Goal closed as resolved.');
      }
      if (action === 'replan') {
        modal = null;
        await persist(upsertGoal(workspace, { ...goal, steps: [], summary: '', questions: [], planNeedsRefresh: false }), 'Ready to rebuild with Anna.');
      }
      if (action === 'delete') {
        const goals = workspace.goals.filter(item => item.id !== goal.id);
        modal = null; view = 'home';
        await persist({ ...workspace, goals, activeGoalId: goals[0]?.id || null }, 'Goal deleted.');
      }
    }
  } catch (error) { announce(error.message, 'error'); }
});

app.addEventListener('submit', async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  try {
    if (event.target.id === 'goal-form') {
      const goal = createGoal(data);
      view = 'goal'; await persist(upsertGoal(workspace, goal), 'Goal created.');
    }
    if (event.target.id === 'update-form') {
      const current = activeGoal();
      const message = current.steps.length ? 'Update saved. Rebuild with Anna to refresh the plan.' : 'Update saved. Anna will include it when you build the plan.';
      await persist(upsertGoal(workspace, addUpdate(current, data.body, data.url)), message, 'Saving update…');
    }
  } catch (error) { announce(error.message, 'error'); }
});

async function start() {
  try { workspace = await platform.load(); }
  catch (error) { announce(`Could not load Anna storage: ${error.message}`, 'error'); }
  render();
  await platform.ready();
}
start();

