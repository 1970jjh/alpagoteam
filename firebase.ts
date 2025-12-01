import { initializeApp, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, get, Database } from 'firebase/database';
import { GameState, Member, AccessLog } from './types';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCSKxaIvU3EJYYD4P9rikrn4T3NTM82Zz8",
  authDomain: "collective-intelligence-jjh.firebaseapp.com",
  databaseURL: "https://collective-intelligence-jjh-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "collective-intelligence-jjh",
  storageBucket: "collective-intelligence-jjh.firebasestorage.app",
  messagingSenderId: "940729633848",
  appId: "1:940729633848:web:8bec843c599a5467562acd"
};

// Firebase state
let app: FirebaseApp | null = null;
let database: Database | null = null;
let firebaseInitialized = false;

// Initialize Firebase with error handling
try {
  app = initializeApp(firebaseConfig);
  database = getDatabase(app);
  firebaseInitialized = true;
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Failed to initialize Firebase:', error);
  firebaseInitialized = false;
}

// Check if Firebase is configured and initialized
export const isFirebaseConfigured = (): boolean => {
  return firebaseInitialized && firebaseConfig.apiKey !== "YOUR_API_KEY";
};

// Helper to safely convert data to array
const toArray = <T>(data: any): T[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') return Object.values(data);
  return [];
};

// --- GAMES ---
export const subscribeToGames = (callback: (games: GameState[]) => void) => {
  if (!firebaseInitialized || !database) {
    console.warn('Firebase not initialized, skipping games subscription');
    callback([]); // Still call callback with empty array
    return () => {};
  }

  try {
    const gamesRef = ref(database, 'games');

    return onValue(gamesRef, (snapshot) => {
      try {
        const data = snapshot.val();
        callback(toArray<GameState>(data));
      } catch (e) {
        console.error('Error processing games data:', e);
        callback([]);
      }
    }, (error) => {
      console.error('Error subscribing to games:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error setting up games subscription:', error);
    callback([]);
    return () => {};
  }
};

export const saveGames = async (games: GameState[]) => {
  if (!firebaseInitialized || !database) {
    console.warn('Firebase not initialized, skipping save games');
    return;
  }

  try {
    const gamesRef = ref(database, 'games');
    await set(gamesRef, games || []);
  } catch (error) {
    console.error('Failed to save games to Firebase:', error);
  }
};

export const getGames = async (): Promise<GameState[]> => {
  if (!firebaseInitialized || !database) {
    return [];
  }

  try {
    const gamesRef = ref(database, 'games');
    const snapshot = await get(gamesRef);
    return toArray<GameState>(snapshot.val());
  } catch (error) {
    console.error('Failed to get games from Firebase:', error);
    return [];
  }
};

// --- MEMBERS ---
export const subscribeToMembers = (callback: (members: Member[]) => void) => {
  if (!firebaseInitialized || !database) {
    console.warn('Firebase not initialized, skipping members subscription');
    callback([]);
    return () => {};
  }

  try {
    const membersRef = ref(database, 'members');

    return onValue(membersRef, (snapshot) => {
      try {
        const data = snapshot.val();
        callback(toArray<Member>(data));
      } catch (e) {
        console.error('Error processing members data:', e);
        callback([]);
      }
    }, (error) => {
      console.error('Error subscribing to members:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error setting up members subscription:', error);
    callback([]);
    return () => {};
  }
};

export const saveMembers = async (members: Member[]) => {
  if (!firebaseInitialized || !database) {
    console.warn('Firebase not initialized, skipping save members');
    return;
  }

  try {
    const membersRef = ref(database, 'members');
    await set(membersRef, members || []);
  } catch (error) {
    console.error('Failed to save members to Firebase:', error);
  }
};

export const getMembers = async (): Promise<Member[]> => {
  if (!firebaseInitialized || !database) {
    return [];
  }

  try {
    const membersRef = ref(database, 'members');
    const snapshot = await get(membersRef);
    return toArray<Member>(snapshot.val());
  } catch (error) {
    console.error('Failed to get members from Firebase:', error);
    return [];
  }
};

// --- LOGS ---
export const subscribeToLogs = (callback: (logs: AccessLog[]) => void) => {
  if (!firebaseInitialized || !database) {
    console.warn('Firebase not initialized, skipping logs subscription');
    callback([]);
    return () => {};
  }

  try {
    const logsRef = ref(database, 'logs');

    return onValue(logsRef, (snapshot) => {
      try {
        const data = snapshot.val();
        callback(toArray<AccessLog>(data));
      } catch (e) {
        console.error('Error processing logs data:', e);
        callback([]);
      }
    }, (error) => {
      console.error('Error subscribing to logs:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error setting up logs subscription:', error);
    callback([]);
    return () => {};
  }
};

export const saveLogs = async (logs: AccessLog[]) => {
  if (!firebaseInitialized || !database) {
    console.warn('Firebase not initialized, skipping save logs');
    return;
  }

  try {
    const logsRef = ref(database, 'logs');
    await set(logsRef, logs || []);
  } catch (error) {
    console.error('Failed to save logs to Firebase:', error);
  }
};

export const getLogs = async (): Promise<AccessLog[]> => {
  if (!firebaseInitialized || !database) {
    return [];
  }

  try {
    const logsRef = ref(database, 'logs');
    const snapshot = await get(logsRef);
    return toArray<AccessLog>(snapshot.val());
  } catch (error) {
    console.error('Failed to get logs from Firebase:', error);
    return [];
  }
};

export { database };
