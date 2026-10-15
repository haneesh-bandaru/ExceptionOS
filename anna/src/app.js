import { platform } from './platform.js';
import { addUpdate, applyPlan, createGoal, emptyWorkspace, nextStep, progress, reopenGoal, resolveGoal, toggleStep, upsertGoal } from './domain.js';

const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
let workspace = emptyWorkspace();
let view = 'home';
let busy = false;

const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const fmt = value => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
const activeGoal = () => workspace.goals.find(goal => goal.id === workspace.activeGoalId) || null;
const announce = (message, kind = '') => { toast.textContent = message; toast.className = `toast show ${kind}`; setTimeout(() => toast.className = 'toast', 3200); };

async function persist(next, message) {
  workspace = await platform.save(next);
  render();
  if (message) announce(message);
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
  </div>`;
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
      ${goal.questions.length ? `<section class="panel questions"><span class="eyebrow">ANNA STILL WONDERS</span><ul>${goal.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul><p>Add answers as an update, then rebuild the plan.</p></section>` : ''}
      ${renderUpdates(goal)}
      ${!resolved ? `<button class="resolve-button" data-action="resolve">Close as resolved</button>` : ''}
    </aside></div>`}
  </section>`);
}

function renderPlanStart(goal) {
  return `<section class="plan-start"><div class="plan-symbol">✦</div><span class="eyebrow">ANNA PLANNING</span><h2>Turn this goal into the first move.</h2><p>Anna will read the information below and create 3–6 ordered actions. Review every suggestion before acting.</p>
    <dl><div><dt>Desired outcome</dt><dd>${esc(goal.outcome)}</dd></div>${goal.context ? `<div><dt>Context</dt><dd>${esc(goal.context)}</dd></div>` : ''}${goal.attempted ? `<div><dt>Already tried</dt><dd>${esc(goal.attempted)}</dd></div>` : ''}</dl>
    <label class="consent"><input type="checkbox" id="ai-consent"><span><strong>Build this plan with Anna</strong><small>I understand these goal details will be processed by Anna and its configured model provider.</small></span></label>
    <button class="primary wide" data-action="plan" ${busy ? 'disabled' : ''}>${busy ? '<span class="spinner"></span> Anna is building your plan…' : 'Build my action plan'}</button>
  </section>`;
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
  if (button.dataset.action === 'home') { view = 'home'; render(); return; }
  if (button.dataset.action === 'new') { view = 'new'; render(); return; }
  if (button.dataset.goal) { workspace.activeGoalId = button.dataset.goal; view = 'goal'; render(); return; }
  const goal = activeGoal();
  if (!goal) return;
  try {
    if (button.dataset.step) await persist(upsertGoal(workspace, toggleStep(goal, button.dataset.step)), 'Progress saved.');
    if (button.dataset.action === 'plan') await buildPlan(goal);
    if (button.dataset.action === 'replan') {
      const confirmed = confirm('Rebuilding replaces the current action checklist. Your progress log stays intact. Continue?');
      if (confirmed) { const reset = { ...goal, steps: [], summary: '', questions: [] }; await persist(upsertGoal(workspace, reset)); }
    }
    if (button.dataset.action === 'resolve') {
      const resolution = prompt('What happened? Record the outcome for your future reference.');
      if (resolution) await persist(upsertGoal(workspace, resolveGoal(goal, resolution)), 'Goal closed as resolved.');
    }
    if (button.dataset.action === 'reopen') await persist(upsertGoal(workspace, reopenGoal(goal)), 'Goal reopened.');
    if (button.dataset.action === 'delete' && confirm(`Delete “${goal.title}” and its history?`)) {
      const goals = workspace.goals.filter(item => item.id !== goal.id);
      view = 'home'; await persist({ ...workspace, goals, activeGoalId: goals[0]?.id || null }, 'Goal deleted.');
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
      await persist(upsertGoal(workspace, addUpdate(activeGoal(), data.body, data.url)), 'Update saved.');
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

