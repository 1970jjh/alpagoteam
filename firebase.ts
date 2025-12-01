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

// Initialize Firebase with error handling
let app: FirebaseApp | null = null;
let database: Database | null = null;
let firebaseInitialized = false;

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

// Database references (only if initialized)
const getGamesRef = () => database ? ref(database, 'games') : null;
const getMembersRef = () => database ? ref(database, 'members') : null;
const getLogsRef = () => database ? ref(database, 'logs') : null;

// --- GAMES ---
export const subscribeToGames = (callback: (games: GameState[]) => void) => {
  const gamesRef = getGamesRef();
  if (!gamesRef) {
    console.warn('Firebase not initialized, skipping games subscription');
    return () => {}; // Return empty unsubscribe function
  }

  return onValue(gamesRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data);
    } else {
      callback([]);
    }
  }, (error) => {
    console.error('Error subscribing to games:', error);
  });
};

export const saveGames = async (games: GameState[]) => {
  const gamesRef = getGamesRef();
  if (!gamesRef) {
    console.warn('Firebase not initialized, skipping save games');
    return;
  }

  try {
    await set(gamesRef, games);
  } catch (error) {
    console.error('Failed to save games to Firebase:', error);
  }
};

export const getGames = async (): Promise<GameState[]> => {
  const gamesRef = getGamesRef();
  if (!gamesRef) {
    return [];
  }

  try {
    const snapshot = await get(gamesRef);
    return snapshot.val() || [];
  } catch (error) {
    console.error('Failed to get games from Firebase:', error);
    return [];
  }
};

// --- MEMBERS ---
export const subscribeToMembers = (callback: (members: Member[]) => void) => {
  const membersRef = getMembersRef();
  if (!membersRef) {
    console.warn('Firebase not initialized, skipping members subscription');
    return () => {};
  }

  return onValue(membersRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data);
    } else {
      callback([]);
    }
  }, (error) => {
    console.error('Error subscribing to members:', error);
  });
};

export const saveMembers = async (members: Member[]) => {
  const membersRef = getMembersRef();
  if (!membersRef) {
    console.warn('Firebase not initialized, skipping save members');
    return;
  }

  try {
    await set(membersRef, members);
  } catch (error) {
    console.error('Failed to save members to Firebase:', error);
  }
};

export const getMembers = async (): Promise<Member[]> => {
  const membersRef = getMembersRef();
  if (!membersRef) {
    return [];
  }

  try {
    const snapshot = await get(membersRef);
    return snapshot.val() || [];
  } catch (error) {
    console.error('Failed to get members from Firebase:', error);
    return [];
  }
};

// --- LOGS ---
export const subscribeToLogs = (callback: (logs: AccessLog[]) => void) => {
  const logsRef = getLogsRef();
  if (!logsRef) {
    console.warn('Firebase not initialized, skipping logs subscription');
    return () => {};
  }

  return onValue(logsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data);
    } else {
      callback([]);
    }
  }, (error) => {
    console.error('Error subscribing to logs:', error);
  });
};

export const saveLogs = async (logs: AccessLog[]) => {
  const logsRef = getLogsRef();
  if (!logsRef) {
    console.warn('Firebase not initialized, skipping save logs');
    return;
  }

  try {
    await set(logsRef, logs);
  } catch (error) {
    console.error('Failed to save logs to Firebase:', error);
  }
};

export const getLogs = async (): Promise<AccessLog[]> => {
  const logsRef = getLogsRef();
  if (!logsRef) {
    return [];
  }

  try {
    const snapshot = await get(logsRef);
    return snapshot.val() || [];
  } catch (error) {
    console.error('Failed to get logs from Firebase:', error);
    return [];
  }
};

export { database };
