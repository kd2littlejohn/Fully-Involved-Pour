import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../data/firebase'
import { isMockAuthEnabled } from '../../data/devMode'

export function faceoffPairKey(nameA: string, nameB: string): string {
  return [nameA, nameB]
    .map((n) => n.trim().toLowerCase())
    .sort()
    .join('__')
    .replace(/\s+/g, '-')
}

// faceoffVotes/{pairKey_voterUid} — matches the existing Firestore schema
// exactly. In dev mode there's no real authenticated session to write
// with, so the vote is accepted locally without touching Firestore.
export async function castFaceoffVote(
  uid: string,
  voterUsername: string,
  aName: string,
  bName: string,
  winner: string,
): Promise<void> {
  if (isMockAuthEnabled()) return

  const pairKey = faceoffPairKey(aName, bName)
  await setDoc(doc(db, 'faceoffVotes', `${pairKey}_${uid}`), {
    pairKey,
    aName,
    bName,
    winner,
    voterUid: uid,
    voterUsername,
  })
}
