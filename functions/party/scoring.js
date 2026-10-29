// Blind Room Party Mode — result calculations.
//
// Pure functions only (no Firestore), so every ranking rule is unit-tested
// directly (see scoring.test.js). Called by the server at reveal time and
// at party completion; the client never computes rankings it then trusts.
//
// Fairness rules:
//   - The ranking metric is each participant's explicit OVERALL enjoyment
//     rating (0-10), the one score Quick and Detailed scoring both collect.
//     Detailed sub-scores never feed the ranking, so neither scoring method
//     is weighted over the other. Digital and paper ballots count equally.
//   - A sample nobody rated has no average (null), never 0.
//   - Averages are compared at two decimals, and equal averages share a
//     rank (standard competition ranking: 1, 1, 3).
//   - People's Choice comes only from explicit favorite votes.
//   - Awards are only produced from data that actually exists (prices for
//     Best Value, recorded predictions for Biggest Surprise).
//   - Dual Experience: the guided and blind groups are also scored
//     independently, on the same scale, each over its own ballots only.
//     Groups are compared by AVERAGE (always with its rating count), never
//     by raw totals, since the groups are different sizes.

const MIN_PREDICTIONS_FOR_SURPRISE = 3;
const GROUPS = ["guided", "blind"];
// "Both groups enjoyed it": both group averages at or above this.
const BOTH_ENJOYED_MIN = 7;

function round2(value) {
  return Math.round(value * 100) / 100;
}

function isValidOverall(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10;
}

// Ballots that count: not excluded by the host.
function countedBallots(ballots) {
  return (ballots || []).filter((b) => b && b.excluded !== true);
}

function ballotHasScores(ballot) {
  const scores = ballot && ballot.scores ? Object.values(ballot.scores) : [];
  return scores.some((s) => s && isValidOverall(s.overall));
}

// Standard competition ranking over [{ key, value }] where higher is better
// and null means unranked.
function competitionRanks(entries) {
  const ranked = entries.filter((e) => e.value !== null).sort((a, b) => b.value - a.value);
  const ranks = new Map();
  ranked.forEach((entry, index) => {
    const previous = ranked[index - 1];
    if (previous && previous.value === entry.value) {
      ranks.set(entry.key, ranks.get(previous.key));
    } else {
      ranks.set(entry.key, index + 1);
    }
  });
  return ranks;
}

function topKeys(entries) {
  const valued = entries.filter((e) => e.value !== null && e.value > 0);
  if (valued.length === 0) return [];
  const best = Math.max(...valued.map((e) => e.value));
  return valued.filter((e) => e.value === best).map((e) => e.key);
}

function publicBottle(bottle) {
  const b = bottle || {};
  const out = { name: String(b.name || "Unknown bottle") };
  for (const key of ["distillery", "type", "age", "imageUrl"]) {
    if (typeof b[key] === "string" && b[key]) out[key] = b[key];
  }
  if (typeof b.proof === "number") out.proof = b.proof;
  if (typeof b.price === "number" && b.price > 0) out.price = b.price;
  return out;
}

// A dual ballot's group. Every dual ballot is stamped with one; a missing
// value can only be a blind taster's, so it never inflates the guided side.
function ballotGroup(ballot) {
  return ballot && ballot.group === "guided" ? "guided" : "blind";
}

// One group's independent standings over its own counted ballots.
function groupStats(samples, ballots) {
  const stats = (samples || []).map((sample) => {
    const values = [];
    for (const ballot of ballots) {
      const score = ballot.scores ? ballot.scores[sample.label] : undefined;
      if (score && isValidOverall(score.overall)) values.push(score.overall);
    }
    return {
      label: sample.label,
      average: values.length ? round2(values.reduce((sum, v) => sum + v, 0) / values.length) : null,
      count: values.length,
      favoriteVotes: ballots.filter((b) => b.favoriteLabel === sample.label).length,
    };
  });
  const ranks = competitionRanks(stats.map((s) => ({ key: s.label, value: s.average })));
  const champions = stats.filter((s) => ranks.get(s.label) === 1).map((s) => s.label);
  const peoplesChoice = topKeys(stats.map((s) => ({ key: s.label, value: s.favoriteVotes })));
  return {
    samples: stats.map((s) => ({ ...s, rank: ranks.has(s.label) ? ranks.get(s.label) : null })),
    champions,
    peoplesChoice,
    ballotsCounted: ballots.length,
    ratingsCounted: stats.reduce((sum, s) => sum + s.count, 0),
    unblindedBallots: ballots.filter((b) => b.unblinded === true).length,
  };
}

// Guided vs. blind, per bottle: both averages with their rating counts and
// the gap between them. An observation about two groups' scores, not a
// claim about why they differ.
function groupComparison(samples, groups) {
  const bySample = (samples || []).map((sample) => {
    const guided = groups.guided.samples.find((s) => s.label === sample.label);
    const blind = groups.blind.samples.find((s) => s.label === sample.label);
    const difference =
      guided && blind && guided.average !== null && blind.average !== null ? round2(Math.abs(guided.average - blind.average)) : null;
    return {
      label: sample.label,
      guided: { average: guided ? guided.average : null, count: guided ? guided.count : 0 },
      blind: { average: blind ? blind.average : null, count: blind ? blind.count : 0 },
      difference,
    };
  });
  const gaps = bySample.filter((s) => s.difference !== null && s.difference > 0);
  const biggest = gaps.length ? Math.max(...gaps.map((s) => s.difference)) : null;
  return {
    samples: bySample,
    largestDifference: biggest === null ? [] : gaps.filter((s) => s.difference === biggest).map((s) => s.label),
    largestDifferenceValue: biggest,
    bothEnjoyed: bySample
      .filter((s) => s.guided.average !== null && s.blind.average !== null && s.guided.average >= BOTH_ENJOYED_MIN && s.blind.average >= BOTH_ENJOYED_MIN)
      .map((s) => s.label),
    bothEnjoyedMin: BOTH_ENJOYED_MIN,
    sameWinner:
      groups.guided.champions.length > 0 && groups.guided.champions.some((label) => groups.blind.champions.includes(label)),
  };
}

// samples: [{ label, bottle }] from the host-only secret mapping.
// ballots: every ballot for this category.
// options: { showNicknames, dual }
function computeCategoryResults({ category, samples, ballots, showNicknames, dual = false }) {
  const labels = (samples || []).map((s) => s.label);
  const counted = countedBallots(ballots).filter(ballotHasScores);

  const sampleStats = (samples || []).map((sample) => {
    const values = [];
    for (const ballot of counted) {
      const score = ballot.scores ? ballot.scores[sample.label] : undefined;
      if (score && isValidOverall(score.overall)) values.push(score.overall);
    }
    const average = values.length ? round2(values.reduce((sum, v) => sum + v, 0) / values.length) : null;
    const favoriteVotes = counted.filter((b) => b.favoriteLabel === sample.label).length;
    const predictionVotes = counted.filter((b) => b.predictionLabel === sample.label).length;
    return { label: sample.label, bottle: publicBottle(sample.bottle), average, count: values.length, favoriteVotes, predictionVotes };
  });

  const ranks = competitionRanks(sampleStats.map((s) => ({ key: s.label, value: s.average })));
  const champions = sampleStats.filter((s) => ranks.get(s.label) === 1).map((s) => s.label);
  const peoplesChoice = topKeys(sampleStats.map((s) => ({ key: s.label, value: s.favoriteVotes })));

  const resultSamples = sampleStats
    .map((s) => ({
      label: s.label,
      bottle: s.bottle,
      average: s.average,
      count: s.count,
      rank: ranks.has(s.label) ? ranks.get(s.label) : null,
      favoriteVotes: s.favoriteVotes,
      isChampion: champions.includes(s.label),
      isPeoplesChoice: peoplesChoice.includes(s.label),
    }))
    .sort((a, b) => {
      if (a.rank === null && b.rank === null) return a.label.localeCompare(b.label);
      if (a.rank === null) return 1;
      if (b.rank === null) return -1;
      return a.rank - b.rank || a.label.localeCompare(b.label);
    });

  const awards = [];
  const nameOf = (label) => (sampleStats.find((s) => s.label === label) || {}).bottle?.name || label;
  if (champions.length) {
    awards.push({
      id: "category-champion",
      title: "Category Champion",
      labels: champions,
      detail: champions.length > 1 ? "Tied for the highest average enjoyment." : "Highest average enjoyment in the round.",
    });
  }
  if (peoplesChoice.length) {
    const votes = sampleStats.find((s) => s.label === peoplesChoice[0]).favoriteVotes;
    awards.push({
      id: "peoples-choice",
      title: "People's Choice",
      labels: peoplesChoice,
      detail: `${votes} favorite ${votes === 1 ? "vote" : "votes"}${peoplesChoice.length > 1 ? " each" : ""}.`,
    });
  }

  // Best Value: only when every rated sample has a real price.
  const rated = sampleStats.filter((s) => s.average !== null);
  if (rated.length >= 2 && rated.every((s) => typeof s.bottle.price === "number" && s.bottle.price > 0)) {
    const valueEntries = rated.map((s) => ({ key: s.label, value: round2((s.average / s.bottle.price) * 100) }));
    const best = topKeys(valueEntries);
    if (best.length) {
      awards.push({
        id: "best-value",
        title: "Best Value",
        labels: best,
        detail: "Most enjoyment per dollar, from the prices entered for this round.",
      });
    }
  }

  // Biggest Surprise: the room predicted one sample would win and a
  // different one did. Needs enough actual predictions to mean something.
  const predictionsMade = counted.filter((b) => labels.includes(b.predictionLabel)).length;
  if (predictionsMade >= MIN_PREDICTIONS_FOR_SURPRISE && champions.length === 1) {
    const predicted = topKeys(sampleStats.map((s) => ({ key: s.label, value: s.predictionVotes })));
    const champion = champions[0];
    if (predicted.length && !predicted.includes(champion)) {
      const championPredictions = sampleStats.find((s) => s.label === champion).predictionVotes;
      awards.push({
        id: "biggest-surprise",
        title: "Biggest Surprise",
        labels: [champion],
        detail: `${nameOf(champion)} won, but only ${championPredictions} of ${predictionsMade} predictions picked it.`,
      });
    }
  }

  let tasterIndex = 0;
  const guestScores = counted.map((ballot) => {
    tasterIndex += 1;
    const scores = {};
    for (const label of labels) {
      const score = ballot.scores ? ballot.scores[label] : undefined;
      if (score && isValidOverall(score.overall)) scores[label] = score.overall;
    }
    let name = `Taster ${tasterIndex}`;
    if (showNicknames) {
      if (ballot.nickname) name = ballot.nickname;
      else if (ballot.ballotNumber) name = `Ballot ${ballot.ballotNumber}`;
    }
    return {
      participantKey: ballot.participantKey,
      name,
      source: ballot.source,
      scores,
      favoriteLabel: labels.includes(ballot.favoriteLabel) ? ballot.favoriteLabel : null,
      // Counted exactly like every other ballot; only flagged.
      ...(ballot.unblinded === true ? { unblinded: true } : {}),
      ...(dual ? { group: ballotGroup(ballot) } : {}),
    };
  });

  let dualResults = {};
  if (dual) {
    const groups = {};
    for (const group of GROUPS) groups[group] = groupStats(samples, counted.filter((b) => ballotGroup(b) === group));
    dualResults = { groups, comparison: groupComparison(samples, groups) };
  }

  return {
    categoryId: category.id,
    name: category.name,
    description: category.description || "",
    samples: resultSamples,
    champions,
    peoplesChoice,
    awards,
    ballotsCounted: counted.length,
    // Ballots that may not have been fully blind (a tasting host who set up
    // or viewed the bottle key before finishing). Included, never dropped.
    unblindedBallots: counted.filter((b) => b.unblinded === true).length,
    ratingsCounted: sampleStats.reduce((sum, s) => sum + s.count, 0),
    guestScores,
    ...dualResults,
  };
}

// results: computeCategoryResults outputs for revealed categories only.
function computeRecap({ party, results, notes }) {
  const revealed = (results || []).filter(Boolean);
  const bottles = new Map();
  const champions = [];
  const peoplesChoice = [];
  const participants = new Set();
  let totalBallots = 0;
  const highest = [];

  const groupParticipants = { guided: new Set(), blind: new Set() };
  let dualRounds = 0;
  for (const result of revealed) {
    totalBallots += result.ballotsCounted;
    if (result.groups) dualRounds += 1;
    for (const guest of result.guestScores) {
      participants.add(guest.participantKey);
      if (guest.group && groupParticipants[guest.group]) groupParticipants[guest.group].add(guest.participantKey);
    }
    for (const sample of result.samples) {
      const key = sample.bottle.name.toLowerCase();
      if (!bottles.has(key)) bottles.set(key, sample.bottle);
      if (sample.average !== null) {
        highest.push({ categoryId: result.categoryId, categoryName: result.name, label: sample.label, bottle: sample.bottle, average: sample.average, count: sample.count });
      }
    }
    const championSamples = result.samples.filter((s) => result.champions.includes(s.label));
    champions.push({
      categoryId: result.categoryId,
      categoryName: result.name,
      winners: championSamples.map((s) => ({ label: s.label, bottle: s.bottle, average: s.average, count: s.count })),
    });
    const choiceSamples = result.samples.filter((s) => result.peoplesChoice.includes(s.label));
    peoplesChoice.push({
      categoryId: result.categoryId,
      categoryName: result.name,
      winners: choiceSamples.map((s) => ({ label: s.label, bottle: s.bottle, favoriteVotes: s.favoriteVotes })),
    });
  }

  const best = highest.length ? Math.max(...highest.map((h) => h.average)) : null;
  const highestRated = best === null ? [] : highest.filter((h) => h.average === best);

  return {
    partyName: party.name,
    eventDate: party.eventDate || null,
    categories: revealed.map((r) => ({ categoryId: r.categoryId, name: r.name })),
    bottles: [...bottles.values()],
    champions,
    peoplesChoice,
    highestRated,
    participantCount: participants.size,
    totalBallots,
    ...(dualRounds ? { groupParticipants: { guided: groupParticipants.guided.size, blind: groupParticipants.blind.size } } : {}),
    notes: notes || "",
  };
}

module.exports = {
  BOTH_ENJOYED_MIN,
  MIN_PREDICTIONS_FOR_SURPRISE,
  computeCategoryResults,
  computeRecap,
  competitionRanks,
  isValidOverall,
};
