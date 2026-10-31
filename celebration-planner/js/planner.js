/*
 * Planning engine: pure functions, no DOM. Works in the browser (window.Planner)
 * and in Node (require) so the same code is unit tested.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Planner = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAY_MS = 86400000;

  // Budget lines: pct is the default share; priority 'first' = book these first.
  const PROFILES = {
    wedding: {
      label: 'Wedding',
      minPerHead: 1500,
      lines: [
        { id: 'venue', label: 'Venue', pct: 25, priority: 'first', task: 'Confirm venue, date, capacity and decor rules' },
        { id: 'catering', label: 'Catering', pct: 30, priority: 'first', task: 'Hold a menu tasting and lock the headcount' },
        { id: 'decor', label: 'Decor & flowers', pct: 12, priority: 'normal', task: 'Finalise moodboard and floral order' },
        { id: 'photo', label: 'Photo & video', pct: 10, priority: 'first', task: 'Book photographer and videographer' },
        { id: 'attire', label: 'Attire & styling', pct: 8, priority: 'normal', task: 'Order outfits and schedule fittings' },
        { id: 'entertainment', label: 'Music & entertainment', pct: 5, priority: 'normal', task: 'Book DJ or band and plan the music flow' },
        { id: 'stationery', label: 'Invitations', pct: 3, priority: 'normal', task: 'Design and send invitations' },
        { id: 'contingency', label: 'Contingency', pct: 7, priority: 'normal', task: 'Keep untouched for surprises' },
      ],
      milestones: [
        [26, 'Set the budget, draft the guest list, shortlist venues'],
        [22, 'Book venue and caterer'],
        [20, 'Book photographer and entertainment'],
        [16, 'Order attire; arrange stay for out-of-town guests'],
        [10, 'Send invitations'],
        [6, 'Menu tasting and final decor plan'],
        [3, 'Confirm RSVPs and vendor schedules'],
        [1, 'Final headcount, seating plan and payments'],
        [0, 'Event day: name one point person for all vendors'],
      ],
    },
    birthday: {
      label: 'Birthday',
      minPerHead: 500,
      lines: [
        { id: 'venue', label: 'Venue', pct: 20, priority: 'first', task: 'Book venue or confirm home setup' },
        { id: 'catering', label: 'Food & drinks', pct: 30, priority: 'first', task: 'Choose menu and confirm headcount' },
        { id: 'decor', label: 'Decor & balloons', pct: 15, priority: 'normal', task: 'Order theme decor and balloons' },
        { id: 'entertainment', label: 'Entertainment & games', pct: 15, priority: 'normal', task: 'Book entertainer, DJ or plan games' },
        { id: 'cake', label: 'Cake', pct: 7, priority: 'normal', task: 'Order cake (check egg-free or allergy needs)' },
        { id: 'photo', label: 'Photos', pct: 5, priority: 'normal', task: 'Book a photographer or assign a friend' },
        { id: 'gifts', label: 'Return gifts', pct: 3, priority: 'normal', task: 'Buy return gifts' },
        { id: 'contingency', label: 'Contingency', pct: 5, priority: 'normal', task: 'Keep untouched for surprises' },
      ],
      milestones: [
        [8, 'Set the budget, guest list and theme'],
        [6, 'Book venue and caterer'],
        [5, 'Book entertainer and photographer'],
        [4, 'Order cake and return gifts; send invites'],
        [2, 'Confirm RSVPs'],
        [1, 'Final headcount and decor setup plan'],
        [0, 'Event day: set up two hours early'],
      ],
    },
    community: {
      label: 'Community event',
      minPerHead: 150,
      lines: [
        { id: 'venue', label: 'Venue / ground', pct: 15, priority: 'first', task: 'Book the venue and confirm access hours' },
        { id: 'catering', label: 'Food & refreshments', pct: 25, priority: 'first', task: 'Confirm caterer or stalls and water supply' },
        { id: 'sound', label: 'Sound, light & stage', pct: 15, priority: 'first', task: 'Book sound, lights, stage and power backup' },
        { id: 'safety', label: 'Permits, security & first aid', pct: 10, priority: 'first', task: 'Apply for permissions; arrange security and first aid' },
        { id: 'decor', label: 'Decor & signage', pct: 8, priority: 'normal', task: 'Print banners and way-finding signs' },
        { id: 'publicity', label: 'Publicity', pct: 10, priority: 'normal', task: 'Publish posters and social posts' },
        { id: 'entertainment', label: 'Performers & speakers', pct: 10, priority: 'normal', task: 'Confirm performers and speakers' },
        { id: 'volunteers', label: 'Volunteer support', pct: 2, priority: 'normal', task: 'Open volunteer sign-up; plan meals and ID tags' },
        { id: 'contingency', label: 'Contingency', pct: 5, priority: 'normal', task: 'Keep untouched for surprises' },
      ],
      milestones: [
        [12, 'Form a committee, set the budget, start permit applications'],
        [10, 'Book venue and sound'],
        [8, 'Open volunteer sign-up and start publicity'],
        [6, 'Confirm performers, speakers and caterers'],
        [3, 'Finish safety plan, first aid and crowd flow'],
        [1, 'Brief volunteers and confirm final headcount'],
        [0, 'Event day: run a briefing one hour before doors open'],
      ],
    },
  };

  const THEMES = {
    modern: ['Monochrome palette with one bold accent colour', 'Neon sign or LED backdrop for photos', 'Minimal florals in clear glass vases'],
    traditional: ['Marigold and mango-leaf toran at the entrance', 'Brass lamps (diyas) and rangoli', 'Live folk or classical music during arrivals'],
    garden: ['Fairy lights and potted greenery', 'Seasonal flowers in mason jars', 'Lawn games such as giant Jenga and badminton'],
    retro: ['Vinyl-style signage and a throwback playlist', 'Polaroid wall for guests', 'Retro snacks counter (kulfi, golgappe, soda)'],
    festive: ['Layered string lights and lanterns', 'DIY photo corner with props', 'Theme-coloured dress code shared in the invite'],
  };

  const TYPE_IDEAS = {
    wedding: ['Welcome desk with printed schedule for guests', 'Memory wall of the couple\'s photos', 'Dedicated quiet room for elders'],
    birthday: ['Pass-the-parcel or treasure hunt', 'Cake-cutting moment with a short slideshow', 'DIY activity table (cookie or mask painting)'],
    community: ['Shaded rest and drinking-water points', 'Kids\' corner with volunteer supervision', 'Feedback QR code on exit signage'],
  };

  const AGE_IDEAS = {
    kids: ['Magician, puppet show or face painting', 'Bounce-house if space allows (check the floor and supervision)'],
    teens: ['Karaoke or console gaming corner', 'Photo-booth with instant prints'],
    adults: ['Signature mocktail or chai bar', 'Live acoustic set'],
    seniors: ['Comfortable seating near the stage', 'Soft background music at conversation volume'],
  };

  const DIETARY = {
    vegetarian: 'Pure-vegetarian menu with separate cooking and serving counters',
    vegan: 'Plant-based dishes labelled clearly; no ghee or paneer in vegan items',
    jain: 'Jain options: no root vegetables, onion or garlic; label them',
    halal: 'Halal-certified caterer and meat supplier',
    'gluten-free': 'Gluten-free options labelled; confirm separate preparation',
  };

  // Assumes India (monsoon June to September).
  function seasonOf(month) {
    if (month >= 6 && month <= 9) return 'monsoon';
    if (month === 11 || month === 12 || month <= 2) return 'winter';
    if (month === 10) return 'post-monsoon';
    return 'summer';
  }

  const SEASON_TIPS = {
    monsoon: 'Monsoon: keep a covered or indoor backup and waterproof the decor and sound.',
    winter: 'Winter: outdoor evenings work well; plan warm drinks and some heaters.',
    'post-monsoon': 'Post-monsoon: pleasant weather but check the forecast the week before.',
    summer: 'Summer: prefer evening timings, shade, and plenty of cold drinks and water.',
  };

  const toDay = (iso) => Date.parse(iso + 'T00:00:00Z');
  const toISO = (ms) => new Date(ms).toISOString().slice(0, 10);

  function todayISO(now) {
    return toISO(now === undefined ? Date.now() : now);
  }

  /** Validate raw form input. Returns { errors: {field: message}, value }. */
  function validate(input, today) {
    const errors = {};
    const v = {};
    const raw = input || {};

    v.type = String(raw.type || '');
    if (!PROFILES[v.type]) errors.type = 'Choose an event type.';

    v.guests = Number(raw.guests);
    if (!Number.isInteger(v.guests) || v.guests < 1 || v.guests > 5000) {
      errors.guests = 'Enter a whole number of guests from 1 to 5000.';
    }

    v.budget = Number(raw.budget);
    if (!Number.isInteger(v.budget) || v.budget < 1000 || v.budget > 1e9) {
      errors.budget = 'Enter a budget of at least ₹1,000 (whole rupees).';
    }

    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(raw.date || '') && toISO(toDay(raw.date)) === raw.date;
    v.date = raw.date;
    if (!dateOk) errors.date = 'Pick a valid event date.';
    else if (toDay(raw.date) < toDay(today || todayISO())) errors.date = 'The event date cannot be in the past.';

    v.setting = ['indoor', 'outdoor', 'either'].includes(raw.setting) ? raw.setting : 'either';
    v.theme = THEMES[raw.theme] ? raw.theme : 'modern';
    v.ageGroup = AGE_IDEAS[raw.ageGroup] ? raw.ageGroup : '';
    v.dietary = (Array.isArray(raw.dietary) ? raw.dietary : []).filter((d) => DIETARY[d]);
    return { errors, value: v };
  }

  function shift(weights, from, to, amount) {
    if (weights[from] > amount) {
      weights[from] -= amount;
      weights[to] += amount;
    }
  }

  function allocateBudget(profile, v) {
    const weights = {};
    profile.lines.forEach((l) => { weights[l.id] = l.pct; });
    if (v.guests > 150) shift(weights, 'decor', 'catering', 3);
    if (v.type === 'birthday' && v.ageGroup === 'kids') {
      shift(weights, 'decor', 'entertainment', 3);
      shift(weights, 'photo', 'entertainment', 2);
    }
    if (v.type === 'community' && v.setting === 'outdoor') shift(weights, 'publicity', 'sound', 2);

    let spent = 0;
    const lines = profile.lines.map((l) => {
      const amount = l.id === 'contingency' ? 0 : Math.floor((v.budget * weights[l.id]) / 100);
      spent += amount;
      return { ...l, pct: weights[l.id], amount };
    });
    // Rounding remainder goes to contingency so the lines always sum to the budget.
    lines[lines.length - 1].amount = v.budget - spent;
    return lines;
  }

  function buildTimeline(profile, eventISO, today) {
    const days = Math.round((toDay(eventISO) - toDay(today)) / DAY_MS);
    const fullWeeks = Math.max(...profile.milestones.map((m) => m[0]));
    const factor = Math.min(1, days / 7 / fullWeeks);
    const steps = profile.milestones.map(([weeks, task]) => {
      const dueWeeks = Math.round(weeks * factor);
      const due = Math.max(toDay(eventISO) - dueWeeks * 7 * DAY_MS, toDay(today));
      return { due: toISO(due), weeksBefore: dueWeeks, task };
    });
    return { days, rush: factor < 0.5, steps };
  }

  /** Build the full plan from validated input. */
  function buildPlan(v, today) {
    const now = today || todayISO();
    const profile = PROFILES[v.type];
    const lines = allocateBudget(profile, v);
    const timeline = buildTimeline(profile, v.date, now);
    const perHead = Math.round(v.budget / v.guests);
    const tier = perHead < profile.minPerHead ? 'lean' : perHead < profile.minPerHead * 2.5 ? 'standard' : 'premium';
    const season = seasonOf(Number(v.date.slice(5, 7)));

    const warnings = [];
    if (tier === 'lean') {
      const fit = Math.floor(v.budget / profile.minPerHead);
      warnings.push(`₹${perHead.toLocaleString('en-IN')} per guest is below a realistic minimum of about ₹${profile.minPerHead.toLocaleString('en-IN')}. Consider about ${fit} guests, or raise the budget.`);
    }
    if (timeline.rush) {
      warnings.push(`Only ${timeline.days} days to go: the timeline is compressed, so book venue and caterer first.`);
    }
    if (season === 'monsoon' && v.setting !== 'indoor') {
      warnings.push('Monsoon date with an outdoor setting: choose a covered venue or keep a weatherproof backup.');
    }

    const ideas = [
      ...THEMES[v.theme],
      ...TYPE_IDEAS[v.type],
      ...(v.type === 'birthday' && v.ageGroup ? AGE_IDEAS[v.ageGroup] : []),
      SEASON_TIPS[season],
    ];

    return {
      input: v,
      title: `${profile.label} for ${v.guests} guests`,
      perHead,
      tier,
      season,
      warnings,
      budget: lines,
      timeline,
      vendors: lines.filter((l) => l.id !== 'contingency'),
      dietaryNotes: v.dietary.map((d) => DIETARY[d]),
      ideas,
    };
  }

  const inr = (n) => '₹' + n.toLocaleString('en-IN');

  function planToText(plan) {
    const out = [plan.title, `Budget ${inr(plan.input.budget)} (${inr(plan.perHead)} per guest, ${plan.tier})`, ''];
    if (plan.warnings.length) out.push('NOTES', ...plan.warnings.map((w) => '- ' + w), '');
    out.push('BUDGET', ...plan.budget.map((l) => `- ${l.label}: ${inr(l.amount)}`), '');
    out.push('TIMELINE', ...plan.timeline.steps.map((s) => `- ${s.due}: ${s.task}`), '');
    out.push('VENDOR CHECKLIST', ...plan.vendors.map((l) => `- [ ] ${l.label}: ${l.task} (${inr(l.amount)})`), '');
    if (plan.dietaryNotes.length) out.push('FOOD NOTES', ...plan.dietaryNotes.map((d) => '- ' + d), '');
    out.push('IDEAS', ...plan.ideas.map((i) => '- ' + i));
    return out.join('\n');
  }

  return { PROFILES, THEMES, DIETARY, AGE_IDEAS, validate, buildPlan, planToText, todayISO };
});
