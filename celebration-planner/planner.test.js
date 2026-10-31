const test = require('node:test');
const assert = require('node:assert/strict');
const { validate, buildPlan, planToText, PROFILES } = require('../js/planner.js');

const TODAY = '2026-11-01';
const base = { type: 'wedding', guests: 100, budget: 400000, date: '2027-05-01', setting: 'either', theme: 'modern', dietary: [] };
const plan = (over, today = TODAY) => {
  const { errors, value } = validate({ ...base, ...over }, today);
  assert.deepEqual(errors, {});
  return buildPlan(value, today);
};

test('budget lines always sum to the budget, for every type and size', () => {
  for (const type of Object.keys(PROFILES)) {
    for (const guests of [10, 151, 400]) {
      for (const budget of [1001, 99999, 1234567]) {
        const p = plan({ type, guests, budget, ageGroup: 'kids', setting: 'outdoor' });
        assert.equal(p.budget.reduce((s, l) => s + l.amount, 0), budget);
        assert.equal(p.budget.reduce((s, l) => s + l.pct, 0), 100);
        assert.ok(p.budget.every((l) => l.amount >= 0));
      }
    }
  }
});

test('validate rejects bad input with field errors', () => {
  const { errors } = validate({ type: 'x', guests: 0, budget: 10, date: '2026-02-30' }, TODAY);
  assert.deepEqual(Object.keys(errors).sort(), ['budget', 'date', 'guests', 'type']);
});

test('validate rejects past dates but accepts today', () => {
  assert.ok(validate({ ...base, date: '2026-10-31' }, TODAY).errors.date);
  assert.equal(validate({ ...base, date: TODAY }, TODAY).errors.date, undefined);
});

test('validate drops unknown dietary, theme and age values', () => {
  const { value } = validate({ ...base, dietary: ['jain', '<script>'], theme: 'evil', ageGroup: 'x' }, TODAY);
  assert.deepEqual(value.dietary, ['jain']);
  assert.equal(value.theme, 'modern');
  assert.equal(value.ageGroup, '');
});

test('lean budget triggers a per-guest warning', () => {
  const p = plan({ guests: 500, budget: 100000 });
  assert.equal(p.tier, 'lean');
  assert.ok(p.warnings.some((w) => w.includes('per guest')));
});

test('short lead time compresses the timeline and never schedules in the past', () => {
  const p = plan({ date: '2026-11-15' });
  assert.ok(p.timeline.rush);
  assert.ok(p.warnings.some((w) => w.includes('compressed')));
  assert.ok(p.timeline.steps.every((s) => s.due >= TODAY && s.due <= '2026-11-15'));
});

test('long lead time keeps full milestone spacing', () => {
  const p = plan({ date: '2027-06-01' });
  assert.equal(p.timeline.rush, false);
  assert.equal(p.timeline.steps[0].weeksBefore, 26);
});

test('monsoon outdoor date warns; indoor does not', () => {
  assert.ok(plan({ date: '2027-07-10', setting: 'outdoor' }).warnings.some((w) => w.includes('Monsoon')));
  assert.ok(!plan({ date: '2027-07-10', setting: 'indoor' }).warnings.some((w) => w.includes('Monsoon')));
});

test('dietary choices produce food notes; kids birthday gets more entertainment budget', () => {
  assert.equal(plan({ dietary: ['jain', 'halal'] }).dietaryNotes.length, 2);
  const kids = plan({ type: 'birthday', ageGroup: 'kids' }).budget.find((l) => l.id === 'entertainment');
  assert.ok(kids.pct > 15);
});

test('plan text export includes every section', () => {
  const text = planToText(plan({}));
  for (const s of ['BUDGET', 'TIMELINE', 'VENDOR CHECKLIST', 'IDEAS']) assert.ok(text.includes(s));
});
