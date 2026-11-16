/* Where every mark sits on each step of the story. Pure: no DOM, so test/story.test.mjs
 * runs every layout at several plot sizes. Modelled on for-the-date/site/at-sea/story.
 *
 *   "summers": each summer both airports recorded: its share of low-cloud readings, SFO grey, Oakland red
 *   "pairs":   every one of those summer days: low cloud at both, Oakland only, SFO only, neither
 *   "weeks":   the season week by week from 1 June, all summers together, SFO grey, Oakland red
 */
export const STEPS = { summers: 'summers', pairs: 'pairs', weeks: 'weeks' };
export const PAIRS = [['both', 'both'], ['oak', 'Oakland only'], ['sfo', 'SFO only'], ['neither', 'neither']];
const MON = ['June', 'July', 'August'];

const memo = new WeakMap();
/* -> the numbers the story quotes; build_story.py's `check` holds the same */
export function stats(D) {
  if (memo.has(D)) return memo.get(D);
  const sm = D.summers, P = D.pairs, W = D.weeks;
  const n = P.both + P.oak + P.sfo + P.neither;
  const argmax = (k) => W.reduce((b, w, i) => (w[k] > W[b][k] ? i : b), 0);
  const S = {
    summers: sm.length, oak_more: sm.filter((r) => r[2] > r[1]).length, except: sm.filter((r) => r[2] <= r[1]).map((r) => r[0]),
    days: n, both: P.both, sfo_only: P.sfo, oak_only: P.oak,
    oak_given_sfo: P.both / (P.both + P.sfo), sfo_given_oak: P.both / (P.both + P.oak),
    peak_sfo: argmax(0), peak_oak: argmax(1),
    first: sm[0][0], last: sm.at(-1)[0],
  };
  // June the least foggy month, at both airports, in both halves of the record?
  S.june_least = Object.values(D.halves).every((h) => ['sfo', 'oak'].every((k) => h[k][0] < Math.min(h[k][1], h[k][2])));
  memo.set(D, S);
  return S;
}

/* the first day of week i, as "27 July" */
export function weekStart(D, i) {
  const [m, d] = D.days[0].split('-').map(Number);
  const t = new Date(Date.UTC(2026, m - 1, d + 7 * i));
  return `${t.getUTCDate()} ${MON[t.getUTCMonth() - 5]}`;
}

/* -> {X, Y, L, R, T, B, marks, xt: [[v, label]], yt} in px of w x h */
export function layout(name, D, w, h) {
  if (!STEPS[name]) throw new Error(`unknown step ${name}`);
  const L = 40, R = w - 10, T = 26, B = h - 22;
  let x0, x1, y1;
  if (name === 'summers') { x0 = 1945; x1 = 2029; y1 = 45; }
  else if (name === 'pairs') { x0 = 0; x1 = 4; y1 = 60; }
  else { x0 = -0.5; x1 = 12.5; y1 = 40; }
  const X = (v) => L + ((v - x0) / (x1 - x0)) * (R - L);
  const Y = (v) => B - (v / y1) * (B - T);
  const marks = [];
  if (name === 'summers') {
    for (const [y, s, o] of D.summers) {
      marks.push({ kind: 'dot', cls: 'sfo', x: X(y), y: Y(s), r: 3, tip: `SFO, summer ${y}: ${s}% of readings low cloud` });
      marks.push({ kind: 'dot', cls: o > s ? 'oak' : 'oak flip', x: X(y), y: Y(o), r: o > s ? 3 : 6, tip: `Oakland, summer ${y}: ${o}%` });
    }
  } else if (name === 'pairs') {
    const n = D.pairs.both + D.pairs.oak + D.pairs.sfo + D.pairs.neither, slot = (R - L) / 4, gap = Math.min(16, slot * 0.2);
    PAIRS.forEach(([k, label], i) => {
      const v = (D.pairs[k] / n) * 100, top = Y(v);
      marks.push({ kind: 'bar', cls: k === 'sfo' ? 'hit' : 'bar', x: L + i * slot + gap / 2, y: top, w: slot - gap, h: B - top, label, tip: `${label}: ${D.pairs[k].toLocaleString('en-US')} of ${n.toLocaleString('en-US')} days` });
    });
  } else {
    for (const [k, cls] of [[0, 'sfo'], [1, 'oak']]) {
      marks.push({ kind: 'line', cls, pts: D.weeks.map((wk, i) => [X(i), Y(wk[k])]) });
      D.weeks.forEach((wk, i) => marks.push({ kind: 'dot', cls, x: X(i), y: Y(wk[k]), r: 3.5, tip: `${k ? 'Oakland' : 'SFO'}, week of ${weekStart(D, i)}: ${wk[k]}%` }));
    }
  }
  const xt = name === 'summers' ? [1950, 1970, 1990, 2010].map((v) => [v, String(v)])
    : name === 'pairs' ? PAIRS.map(([, label], i) => [i + 0.5, label])
    : [0, 4, 9].map((i) => [i, weekStart(D, i)]);
  const yt = name === 'pairs' ? [20, 40, 60] : name === 'summers' ? [15, 30, 45] : [10, 20, 30, 40];
  return { kind: name, X, Y, L, R, T, B, xt, yt, marks };
}
