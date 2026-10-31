/* UI layer. All user-derived text is inserted with textContent (no innerHTML). */
(function () {
  'use strict';

  const { validate, buildPlan, planToText, PROFILES } = window.Planner;
  const form = document.getElementById('plan-form');
  const results = document.getElementById('results');
  const inr = (n) => '₹' + n.toLocaleString('en-IN');

  // Local calendar date (not UTC) so the "past date" check matches the user's day.
  function localISO() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function el(tag, props, ...kids) {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v);
    });
    kids.forEach((k) => node.append(k));
    return node;
  }

  const card = (title, cls, ...kids) => el('section', { class: 'card ' + (cls || '') }, el('h2', { text: title }), ...kids);

  function store(type) {
    const key = 'cep:' + type;
    return {
      read() {
        try { return JSON.parse(localStorage.getItem(key)) || []; } catch (e) { return []; }
      },
      write(list) {
        try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) { /* storage blocked: checklist just won't persist */ }
      },
    };
  }

  function fmtDate(iso) {
    return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function renderBudget(plan) {
    const max = Math.max(...plan.budget.map((l) => l.amount));
    const body = el('tbody');
    plan.budget.forEach((l) => {
      const bar = el('span', { class: 'bar', 'aria-hidden': 'true' });
      bar.style.width = Math.max(2, Math.round((l.amount / max) * 100)) + '%';
      body.append(el('tr', {},
        el('td', {}, el('span', { text: `${l.label} (${l.pct}%)` }), bar),
        el('td', { class: 'amt', text: inr(l.amount) })));
    });
    const table = el('table', {},
      el('thead', {}, el('tr', {}, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', class: 'amt', text: 'Amount' }))),
      body);
    return card('Budget split', '', table);
  }

  function renderTimeline(plan) {
    const list = el('ol', { class: 'timeline' });
    plan.timeline.steps.forEach((s) => {
      const when = s.weeksBefore === 0 ? 'Event day' : `${s.weeksBefore} week${s.weeksBefore > 1 ? 's' : ''} before`;
      list.append(el('li', {},
        el('time', { datetime: s.due, text: `${fmtDate(s.due)} · ${when}` }),
        el('span', { text: s.task })));
    });
    return card('Timeline', '', list);
  }

  function renderVendors(plan) {
    const saved = store(plan.input.type);
    const done = new Set(saved.read());
    const list = el('ul', { class: 'checks' });
    plan.vendors.forEach((l) => {
      const box = el('input', { type: 'checkbox', id: 'v-' + l.id });
      box.checked = done.has(l.id);
      box.addEventListener('change', () => {
        box.checked ? done.add(l.id) : done.delete(l.id);
        saved.write([...done]);
      });
      const label = el('span', { text: `${l.label}: ${l.task} (${inr(l.amount)})` });
      if (l.priority === 'first') label.append(el('span', { class: 'tag', text: 'book first' }));
      list.append(el('li', {}, el('label', { for: box.id }, box, label)));
    });
    const kids = [list];
    if (plan.dietaryNotes.length) {
      kids.push(el('h3', { text: 'Food notes' }), el('ul', {}, ...plan.dietaryNotes.map((d) => el('li', { text: d }))));
    }
    return card('Vendor checklist', '', ...kids);
  }

  function renderPlan(plan) {
    results.replaceChildren();

    const copyBtn = el('button', { type: 'button', class: 'btn ghost', text: 'Copy plan' });
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(planToText(plan));
        copyBtn.textContent = 'Copied';
      } catch (e) {
        copyBtn.textContent = 'Copy not allowed here';
      }
    });
    const printBtn = el('button', { type: 'button', class: 'btn ghost', text: 'Print' });
    printBtn.addEventListener('click', () => window.print());

    const head = el('div', { class: 'card summary' },
      el('div', {},
        el('h2', { id: 'plan-title', tabindex: '-1', text: plan.title }),
        el('span', { class: 'pill ' + plan.tier, text: `${inr(plan.perHead)} per guest · ${plan.tier}` }),
        el('span', { class: 'pill', text: plan.season + ' season' })),
      el('div', { class: 'actions' }, copyBtn, printBtn));
    results.append(head);

    if (plan.warnings.length) {
      results.append(card('Heads up', 'notes', el('ul', {}, ...plan.warnings.map((w) => el('li', { text: w })))));
    }
    results.append(
      renderBudget(plan),
      renderTimeline(plan),
      renderVendors(plan),
      card('Ideas for you', 'ideas', el('ul', {}, ...plan.ideas.map((i) => el('li', { text: i })))));

    document.getElementById('plan-title').focus();
  }

  function showErrors(errors) {
    ['type', 'guests', 'budget', 'date'].forEach((f) => {
      const input = form.elements[f];
      document.getElementById(f + '-err').textContent = errors[f] || '';
      input.setAttribute('aria-invalid', errors[f] ? 'true' : 'false');
    });
    const first = Object.keys(errors)[0];
    if (first) form.elements[first].focus();
  }

  function readForm() {
    const data = new FormData(form);
    return {
      type: data.get('type'),
      guests: data.get('guests'),
      budget: data.get('budget'),
      date: data.get('date'),
      setting: data.get('setting'),
      theme: data.get('theme'),
      ageGroup: data.get('ageGroup'),
      dietary: data.getAll('dietary'),
    };
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const today = localISO();
    const { errors, value } = validate(readForm(), today);
    showErrors(errors);
    if (Object.keys(errors).length === 0) renderPlan(buildPlan(value, today));
  });

  // Age group only matters for birthdays.
  const typeSelect = document.getElementById('type');
  const ageField = document.getElementById('age-field');
  typeSelect.addEventListener('change', () => { ageField.hidden = typeSelect.value !== 'birthday'; });

  const dateInput = document.getElementById('date');
  dateInput.min = localISO();
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 90);
  dateInput.value = `${defaultDate.getFullYear()}-${String(defaultDate.getMonth() + 1).padStart(2, '0')}-${String(defaultDate.getDate()).padStart(2, '0')}`;
  void PROFILES;
})();
