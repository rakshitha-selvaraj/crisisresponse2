import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Using initializeFirestore with refined settings for better connectivity in restricted environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  host: "firestore.googleapis.com",
  ssl: true,
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth();

// Import shared types for the test connection check
import { OperationType } from '../types';

async function testConnection() {
  const testPath = 'test/connection';
  try {
    // getDocFromServer bypasses the cache and goes directly to the backend
    await getDocFromServer(doc(db, testPath));
    console.log("Firebase Connected Successfully");
  } catch (error) {
    console.warn("Firestore connection check info:", error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('unavailable') || message.includes('offline')) {
      console.error("CRITICAL: Firestore is unavailable. This may cause a blank screen if initial data fetching hangs.");
    }
  }
}

// Run test connection without blocking
testConnection().catch(err => console.error("Firebase connection test failed to even run:", err));
