import type { User } from 'firebase/auth'

// Only uid/displayName/email are read anywhere in the app (checked via grep
// before adding this) — a full firebase-auth User has many more required
// fields/methods we never call, so this narrow shim is cast rather than
// fully implemented. Only ever imported dynamically behind
// isMockAuthEnabled() (see devMode.ts) so it never reaches a production
// bundle. See project memory "react-rebuild-2026-07" for why this exists.
export const MOCK_USER = {
  uid: 'dev-preview-user',
  displayName: 'Dev Preview',
  email: 'dev-preview@example.com',
} as User
