import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

async function testConnection() {
  try {
    // Attempting to fetch a dummy document from the server to verify connectivity
    await getDocFromServer(doc(db, 'system', 'connection_test'));
    console.log("✅ Firebase Connected Successfully");
  } catch (error: any) {
    console.error("❌ Firebase Connection Status:", error.message);
    if (error.code === 'unavailable') {
      console.warn("The Firestore backend is currently unreachable. This usually resolves automatically once the database is fully provisioned or internet connectivity is stable.");
    }
  }
}

// Run connection test on initialization
testConnection();
