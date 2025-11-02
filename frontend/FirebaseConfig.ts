import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import Constants from "expo-constants";


const extra = Constants.expoConfig?.extra || {};

const firebaseConfig = {
  apiKey: extra.FIREBASE_API_KEY,
  authDomain: extra.FIREBASE_AUTH_DOMAIN,
  projectId: extra.FIREBASE_PROJECT_ID,
  storageBucket: extra.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: extra.FIREBASE_MESSAGING_SENDER_ID,
  appId: extra.FIREBASE_APP_ID,
  measurementId: extra.FIREBASE_MEASUREMENT_ID,
};

// Debug: show that a key is present (not the value). Throw if missing to fail fast.
if (!firebaseConfig.apiKey) {
  const msg = 'Firebase API key is missing. Ensure .env and app.config.js are configured.';
  console.error(msg);
  throw new Error(msg);
} else {
  console.log('Firebase API key found (length):', String(firebaseConfig.apiKey).length);
}

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Connect to emulators in development (Expo dev client / simulator)
// Note: on Android emulator use 10.0.2.2 instead of 127.0.0.1
// on a physical device use your machine LAN IP (e.g., 192.168.x.y)
const extraEnv = Constants.expoConfig?.extra || {};
const isDev = Boolean(__DEV__);
if (isDev) {
  try {
    const authHost = extraEnv.FIREBASE_AUTH_EMULATOR_HOST || 'http://127.0.0.1:9099';
    const firestoreHost = extraEnv.FIRESTORE_EMULATOR_HOST || '127.0.0.1';
    const firestorePort = Number(extraEnv.FIRESTORE_EMULATOR_PORT) || 8080;

    // connectAuthEmulator expects a full URL including protocol
    connectAuthEmulator(auth, authHost);
    connectFirestoreEmulator(db, firestoreHost, firestorePort);

    // eslint-disable-next-line no-console
    console.log('Firebase emulators connected (auth, firestore)', authHost, `${firestoreHost}:${firestorePort}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Failed to connect Firebase emulators:', (err as any)?.message || err);
  }
}

console.log('Firebase init OK');
