import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'

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
export const db = getFirestore(firebaseApp)
export const storage = getStorage(firebaseApp)
export const functions = getFunctions(firebaseApp)
export const googleProvider = new GoogleAuthProvider()
