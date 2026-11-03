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

function draw(canvas, data, key) {
  const st = data.stations[key];
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const css = getComputedStyle(document.documentElement);
  const fg = css.getPropertyValue("--muted").trim(), line = css.getPropertyValue("--line").trim();
  const W = canvas.clientWidth, rows = st.years.length, ndays = data.days.length;
  const left = 44, barW = Math.min(120, W * 0.18), gap = 8, top = 18;
  const cw = (W - left - barW - gap) / ndays, rh = Math.max(4, Math.min(8, cw * 1.1));
  const H = top + rows * rh + 4;
  const dpr = window.devicePixelRatio || 1;
  canvas.style.height = H + "px"; canvas.width = W * dpr; canvas.height = H * dpr;
  const g = canvas.getContext("2d"); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
  g.font = "11px system-ui, sans-serif"; g.fillStyle = fg; g.textBaseline = "middle";
  ["Jun", "Jul", "Aug"].forEach((m, i) => g.fillText(m, left + data.days.findIndex(d => d.startsWith("0" + (6 + i))) * cw, 8));
  const maxShare = Math.max(...Object.values(data.stations).flatMap(s => s.years.map(y => y.share)));
  st.years.forEach((y, r) => {
    const yy = top + r * rh;
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
}

async function main() {
  const data = window.FOG_DATA || await (await fetch("data/fog.json")).json();
  const canvas = document.getElementById("grid");
  document.getElementById("answer").textContent = FOG.answer(data);
  document.getElementById("source").textContent = data.source;
  document.getElementById("built").textContent = data.generated;
  document.getElementById("asos-year").textContent = data.asos_year;
  document.getElementById("asos-span").textContent = data.asos_span;
  const step = data.stations.sfo.asos_step_pp;
  document.getElementById("asos-step").textContent = (step >= 0 ? "+" : "") + step.toFixed(1);
  document.querySelectorAll(".lowm").forEach(e => (e.textContent = data.low_m));
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  document.getElementById("ramp").style.background =
    `linear-gradient(90deg, ${FOG.shade(0, dark)}, ${FOG.shade(8, dark)})`;
  let key = "sfo";
  const show = () => {
    document.getElementById("stats").innerHTML = stats(data, key)
      .map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join("");
    document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-pressed", b.dataset.stn === key));
    draw(canvas, data, key);
  };
  document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => { key = b.dataset.stn; show(); }));
  addEventListener("resize", show);
  show();
}

if (typeof window !== "undefined") main();
else module.exports = { FOG, stats };
