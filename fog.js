// Fog Decades: draws site/data/fog.json (made by build.py). Every number on the page
// is computed here from that file; nothing in the prose is typed in by hand.
"use strict";

const FOG = {
  // 0 = clear (pale sand), 8 = low cloud all day (slate grey)
  shade(v, dark) {
    if (v < 0) return null;
    const t = v / 8;
    const a = dark ? [58, 52, 40] : [244, 226, 186];
    const b = dark ? [196, 204, 214] : [84, 94, 108];
    return `rgb(${a.map((c, i) => Math.round(c + (b[i] - c) * t)).join(",")})`;
  },
  mean(xs) { return xs.reduce((s, x) => s + x, 0) / xs.length; },
  decade(stn, d) { return (stn.decades.find(x => x.decade === d) || {}).share; },
  // the sentence at the top: what changed, and when
  answer(data) {
    const s = data.stations.sfo, o = data.stations.oak;
    const f = x => x.toFixed(1);
    const sfoDrop = FOG.decade(s, 1950) - FOG.decade(s, 1960);
    const oakDrop = FOG.decade(o, 1950) - FOG.decade(o, 1960);
    const flat = Math.abs(s.slope_pp_per_decade) < 0.5;
    return `Not lately. At SFO, ${f(FOG.decade(s, 1950))}% of summer readings in the 1950s had low cloud; ` +
      `in the 1960s, ${f(FOG.decade(s, 1960))}% — a drop of ${f(sfoDrop)} points${oakDrop >= 1 ? ` (Oakland: ${f(oakDrop)})` : ", which Oakland does not share"}. ` +
      `Since ${data.trend_from} SFO has ${flat ? "barely moved" : "kept changing"} ` +
      `(${s.slope_pp_per_decade >= 0 ? "+" : ""}${f(s.slope_pp_per_decade)} points a decade), ` +
      `and Oakland has ${o.slope_pp_per_decade >= 0 ? "gained" : "lost"} ${f(Math.abs(o.slope_pp_per_decade))} points a decade.`;
  },
  // the middle half (25th to 75th percentile) of the summers since trend_from, linearly interpolated
  typical(st, from) {
    const xs = st.years.filter(r => r.year >= from).map(r => r.share).sort((a, b) => a - b);
    const q = p => { const i = (xs.length - 1) * p, lo = Math.floor(i); return xs[lo] + (xs[Math.ceil(i)] - xs[lo]) * (i - lo); };
    return [q(0.25), q(0.75)];
  },
  // one summer in words: its share, where it stands among the others, and one day if picked
  readout(data, key, year, day) {
    const st = data.stations[key], y = st.years.find(r => r.year === year);
    if (!y) return "";
    const clearer = st.years.filter(r => r.share < y.share).length;
    const name = key === "sfo" ? "SFO" : "Oakland";
    let s = `Summer ${y.year} at ${name}: ${y.share.toFixed(1)}% of readings had low cloud, ` +
      `foggier than ${clearer} of the ${st.years.length - 1} other summers on record.`;
    const [lo, hi] = FOG.typical(st, data.trend_from);
    s += ` The middle half of summers since ${data.trend_from} ran ${lo.toFixed(1)}–${hi.toFixed(1)}%, ` +
      `so this one was ${y.share < lo ? "clearer than usual" : y.share > hi ? "foggier than usual" : "typical"}.`;
    if (day != null && data.days[day]) {
      const [m, d] = data.days[day].split("-").map(Number);
      const when = `${["Jun", "Jul", "Aug"][m - 6]} ${d}`, v = y.days[day];
      s += v < 0 ? ` ${when} has too few readings to say.`
        : ` ${when}: low cloud in about ${v} of 8 readings.`;
    }
    return s;
  },
  // each time of day's share of low readings, averaged over the summers since `from` (null where none read it)
  hourMeans(st, from) {
    const ys = st.years.filter(r => r.year >= from);
    return ys[0].hours.map((_, i) => {
      const xs = ys.map(r => r.hours[i]).filter(v => v != null);
      return xs.length ? FOG.mean(xs) : null;
    });
  },
  // one summer's day in words: the time the low cloud peaked, the time it was least, against the usual peak
  when(data, key, year) {
    const st = data.stations[key], y = st.years.find(r => r.year === year);
    if (!y) return "";
    const at = xs => xs.map((v, i) => [v, i]).filter(([v]) => v != null);
    const top = xs => at(xs).reduce((a, b) => (b[0] > a[0] ? b : a));
    const [hi, h] = top(y.hours), [lo, l] = at(y.hours).reduce((a, b) => (b[0] < a[0] ? b : a));
    const [mhi, mh] = top(FOG.hourMeans(st, data.trend_from));
    return `Summer ${y.year} at ${key === "sfo" ? "SFO" : "Oakland"}: low cloud peaked at ${data.hours[h]} ` +
      `(${hi.toFixed(1)}% of readings) and was least at ${data.hours[l]} (${lo.toFixed(1)}%). ` +
      `The average summer since ${data.trend_from} peaks at ${data.hours[mh]}, with ${mhi.toFixed(1)}%.`;
  },
  // which summer (row) and day (column) a point on the canvas falls on; day is null off the grid
  hit(L, x, y) {
    const r = Math.floor((y - L.top) / L.rh);
    if (r < 0 || r >= L.rows) return null;
    const c = Math.floor((x - L.left) / L.cw);
    return { row: r, day: c >= 0 && c < L.ndays ? c : null };
  },
};

function stats(data, key) {
  const st = data.stations[key];
  const last = st.decades[st.decades.length - 1];
  const sign = x => (x >= 0 ? "+" : "") + x.toFixed(1);
  return [
    [FOG.decade(st, 1950).toFixed(1) + "%", "of summer readings low, 1950s"],
    [FOG.decade(st, 1960).toFixed(1) + "%", "1960s"],
    [last.share.toFixed(1) + "%", `${last.decade}s (${last.years} summers so far)`],
    [sign(st.slope_pp_per_decade), `points a decade since ${data.trend_from}`],
  ];
}

// the picked summer's 8 times of day as bars, each with a tick at the average summer since trend_from
function hours(el, data, key, year) {
  const st = data.stations[key], y = st.years.find(r => r.year === year), mean = FOG.hourMeans(st, data.trend_from);
  const top = Math.max(10, ...y.hours.filter(v => v != null), ...mean.filter(v => v != null));
  el.innerHTML = data.hours.map((t, i) => {
    const v = y.hours[i], m = mean[i];
    return `<div class="hr" role="listitem" aria-label="${t}: ${v == null ? "no readings" : v.toFixed(1) + "% low cloud"}">` +
      `<span class="v">${v == null ? "–" : Math.round(v) + "%"}</span>` +
      `<span class="col"><i class="bar" style="height:${v == null ? 0 : (100 * v / top).toFixed(1)}%"></i>` +
      (m == null ? "" : `<i class="avg" style="bottom:${(100 * m / top).toFixed(1)}%"></i>`) +
      `</span><span class="t">${t}</span></div>`;
  }).join("");
}

function draw(canvas, data, key, pick) {
  const st = data.stations[key];
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const css = getComputedStyle(document.documentElement);
  const fg = css.getPropertyValue("--muted").trim(), line = css.getPropertyValue("--line").trim();
  // one row per calendar year, so a summer with no record (Oakland 2000-03) is a blank row, not a closed gap
  const first = st.years[0].year, rows = st.years[st.years.length - 1].year - first + 1;
  const W = canvas.clientWidth, ndays = data.days.length;
  const left = 44, barW = Math.min(120, W * 0.18), gap = 8, top = 18;
  const cw = (W - left - barW - gap) / ndays, rh = Math.max(4, Math.min(8, cw * 1.1));
  const H = top + rows * rh + 4;
  const dpr = window.devicePixelRatio || 1;
  canvas.style.height = H + "px"; canvas.width = W * dpr; canvas.height = H * dpr;
  const g = canvas.getContext("2d"); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
  g.font = "11px system-ui, sans-serif"; g.fillStyle = fg; g.textBaseline = "middle";
  ["Jun", "Jul", "Aug"].forEach((m, i) => g.fillText(m, left + data.days.findIndex(d => d.startsWith("0" + (6 + i))) * cw, 8));
  const maxShare = Math.max(...Object.values(data.stations).flatMap(s => s.years.map(y => y.share)));
  st.years.forEach(y => {
    const yy = top + (y.year - first) * rh;
    if (y.year % 10 === 0) {
      g.fillStyle = fg; g.fillText(String(y.year), 0, yy + rh / 2);
      g.fillStyle = line; g.fillRect(left, yy, W - left, 0.5);
    }
    y.days.forEach((v, c) => {
      const col = FOG.shade(v, dark);
      if (!col) return;
      g.fillStyle = col; g.fillRect(left + c * cw, yy, Math.ceil(cw), Math.ceil(rh));
    });
    g.fillStyle = css.getPropertyValue("--accent").trim();
    g.fillRect(left + ndays * cw + gap, yy + 0.5, barW * y.share / maxShare, rh - 1);
  });
  // each decade's average share, a dark tick across the bars, so the 1950s step shows against the noise
  g.fillStyle = css.getPropertyValue("--fg").trim();
  st.decades.forEach(d => {
    const y0 = Math.max(d.decade, first), y1 = Math.min(d.decade + 9, first + rows - 1);
    g.fillRect(left + ndays * cw + gap + barW * d.share / maxShare - 1, top + (y0 - first) * rh, 2, (y1 - y0 + 1) * rh);
  });
  const r = pick ? pick.year - first : -1;
  if (r >= 0 && r < rows) {
    g.strokeStyle = css.getPropertyValue("--fg").trim(); g.lineWidth = 1.5;
    g.strokeRect(left - 2, top + r * rh - 1.5, W - left + 1, rh + 3);
    if (pick.day != null) g.strokeRect(left + pick.day * cw - 1.5, top + r * rh - 3, cw + 3, rh + 6);
  }
  return { left, top, cw, rh, rows, ndays, first };
}

async function main() {
  const data = window.FOG_DATA || await (await fetch("data/fog.json")).json();
  const canvas = document.getElementById("grid");
  document.getElementById("answer").textContent = FOG.answer(data);
  document.getElementById("source").textContent = data.source;
  document.getElementById("built").textContent = data.generated;
  document.getElementById("hours-from").textContent = data.trend_from;
  document.getElementById("asos-year").textContent = data.asos_year;
  document.getElementById("asos-span").textContent = data.asos_span;
  const step = data.stations.sfo.asos_step_pp;
  document.getElementById("asos-step").textContent = (step >= 0 ? "+" : "") + step.toFixed(1);
  document.querySelectorAll(".lowm").forEach(e => (e.textContent = data.low_m));
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  document.getElementById("ramp").style.background =
    `linear-gradient(90deg, ${FOG.shade(0, dark)}, ${FOG.shade(8, dark)})`;
  let key = "sfo", layout = null;
  const sel = document.getElementById("year");
  const years = () => data.stations[key].years.map(y => y.year);
  const pick = { year: years()[years().length - 1], day: null };
  const show = () => {
    if (!years().includes(pick.year)) { pick.year = years()[years().length - 1]; pick.day = null; }
    sel.innerHTML = years().slice().reverse().map(y => `<option${y === pick.year ? " selected" : ""}>${y}</option>`).join("");
    document.getElementById("readout").textContent = FOG.readout(data, key, pick.year, pick.day);
    document.getElementById("when").textContent = FOG.when(data, key, pick.year);
    hours(document.getElementById("hours"), data, key, pick.year);
    const i = years().indexOf(pick.year);
    document.getElementById("prev").disabled = i <= 0;
    document.getElementById("next").disabled = i >= years().length - 1;
    document.getElementById("stats").innerHTML = stats(data, key)
      .map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join("");
    document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-pressed", b.dataset.stn === key));
    layout = draw(canvas, data, key, pick);
  };
  const move = d => { const ys = years(), i = ys.indexOf(pick.year) + d; if (ys[i]) { pick.year = ys[i]; show(); } };
  document.getElementById("prev").addEventListener("click", () => move(-1));
  document.getElementById("next").addEventListener("click", () => move(1));
  sel.addEventListener("change", () => { pick.year = Number(sel.value); show(); });
  canvas.addEventListener("click", e => {
    const b = canvas.getBoundingClientRect(), h = layout && FOG.hit(layout, e.clientX - b.left, e.clientY - b.top);
    if (!h || !years().includes(layout.first + h.row)) return;
    pick.year = layout.first + h.row; pick.day = h.day; show();
  });
  document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => { key = b.dataset.stn; show(); }));
  addEventListener("resize", show);
  show();
}

if (typeof window !== "undefined") main();
else module.exports = { FOG, stats, hours };
