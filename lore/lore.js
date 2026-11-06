(function () {
  "use strict";
  var D = window.LORE_DATA;
  var $ = function (id) { return document.getElementById(id); };
  if (!D) { $("answer").textContent = "The data file did not load."; return; }
  var pct = function (x) { return Math.round(x * 100) + "%"; };
  var WORD = { holds: "It holds", backwards: "It runs backwards", chance: "No better than chance" };
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  };
  var count = { holds: 0, backwards: 0, chance: 0 };
  var html = D.sayings.map(function (s) {
    if (!s.control) count[s.verdict]++;
    var gap = Math.round(Math.abs(s.diff) * 100);
    var why = s.verdict === "chance"
      ? "The gap of " + (s.diff >= 0 ? "+" : "−") + gap + " points is inside what shuffling the years produces (" +
        (s.lo < 0 ? "−" : "+") + Math.abs(Math.round(s.lo * 100)) + " to " + (s.hi < 0 ? "−" : "+") + Math.abs(Math.round(s.hi * 100)) + ")."
      : "The outcome is " + gap + " points " + (s.diff > 0 ? "more" : "less") + " likely after the sign, and every re-run agrees on the direction.";
    return '<section class="card ' + s.verdict + '" data-id="' + esc(s.id) + '">' +
      "<h2>“" + esc(s.saying) + "”" + (s.control ? '<span class="tag">control</span>' : "") + "</h2>" +
      '<p class="verdict">' + WORD[s.verdict] + "</p>" +
      '<div class="rows">' +
        "<span>" + esc(s.outcome) + ", after " + esc(s.sign) + " (" + s.n.toLocaleString() + " days)</span>" +
        '<span class="num">' + pct(s.p) + "</span>" +
        '<div class="track sign"><i style="width:' + (s.p * 100).toFixed(1) + '%"></i></div>' +
        "<span>" + (s.versus ? esc(s.versus) : "on every other day") + " (" + s.n0.toLocaleString() + " days)</span>" +
        '<span class="num">' + pct(s.p0) + "</span>" +
        '<div class="track"><i style="width:' + (s.p0 * 100).toFixed(1) + '%"></i></div>' +
      "</div>" +
      '<p class="test">' + why + " " + esc(s.season) + ".</p></section>";
  }).join("");
  $("cards").innerHTML = html;
  var n = D.sayings.filter(function (s) { return !s.control; }).length;
  $("answer").textContent = "Of " + n + " sayings tested against " + D.n_years + " years of hourly records at SFO, " +
    count.holds + (count.holds === 1 ? " holds, " : " hold, ") +
    count.backwards + (count.backwards === 1 ? " runs backwards, " : " run backwards, ") + "and " +
    count.chance + (count.chance === 1 ? " is" : " are") + " no better than chance" +
    (D.sayings.some(function (s) { return s.id === "quake" && s.verdict === "chance"; })
      ? ", earthquake weather among them." : ".");
  $("draws").textContent = D.draws.toLocaleString();
  $("nq").textContent = D.n_quake_days.toLocaleString();
  $("years").textContent = D.years[0] + "–" + D.years[1];
  $("skipped").textContent = D.skipped.join(" and ");
  $("built").textContent = D.generated;
})();
