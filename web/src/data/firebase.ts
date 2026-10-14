import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore'
import { connectStorageEmulator, getStorage } from 'firebase/storage'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'

// Same project/config as the live app (index.html/app.js) — do not change
// without also updating the production Firebase console settings.
const firebaseConfig = {
  apiKey: 'AIzaSyDJ6BpySxmM7bvZQYmLh0kmkPB18qxt47Q',
  authDomain: 'fully-involved-pour.firebaseapp.com',
  projectId: 'fully-involved-pour',
  storageBucket: 'fully-involved-pour.firebasestorage.app',
  messagingSenderId: '801004541737',
  appId: '1:801004541737:web:f878996b8d7dc333b14938',
}

export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
// Nearly every mutation across the app submits optional fields as literal
// `undefined` when blank (e.g. `distillery: distillery.trim() || undefined`)
// — Firestore rejects that by default. This mirrors the app's actual data
// shape instead of requiring every call site to strip undefined keys.
export const db = initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true })
export const storage = getStorage(firebaseApp)
export const functions = getFunctions(firebaseApp)
export const googleProvider = new GoogleAuthProvider()

// Local end-to-end testing against the Firebase emulators (auth, Firestore,
// Functions, Storage) — opt-in with VITE_FIREBASE_EMULATORS=true on the dev
// server. `import.meta.env.DEV` folds to false in production builds, so
// this can never point a real user's app at localhost.
if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  connectStorageEmulator(storage, '127.0.0.1', 9199)
}
