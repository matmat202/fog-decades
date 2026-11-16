/* The scrolling story: each <section class="step"> names a layout in data-step; as the
 * reader scrolls into a step, the chart redraws in that layout. Numbers in the prose are
 * not typed in: a <b data-fact="..."> is computed here from story.json, and
 * test/story.test.mjs checks each against the `check` block build_story.py computed in
 * python. Modelled on for-the-date/site/at-sea/story. */
import { layout, stats, weekStart, STEPS } from './layout.js';

const fmt = (n) => n.toLocaleString('en-US');
const pct = (v) => `${Math.round(v * 100)}%`;
const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export const inWords = (n) => words[n] || fmt(n);

/* Unknown names throw: a typo must not render as blank */
export function fact(D, f) {
  const S = stats(D);
  switch (f) {
    case 'summers': case 'oak_more': case 'days': case 'both': case 'sfo_only': case 'oak_only': return fmt(S[f]);
    case 'except': if (S.except.length !== 1) throw new Error('not one exception: rewrite the sentence'); return String(S.except[0]);
    case 'oak_given_sfo': case 'sfo_given_oak': return pct(S[f]);
    case 'sfo_only_pct': return pct(S.sfo_only / S.days);
    case 'oak_only_pct': return pct(S.oak_only / S.days);
    case 'first': case 'last': return String(S[f]);
    case 'peak_oak': case 'peak_sfo': return weekStart(D, S[f]);
    case 'low_m': return `${D.low_m} m`;
    default: throw new Error(`unknown fact ${f}`);
  }
}

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

async function main() {
  const D = await (await fetch('story.json')).json();
  for (const e of document.querySelectorAll('[data-fact]')) e.textContent = fact(D, e.dataset.fact);
  const steps = [...document.querySelectorAll('.step')];
  for (const s of steps) if (!STEPS[s.dataset.step]) throw new Error(`unknown step ${s.dataset.step}`);
  const plot = document.getElementById('plot');
  const svg = el('svg', { id: 'chart' });
  const gAxis = el('g', { class: 'axis' }), gS = el('g'), gLab = el('g', { class: 'labels' });
  svg.append(gAxis, gS, gLab);
  plot.append(svg);
  const tick = (g, x, y, text, cls = 'tick') => { const t = el('text', { x, y, class: cls }); t.textContent = text; g.append(t); };
  const grid = (x1, y1, x2, y2, cls = 'grid') => gAxis.append(el('line', { x1, x2, y1, y2, class: cls }));

  let shown = -1;
  const draw = (i) => {
    const name = steps[i].dataset.step;
    const box = plot.getBoundingClientRect(), W = box.width, H = box.height;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const L = layout(name, D, W, H);
    const narrow = W < 420;
    gAxis.replaceChildren(); gLab.replaceChildren();
    for (const v of L.yt) { grid(L.L, L.Y(v), L.R, L.Y(v)); tick(gAxis, L.L - 4, L.Y(v) + 4, `${v}%`, 'tick end'); }
    for (const [v, label] of L.xt) tick(gAxis, L.X(v), L.B + 15, narrow && name === 'pairs' ? label.replace(' only', '') : label, 'tick mid');
    grid(L.L, L.B, L.R, L.B, 'grid axisline');
    const cap = {
      summers: narrow ? 'low-cloud readings, each summer' : "each summer's share of readings with low cloud: SFO grey, Oakland red",
      pairs: narrow ? 'summer days with low cloud at…' : 'every summer day both airports recorded: low cloud at…',
      weeks: narrow ? 'low cloud, week by week' : 'low-cloud readings, week by week from 1 June: SFO grey, Oakland red',
    }[name];
    tick(gAxis, L.L, L.T - 10, cap, 'tick cat');
    gS.replaceChildren();
    for (const m of L.marks) {
      let e;
      if (m.kind === 'bar') e = el('rect', { x: m.x, y: m.y, width: Math.max(0, m.w), height: Math.max(0, m.h), class: m.cls });
      else if (m.kind === 'line') e = el('polyline', { points: m.pts.map((p) => p.join(',')).join(' '), class: `ln ${m.cls}` });
      else e = el('circle', { cx: m.x, cy: m.y, r: m.r, class: `dot ${m.cls}` });
      if (m.tip) { e.append(el('title')); e.firstChild.textContent = m.tip; }
      gS.append(e);
    }
    if (name === 'summers' || name === 'weeks') {
      const lastO = L.marks.filter((m) => m.kind === 'dot' && m.cls.startsWith('oak')).at(-1);
      const lastS = L.marks.filter((m) => m.kind === 'dot' && m.cls === 'sfo').at(-1);
      tick(gLab, lastO.x, lastO.y - 10, 'Oakland', 'tick lab end red');
      tick(gLab, lastS.x, lastS.y + 18, 'SFO', 'tick lab end');
    }
    document.body.dataset.step = i;
    window.__story = { step: i, name, shown: L.marks.filter((m) => m.kind !== 'line').length };
  };

  const pick = () => {
    const line = innerHeight * 0.5;
    let i = 0;
    for (let k = 0; k < steps.length; k++) if (steps[k].getBoundingClientRect().top < line) i = k;
    if (i !== shown) { shown = i; draw(i); }
  };
  addEventListener('scroll', pick, { passive: true });
  addEventListener('resize', () => { shown = -1; pick(); });
  pick();
}

if (typeof document !== 'undefined') main().catch((e) => {
  document.body.classList.add('failed');
  document.getElementById('err').textContent = String(e.message || e);
  console.error(e);
});
