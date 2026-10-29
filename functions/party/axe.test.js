// AXE for Party Mode (askSommelier { mode: 'party-insight' }) against the
// Firestore emulator: post-reveal only, members only, the caller's own
// notes but never another guest's. The Anthropic call is stubbed.
// Run via `npm run test:functions` at the repo root (emulators:exec).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test-key";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "fip-functions-test";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");
const { askSommelier, partyAction } = require("../index.js");
const { buildPartyAxePrompt, QUESTIONS } = require("./axe.js");

const db = admin.firestore();
let sent = [];
let n = 0;

const account = (uid) => ({ uid, token: { firebase: { sign_in_provider: "google.com" } } });
const anon = (uid) => ({ uid, token: { firebase: { sign_in_provider: "anonymous" } } });
const act = (auth, action, data = {}) => partyAction.run({ auth, data: { action, ...data }, rawRequest: { ip: `10.77.${n}.1` } });
const ask = (auth, data) => askSommelier.run({ auth, data: { mode: "party-insight", ...data } });

beforeEach(() => {
  sent = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      sent.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ content: [{ text: "Cheers to that." }] }) };
    }),
  );
});

async function revealedParty() {
  n += 1;
  const host = account(`ax-host-${n}`);
  const g1 = anon(`ax-g1-${n}`);
  const g2 = anon(`ax-g2-${n}`);
  const { partyId, joinCode, categories } = await act(host, "createParty", { details: { name: "Axe Night" }, categories: [{ name: "Wheated" }] });
  const categoryId = categories[0].id;
  await act(host, "setSamples", {
    partyId,
    categoryId,
    assignment: "manual",
    samples: [
      { label: "A", bottle: { name: "Weller Antique 107", proof: 107 } },
      { label: "B", bottle: { name: "Larceny Barrel Proof" } },
    ],
  });
  await act(g1, "joinParty", { code: joinCode, nickname: "One" });
  await act(g2, "joinParty", { code: joinCode, nickname: "Two" });
  await act(host, "setCategoryState", { partyId, categoryId, to: "voting_open" });
  await act(g1, "saveBallot", { partyId, categoryId, mode: "detailed", scores: { A: { overall: 9, notes: "my cherry note" } }, favoriteLabel: "A" });
  await act(g2, "saveBallot", { partyId, categoryId, mode: "detailed", scores: { A: { overall: 6, notes: "secret of guest two" } } });
  await act(host, "setCategoryState", { partyId, categoryId, to: "voting_closed" });
  return { host, g1, g2, partyId, categoryId };
}

describe("party AXE", () => {
  it("refuses before reveal and to outsiders", async () => {
    n += 1;
    const host = account(`ax-host-${n}`);
    const { partyId, categories } = await act(host, "createParty", { details: { name: "Early" }, categories: [{ name: "Rye" }] });
    await expect(ask(host, { partyId, categoryId: categories[0].id, question: "room-preference" })).rejects.toMatchObject({ code: "failed-precondition" });
    await expect(ask(anon("ax-outsider"), { partyId, categoryId: categories[0].id, question: "room-preference" })).rejects.toMatchObject({
      code: "permission-denied",
    });
    expect(sent).toHaveLength(0);
  });

  it("uses revealed results and the caller's own ballot, never another guest's notes", async () => {
    const { host, g1, partyId, categoryId } = await revealedParty();
    await expect(ask(g1, { partyId, categoryId, question: "my-palate" })).rejects.toMatchObject({ code: "failed-precondition" });
    await act(host, "setCategoryState", { partyId, categoryId, to: "revealed" });
    const { reply } = await ask(g1, { partyId, categoryId, question: "my-palate" });
    expect(reply).toBe("Cheers to that.");
    const content = JSON.stringify(sent[0]);
    expect(content).toContain("Weller Antique 107");
    expect(content).toContain("my cherry note");
    expect(content).not.toContain("secret of guest two");
    await expect(ask(g1, { partyId, categoryId, question: "write me a poem" })).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("caps anonymous guests more tightly", async () => {
    const { host, g1, partyId, categoryId } = await revealedParty();
    await act(host, "setCategoryState", { partyId, categoryId, to: "revealed" });
    await db.doc(`rateLimits/${g1.uid}_askSommelierParty`).set({ count: 8, windowStart: Date.now() });
    await expect(ask(g1, { partyId, categoryId, question: "try-next" })).rejects.toMatchObject({ code: "resource-exhausted" });
  });

  it("builds a prompt for every preset question", () => {
    const context = {
      party: { name: "P" },
      results: {
        name: "R",
        ballotsCounted: 1,
        samples: [{ label: "A", bottle: { name: "X <b>" }, average: 7, count: 1, favoriteVotes: 0 }],
        // Groups too, so the dual-only comparison question builds as well.
        groups: { guided: { ballotsCounted: 1, champions: ["A"] }, blind: { ballotsCounted: 0, champions: [] } },
        comparison: { samples: [{ label: "A", guided: { average: 7, count: 1 }, blind: { average: null, count: 0 }, difference: null }] },
      },
      myBallot: null,
    };
    for (const id of Object.keys(QUESTIONS)) {
      const { system, prompt } = buildPartyAxePrompt(context, id);
      expect(system).toContain("ONLY");
      expect(prompt).toContain("Sample A: X b");
      expect(prompt).not.toContain("<b>");
    }
  });
});

describe("AXE dual experience comparison", () => {
  const dualResults = {
    name: "Wheated",
    ballotsCounted: 10,
    samples: [
      { label: "A", bottle: { name: "Weller Antique 107", proof: 107 }, average: 8.4, count: 10, favoriteVotes: 5 },
      { label: "B", bottle: { name: "Castle & Key Wheated" }, average: 7.1, count: 10, favoriteVotes: 3 },
    ],
    groups: {
      guided: { ballotsCounted: 7, champions: ["A"] },
      blind: { ballotsCounted: 3, champions: ["B"] },
    },
    comparison: {
      samples: [
        { label: "A", guided: { average: 8.6, count: 7 }, blind: { average: 7.9, count: 3 }, difference: 0.7 },
        { label: "B", guided: { average: 6.9, count: 7 }, blind: { average: 8.1, count: 3 }, difference: 1.2 },
      ],
    },
  };

  it("gives AXE both groups' averages with their rating counts, framed as observations", () => {
    const { system, prompt } = buildPartyAxePrompt({ party: { name: "Dual Night" }, results: dualResults, myBallot: null }, "group-comparison");
    expect(prompt).toContain("GUIDED group knew the bottles while scoring (7 ballots)");
    expect(prompt).toContain("BLIND group saw only sample letters (3 ballots)");
    expect(prompt).toContain("Weller Antique 107: guided 8.6 from 7 ratings; blind 7.9 from 3 ratings; gap 0.7");
    expect(prompt).toContain("Guided top average: Weller Antique 107. Blind top average: Castle & Key Wheated.");
    expect(system).toContain("never as proof that knowing the bottle changed");
    expect(QUESTIONS["group-comparison"]).toContain("never say knowing the bottle caused them");
  });

  it("refuses the comparison for a round without groups", () => {
    const { groups: _g, comparison: _c, ...plain } = dualResults;
    expect(() => buildPartyAxePrompt({ party: { name: "Night" }, results: plain, myBallot: null }, "group-comparison")).toThrow(/guided \+ blind/);
  });
});
