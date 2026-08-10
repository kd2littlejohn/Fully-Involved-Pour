import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { db } from '../../data/firebase'
import { isMockAuthEnabled } from '../../data/devMode'

export function faceoffPairKey(nameA: string, nameB: string): string {
  return [nameA, nameB]
    .map((n) => n.trim().toLowerCase())
    .sort()
    .join('__')
    .replace(/\s+/g, '-')
}

export interface FaceoffTally {
  votesForA: number
  votesForB: number
}

// Dev mode has no real authenticated session to write with, so votes are
// tracked in this in-memory map instead of Firestore — resets on reload,
// but makes the whole cast-then-see-results flow demonstrable without a
// real backend.
const mockVotes = new Map<string, string[]>()

// faceoffVotes/{pairKey_voterUid} — matches the existing Firestore schema
// exactly.
export async function castFaceoffVote(
  uid: string,
  voterUsername: string,
  aName: string,
  bName: string,
  winner: string,
): Promise<void> {
  const pairKey = faceoffPairKey(aName, bName)

  if (isMockAuthEnabled()) {
    mockVotes.set(pairKey, [...(mockVotes.get(pairKey) ?? []), winner])
    return
  }

  await setDoc(doc(db, 'faceoffVotes', `${pairKey}_${uid}`), {
    pairKey,
    aName,
    bName,
    winner,
    voterUid: uid,
    voterUsername,
  })
}

export async function getFaceoffTally(aName: string, bName: string): Promise<FaceoffTally> {
  const pairKey = faceoffPairKey(aName, bName)

  if (isMockAuthEnabled()) {
    const winners = mockVotes.get(pairKey) ?? []
    return {
      votesForA: winners.filter((w) => w === aName).length,
      votesForB: winners.filter((w) => w === bName).length,
    }
  }

  const snapshot = await getDocs(query(collection(db, 'faceoffVotes'), where('pairKey', '==', pairKey)))
  let votesForA = 0
  let votesForB = 0
  for (const voteDoc of snapshot.docs) {
    const winner = voteDoc.data().winner
    if (winner === aName) votesForA += 1
    else if (winner === bName) votesForB += 1
  }
  return { votesForA, votesForB }
}
