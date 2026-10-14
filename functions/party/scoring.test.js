// Party Mode result calculations: averages, missing scores, ties, People's
// Choice, awards and recap. Pure functions — no emulator needed.
import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { computeCategoryResults, computeRecap, competitionRanks } = require("./scoring.js");

const category = { id: "c1", name: "Wheated Bourbon", description: "" };
const samples = [
  { label: "A", bottle: { name: "Weller Special Reserve", price: 30 } },
  { label: "B", bottle: { name: "Larceny", price: 25 } },
  { label: "C", bottle: { name: "Maker's Mark", price: 28 } },
];

function ballot(key, scores, extra = {}) {
  const shaped = Object.fromEntries(Object.entries(scores).map(([label, overall]) => [label, { overall }]));
  return { participantKey: key, source: "digital", nickname: key, scores: shaped, ...extra };
}

function sample(results, label) {
  return results.samples.find((s) => s.label === label);
}

describe("computeCategoryResults", () => {
  it("averages only submitted overall ratings and reports the count", () => {
    const results = computeCategoryResults({
      category,
      samples,
      ballots: [ballot("g1", { A: 8, B: 6 }), ballot("g2", { A: 7 }), ballot("g3", { A: 9, B: 4, C: 5 })],
      showNicknames: true,
    });
    expect(sample(results, "A")).toMatchObject({ average: 8, count: 3, rank: 1, isChampion: true });
    expect(sample(results, "B")).toMatchObject({ average: 5, count: 2, rank: 2 });
    expect(sample(results, "C")).toMatchObject({ average: 5, count: 1, rank: 2 });
    expect(results.ratingsCounted).toBe(6);
    expect(results.ballotsCounted).toBe(3);
  });

  it("never treats a missing score as zero; an unrated sample has no average or rank", () => {
    const results = computeCategoryResults({ category, samples, ballots: [ballot("g1", { A: 2, B: 3 })] });
    expect(sample(results, "C")).toMatchObject({ average: null, count: 0, rank: null, isChampion: false });
    expect(results.samples[results.samples.length - 1].label).toBe("C");
  });

  it("shares ranks and the championship on a tie", () => {
    const results = computeCategoryResults({
      category,
      samples,
      ballots: [ballot("g1", { A: 8, B: 8, C: 6 }), ballot("g2", { A: 6, B: 6, C: 6 })],
    });
    expect(sample(results, "A").rank).toBe(1);
    expect(sample(results, "B").rank).toBe(1);
    expect(sample(results, "C").rank).toBe(3);
    expect(results.champions.sort()).toEqual(["A", "B"]);
  });

  it("compares averages at two decimals so float noise can't break a tie", () => {
    const ranks = competitionRanks([
      { key: "x", value: 0.1 + 0.2 },
      { key: "y", value: 0.3 },
    ]);
    // Rounded before ranking in computeCategoryResults; the raw helper ranks exact values.
    expect(ranks.get("x")).toBe(1);
    const results = computeCategoryResults({
      category,
      samples: samples.slice(0, 2),
      ballots: [ballot("g1", { A: 7.1, B: 7.2 }), ballot("g2", { A: 7.2, B: 7.1 }), ballot("g3", { A: 7.3, B: 7.3 })],
    });
    expect(sample(results, "A").average).toBe(sample(results, "B").average);
    expect(results.champions.length).toBe(2);
  });

  it("calculates People's Choice from favorite votes, independent of averages", () => {
    const results = computeCategoryResults({
      category,
      samples,
      ballots: [
        ballot("g1", { A: 9, B: 7 }, { favoriteLabel: "B" }),
        ballot("g2", { A: 9, B: 7 }, { favoriteLabel: "B" }),
        ballot("g3", { A: 9, B: 7 }, { favoriteLabel: "A" }),
      ],
    });
    expect(results.champions).toEqual(["A"]);
    expect(results.peoplesChoice).toEqual(["B"]);
    expect(sample(results, "B")).toMatchObject({ favoriteVotes: 2, isPeoplesChoice: true });
  });

  it("has no People's Choice when nobody picked a favorite, and co-winners on a tie", () => {
    const none = computeCategoryResults({ category, samples, ballots: [ballot("g1", { A: 5 })] });
    expect(none.peoplesChoice).toEqual([]);
    expect(none.awards.find((a) => a.id === "peoples-choice")).toBeUndefined();
    const tie = computeCategoryResults({
      category,
      samples,
      ballots: [ballot("g1", { A: 5 }, { favoriteLabel: "A" }), ballot("g2", { B: 5 }, { favoriteLabel: "B" })],
    });
    expect(tie.peoplesChoice.sort()).toEqual(["A", "B"]);
  });

  it("weights paper and digital ballots equally and ignores excluded ballots", () => {
    const results = computeCategoryResults({
      category,
      samples,
      ballots: [
        ballot("g1", { A: 10 }),
        { ...ballot("p1", { A: 4 }), source: "paper", nickname: "", ballotNumber: "7" },
        ballot("g2", { A: 0 }, { excluded: true }),
      ],
      showNicknames: true,
    });
    expect(sample(results, "A")).toMatchObject({ average: 7, count: 2 });
    expect(results.guestScores.map((g) => g.name)).toEqual(["g1", "Ballot 7"]);
  });

  it("hides nicknames on shared results when the host turns them off", () => {
    const results = computeCategoryResults({ category, samples, ballots: [ballot("Kevin", { A: 7 })], showNicknames: false });
    expect(results.guestScores[0].name).toBe("Taster 1");
  });

  it("never includes private notes or detailed sub-scores in shared guest scores", () => {
    const results = computeCategoryResults({
      category,
      samples,
      ballots: [{ participantKey: "g1", source: "digital", scores: { A: { overall: 8, nose: 9, notes: "secret" } } }],
    });
    expect(JSON.stringify(results)).not.toContain("secret");
    expect(results.guestScores[0].scores).toEqual({ A: 8 });
  });

  it("awards Best Value only when every rated sample has a price", () => {
    const priced = computeCategoryResults({ category, samples, ballots: [ballot("g1", { A: 9, B: 8.5, C: 6 })] });
    expect(priced.awards.find((a) => a.id === "best-value").labels).toEqual(["B"]);
    const unpriced = computeCategoryResults({
      category,
      samples: [samples[0], { label: "B", bottle: { name: "Mystery" } }],
      ballots: [ballot("g1", { A: 9, B: 8 })],
    });
    expect(unpriced.awards.find((a) => a.id === "best-value")).toBeUndefined();
  });

  it("awards Biggest Surprise only from real predictions that missed the champion", () => {
    const ballots = [
      ballot("g1", { A: 9, B: 5 }, { predictionLabel: "B" }),
      ballot("g2", { A: 9, B: 5 }, { predictionLabel: "B" }),
      ballot("g3", { A: 9, B: 5 }, { predictionLabel: "A" }),
    ];
    const surprise = computeCategoryResults({ category, samples, ballots });
    expect(surprise.awards.find((a) => a.id === "biggest-surprise")).toMatchObject({ labels: ["A"] });
    const noPredictions = computeCategoryResults({ category, samples, ballots: ballots.map(({ predictionLabel, ...b }) => b) });
    expect(noPredictions.awards.find((a) => a.id === "biggest-surprise")).toBeUndefined();
  });

  it("handles a round with no ballots at all", () => {
    const results = computeCategoryResults({ category, samples, ballots: [] });
    expect(results.champions).toEqual([]);
    expect(results.awards).toEqual([]);
    expect(results.samples.every((s) => s.average === null)).toBe(true);
  });
});

describe("computeRecap", () => {
  it("summarizes revealed rounds: champions, highest rated, participants and ballots", () => {
    const r1 = computeCategoryResults({
      category,
      samples,
      ballots: [ballot("g1", { A: 8, B: 6 }, { favoriteLabel: "B" }), ballot("g2", { A: 9 })],
    });
    const r2 = computeCategoryResults({
      category: { id: "c2", name: "Rye" },
      samples: [
        { label: "A", bottle: { name: "Pikesville" } },
        { label: "B", bottle: { name: "Rittenhouse" } },
      ],
      ballots: [ballot("g1", { A: 9.5, B: 7 }), ballot("p1", { A: 6, B: 8 })],
    });
    const recap = computeRecap({ party: { name: "Bourbon Night", eventDate: "2026-10-14" }, results: [r1, r2], notes: "Great night" });
    expect(recap.categories.map((c) => c.name)).toEqual(["Wheated Bourbon", "Rye"]);
    expect(recap.bottles).toHaveLength(5);
    expect(recap.champions[0].winners[0].bottle.name).toBe("Weller Special Reserve");
    expect(recap.peoplesChoice[0].winners[0].bottle.name).toBe("Larceny");
    expect(recap.highestRated[0]).toMatchObject({ average: 8.5 });
    expect(recap.participantCount).toBe(3);
    expect(recap.totalBallots).toBe(4);
    expect(recap.notes).toBe("Great night");
  });
});
