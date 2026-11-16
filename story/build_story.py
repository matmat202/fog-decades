#!/usr/bin/env python3
"""site/data/fog.json -> site/story/story.json: which side of the Bay gets the fog?

    python3 build_story.py          # BUILD_OUT=... writes elsewhere (publish.sh compares)

Everything comes from the file the page already ships. A "low-cloud day" is a summer day
with at least one of its eight 3-hourly readings at a ceiling at or below 400 m (the page's
own measure, fog.json's `days` counts). Only summers both airports recorded are compared
(Oakland has none for 2000-03).

  summers  [year, SFO share %, OAK share %]   (fog.json's `share`: readings, not days)
  pairs    days by [SFO low cloud?, OAK low cloud?]: both, OAK only, SFO only, neither
  weeks    13 weeks of the season from 1 June (the last has 8 days), [SFO %, OAK %] of readings, all summers
  halves   the same as months, for 1948-1987 and 1988-2026: {stn: [June, July, August] %}

test/story.test.mjs recomputes every quoted number from fog.json in JS, with the page's own
layout.js stats(), and requires the `check` block below, computed here in python, to agree.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "site", "data", "fog.json")
OUT = os.environ.get("BUILD_OUT", os.path.join(HERE, "site", "story", "story.json"))
HALVES = ((1948, 1987), (1988, 2026))


def r2(x): return round(x, 2)


def pct(xs): return 100 * sum(xs) / (8 * len(xs))


def main():
    F = json.load(open(SRC))
    days = F["days"]
    S = {y["year"]: y for y in F["stations"]["sfo"]["years"]}
    O = {y["year"]: y for y in F["stations"]["oak"]["years"]}
    common = sorted(set(S) & set(O))
    pairs = {"both": 0, "oak": 0, "sfo": 0, "neither": 0}
    for y in common:
        for s, o in zip(S[y]["days"], O[y]["days"]):
            pairs["both" if s and o else "sfo" if s else "oak" if o else "neither"] += 1
    weeks = []
    for w in range(13):  # 92 days: the last week takes the 8th day, 31 August
        lo, hi = 7 * w, 7 * w + 7 if w < 12 else len(days)
        weeks.append([r2(pct([v for y in common for v in Y[y]["days"][lo:hi]])) for Y in (S, O)])
    halves = {}
    for a, b in HALVES:
        ys = [y for y in common if a <= y <= b]
        halves[f"{a}-{b}"] = {k: [r2(pct([v for y in ys for i, v in enumerate(Y[y]["days"]) if days[i][:2] == m]))
                                  for m in ("06", "07", "08")] for k, Y in (("sfo", S), ("oak", O))}
    D = {
        "source": "NOAA hourly airport observations, as Fog Decades ships them in site/data/fog.json",
        "low_m": F["low_m"], "days": [days[0], days[-1]],
        "summers": [[y, S[y]["share"], O[y]["share"]] for y in common],
        "pairs": pairs, "weeks": weeks, "halves": halves,
    }
    sm = D["summers"]
    n = sum(pairs.values())
    D["check"] = {
        "summers": len(sm), "oak_more": sum(1 for _, s, o in sm if o > s),
        "except": [y for y, s, o in sm if o <= s],
        "days": n, "both": pairs["both"], "sfo_only": pairs["sfo"], "oak_only": pairs["oak"],
        "oak_given_sfo": pairs["both"] / (pairs["both"] + pairs["sfo"]),
        "sfo_given_oak": pairs["both"] / (pairs["both"] + pairs["oak"]),
        "peak_sfo": max(range(len(weeks)), key=lambda i: weeks[i][0]),
        "peak_oak": max(range(len(weeks)), key=lambda i: weeks[i][1]),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(D, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print("  ".join(f"{k} {v:.3f}" if isinstance(v, float) else f"{k} {v}" for k, v in D["check"].items()))
    print("halves", D["halves"])
    print("weeks", D["weeks"])


if __name__ == "__main__":
    main()
