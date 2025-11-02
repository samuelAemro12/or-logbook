import { auth, db } from './FirebaseConfig';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  DocumentData,
} from 'firebase/firestore';

/**
 * Minimal user profile shape stored in Firestore
 */
export type UserProfile = {
  uid: string;
  email: string;
  role: 'admin' | 'surgeon' | 'nurse' | string;
  status?: string;
  createdAt?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  licenseNumber?: string;
  [key: string]: any;
};

/**
 * Initialize Firebase (idempotent). Returns app-level handles.
 */
export function initFirebase() {
  // FirebaseConfig.ts already initializes the app and exports `auth` and `db`.
  if (!auth || !db) {
    const msg = 'Firebase not configured. Check FirebaseConfig.ts and app.config.js extras.';
    console.error(msg);
    throw new Error(msg);
  }
  console.log('Firebase init OK');
  return { auth, db };
}

function mapAuthError(code: string | undefined, defaultMsg = 'Authentication error') {
  switch (code) {
    case 'auth/invalid-email':
      return 'Invalid email address';
    case 'auth/user-not-found':
      return 'No user found with that email';
    case 'auth/wrong-password':
      return 'Incorrect password';
    case 'auth/invalid-api-key':
      return 'Firebase API key invalid or missing. Check configuration.';
    case 'auth/email-already-in-use':
      return 'This email is already registered';
    case 'auth/weak-password':
      return 'Password is too weak (min 6 characters)';
    default:
      return defaultMsg;
  }
}

/**
 * Sign in with email and password.
 * Returns { uid, email }
 */
export async function signIn(email: string, password: string): Promise<{ uid: string; email: string }>{
  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    const u = userCred.user;
    return { uid: u.uid, email: u.email || email };
  } catch (err: any) {
    const msg = mapAuthError(err?.code, err?.message || 'Sign in failed');
    throw new Error(msg);
  }
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  return firebaseSignOut(auth);
}

/**
 * Create user via backend register endpoint so roles/custom-claims are set server-side.
 * After successful registration we sign the user in using client SDK.
 */
export async function createUser(email: string, password: string, role: string, additional: Record<string, any> = {}) {
  const base = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
  const url = base ? `${base}/api/auth/register` : '/api/auth/register';

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role, ...additional })
  });

  if (!res.ok) {
    const text = await res.text();
    let body: any = text;
    try { body = text ? JSON.parse(text) : text; } catch {}
    throw new Error((body && body.error) ? body.error : `Failed to create user: ${res.status}`);
  }

  const body = await res.json();
  // Optionally sign the user in after creation
  await signIn(email, password);
  return body.data || body;
}

/**
 * Fetch a user document by UID.
 */
export async function fetchUserByUID(uid: string): Promise<UserProfile | null> {
  try {
    const d = await getDoc(doc(db, 'users', uid));
    if (!d.exists()) return null;

    const userData = d.data() as UserProfile;
    const role = userData.role;

    let roleData = null;

    if(role){
      const roleDoc = await getDoc(doc(db, role.toLowerCase() + 's', uid));
      console.log("roleDoc : ", roleDoc.exists());
      if(roleDoc.exists()){
        roleData = roleDoc.data();
    }
  }
  return {
  ...userData,
  ...(roleData || {}),
  uid,
};

} catch (err: any) {
    throw new Error('Failed to fetch user by UID: ' + (err?.message || err));
  }
}

/**
 * Fetch a user by email (returns first match) — useful for admin/debug.
 */
export async function fetchUserByEmail(email: string): Promise<UserProfile | null> {
  try {
    const q = query(collection(db, 'users'), where('email', '==', email));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const docSnap = snap.docs[0];
  return { ...(docSnap.data() as UserProfile), uid: docSnap.id } as UserProfile;
  } catch (err: any) {
    throw new Error('Failed to fetch user by email: ' + (err?.message || err));
  }
}

/**
 * Get simplified current user info from auth state.
 */
export function getCurrentUser(): { uid: string; email?: string } | null {
  const u: FirebaseUser | null = auth.currentUser;
  if (!u) return null;
  return { uid: u.uid, email: u.email || undefined };
}

/**
 * Subscribe to auth state changes. Returns unsubscribe function.
 */
export function onAuthStateChanged(cb: (user: { uid: string; email?: string } | null) => void) {
  return firebaseOnAuthStateChanged(auth, (u) => {
    if (!u) return cb(null);
    cb({ uid: u.uid, email: u.email || undefined });
  });
}
