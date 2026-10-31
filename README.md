# Celebration Planner

A smart event-planning assistant for **PromptWars Challenge 05: Celebration & Event Planner**. Tell it about a wedding, birthday or community event and it returns a budget split, a dated timeline, a vendor checklist and personalised ideas.

## Chosen vertical

Celebration & Event Planner: weddings, birthdays and community events, with budgets in INR.

## Approach and logic

The planning engine (`js/planner.js`) is a set of pure functions with no DOM access, so every decision is unit tested. Decisions come from the user's context:

| Context | Decision |
| --- | --- |
| Event type | Selects a budget profile, milestone list and vendor tasks |
| Guests and budget | Per-guest cost is rated `lean`, `standard` or `premium`; lean plans get a warning and a suggested guest count. More than 150 guests shifts budget from decor to catering |
| Days until the event | Milestones are compressed proportionally when time is short, never dated before today; under half the normal lead time triggers a rush warning |
| Month of event | Season tip (monsoon, winter, summer, post-monsoon); a monsoon date with an outdoor setting warns about weather |
| Age group (birthday) | Kids shift budget to entertainment and add age-appropriate ideas |
| Food needs | Vegetarian, vegan, Jain, halal and gluten-free notes for the caterer |
| Theme | Decor and activity ideas |

Budget lines always sum exactly to the budget; any rounding remainder goes to contingency.

## How it works

1. Fill in the form (type, guests, budget, date, setting, theme, food needs).
2. The input is validated (`validate`) and unknown values are discarded.
3. `buildPlan` produces the plan and the UI renders it. Checklist ticks are saved in the browser (localStorage).
4. **Copy plan** exports plain text; **Print** gives a clean print layout.

## Run it

No build step and no dependencies.

```bash
# open index.html directly, or serve it:
npm start            # http://localhost:8080
npm test             # runs the unit tests (Node 18+)
```

To deploy, publish the repository root with GitHub Pages (Settings, Pages, deploy from the `main` branch).

## Quality notes

- **Security:** all user text is inserted with `textContent` (no `innerHTML`), a strict Content-Security-Policy blocks inline scripts and external requests, inputs are validated and whitelisted, and nothing is sent to a server.
- **Accessibility:** labelled fields, error messages with `role="alert"` and `aria-invalid`, skip link, visible focus, keyboard-only use, focus moved to the results, `prefers-reduced-motion`, text and background contrast checked against the palette.
- **Efficiency:** no framework or network calls; the whole app is about 30 KB.
- **Testing:** `tests/planner.test.js` covers budget sums, validation, past dates, rush timelines, monsoon warnings, dietary notes and export.

## Assumptions

- Prices and per-guest minimums are rough planning guides for India, not vendor quotes.
- Monsoon is June to September.
- The assistant is rule-based and runs offline. A generative AI layer could be added later on top of `buildPlan`'s output.
- Dates are calendar dates in the user's local time.

## Project structure

```
index.html          page and form
css/style.css       theme (navy, sky blue, sand, amber)
js/planner.js       planning engine (pure, tested)
js/app.js           DOM rendering
tests/              unit tests
```
