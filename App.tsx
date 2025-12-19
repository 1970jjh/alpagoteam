
import React, { useState, useEffect, useRef } from 'react';
import { GameState, AppContextState, Team, Player, UserSession, Member, AccessLog, GoogleCredentialResponse, GoogleUserPayload, GameMode } from './types';
import { createFullDeck, calculatePlayerScore, checkGameEnd, generateGameId, calculateFinalRanking, generatePlayerId, restoreBoardArray } from './utils';
import { GridBackground, Panel, Input, Button, Footer } from './components/UI';
import { HostView } from './components/HostView';
import { PlayerView } from './components/PlayerView';
import { AdminDashboard } from './components/AdminDashboard';
import { Hexagon, RefreshCw, Building2, Lock, LogIn, UserCog, ShieldCheck, LogOut, Sun, Moon, Trash2, Gamepad2, Dices } from 'lucide-react';
import {
  isFirebaseConfigured,
  subscribeToGames,
  subscribeToMembers,
  subscribeToLogs,
  saveGames,
  saveMembers,
  saveLogs
} from './firebase';

// --- MOCK DATA ---
const createMockGame = (name: string, teamCount: number, started: boolean, ended: boolean, playersPerTeam: number): GameState => {
  const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
    teamNumber: i + 1,
    players: Array.from({ length: playersPerTeam }, (_, j) => ({
      id: `mock_p_${i}_${j}`,
      name: `User ${i}-${j}`,
      joinedAt: new Date().toISOString()
    })),
    board: Array(20).fill(null),
    score: ended ? Math.floor(Math.random() * 100) : 0,
    hasPlacedCurrentNumber: false,
    placedBy: null
  }));

  return {
    companyName: name,
    teamCount: teamCount,
    teams: teams,
    availableNumbers: createFullDeck(),
    usedNumbers: [],
    usedCardIndices: [],
    currentNumber: null,
    gameStarted: started,
    gameEnded: ended,
    waitingForPlacements: false,
    currentRound: ended ? 20 : started ? 5 : 0,
    finalRanking: [],
    creatorId: 'ADMIN', // Default mock creator to ADMIN
    createdAt: new Date().toISOString(),
    gameMode: started ? 'CONTROL' : null,
    version: 1
  };
};

const INITIAL_GAMES: GameState[] = [
  createMockGame("삼성전자", 2, true, false, 3), 
  createMockGame("코카콜라", 2, true, true, 2), 
];

const INITIAL_MEMBERS: Member[] = [
  {
    id: 'mem_1',
    name: '김철수',
    email: 'kim@gmail.com',
    phone: '010-1111-2222',
    registeredAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString(), // 6 months later
    status: 'ACTIVE'
  }
];

const INITIAL_LOGS: AccessLog[] = [
  {
    id: 'log_1',
    timestamp: new Date().toISOString(),
    type: 'REGISTER_MEMBER',
    userId: 'ADMIN',
    userName: '관리자',
    details: '김철수 (kim@gmail.com) 회원 등록'
  }
];

// --- LOCAL STORAGE KEYS ---
const STORAGE_KEYS = {
  GAMES: 'collective_intelligence_games',
  MEMBERS: 'collective_intelligence_members',
  LOGS: 'collective_intelligence_logs',
  SESSION: 'collective_intelligence_session',
};

// --- GOOGLE OAUTH CONFIG ---
// To get your Google OAuth Client ID:
// 1. Go to https://console.cloud.google.com/
// 2. Select your Firebase project (collective-intelligence-jjh)
// 3. Go to "APIs & Services" > "Credentials"
// 4. Create "OAuth 2.0 Client ID" of type "Web application"
// 5. Add authorized JavaScript origins (your app domain)
// 6. Copy the Client ID below
const GOOGLE_CLIENT_ID = '940729633848-ofk2selsnda52g0nhg4h0pb8e4vec1li.apps.googleusercontent.com';

// --- HELPER: Parse JWT Token from Google ---
const parseJwt = (token: string): GoogleUserPayload | null => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to parse JWT:', e);
    return null;
  }
};

// --- HELPER: Check if localStorage is available (lazy evaluation) ---
const isLocalStorageAvailable = (): boolean => {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return false;
    }
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    // Storage is not available (private mode, security restrictions, etc.)
    return false;
  }
};

// --- HELPER: Load from localStorage with fallback ---
const loadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    if (!isLocalStorageAvailable()) return fallback;
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure we return a valid value, not null/undefined
      if (parsed === null || parsed === undefined) {
        return fallback;
      }
      // For arrays, ensure it's actually an array
      if (Array.isArray(fallback) && !Array.isArray(parsed)) {
        return fallback;
      }
      return parsed;
    }
  } catch (e) {
    // Silently fail and return fallback
  }
  return fallback;
};

// --- HELPER: Save to localStorage ---
const saveToStorage = <T,>(key: string, data: T): void => {
  try {
    if (!isLocalStorageAvailable()) return;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    // Silently fail - storage might be full or unavailable
  }
};

const App: React.FC = () => {
  // Check if Firebase is configured
  const useFirebase = isFirebaseConfigured();

  // Global Data State - Initialize with empty arrays for safety
  // Data will be loaded from Firebase or localStorage in useEffect
  const [games, setGames] = useState<GameState[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // SAFETY: Always ensure arrays are valid (never undefined)
  const safeGames = Array.isArray(games) ? games : [];
  const safeMembers = Array.isArray(members) ? members : [];
  const safeLogs = Array.isArray(logs) ? logs : [];

  // Load initial data from localStorage (runs once on mount)
  useEffect(() => {
    try {
      const loadedGames = loadFromStorage(STORAGE_KEYS.GAMES, INITIAL_GAMES);
      const loadedMembers = loadFromStorage(STORAGE_KEYS.MEMBERS, INITIAL_MEMBERS);
      const loadedLogs = loadFromStorage(STORAGE_KEYS.LOGS, INITIAL_LOGS);

      setGames(Array.isArray(loadedGames) ? loadedGames : INITIAL_GAMES);
      setMembers(Array.isArray(loadedMembers) ? loadedMembers : INITIAL_MEMBERS);
      setLogs(Array.isArray(loadedLogs) ? loadedLogs : INITIAL_LOGS);
    } catch (e) {
      console.error('Failed to load from localStorage, using defaults:', e);
      setGames(INITIAL_GAMES);
      setMembers(INITIAL_MEMBERS);
      setLogs(INITIAL_LOGS);
    }
    setIsDataLoaded(true);
  }, []);

  // Track if data is from Firebase (to prevent re-saving)
  const isFirebaseUpdate = useRef(false);

  // Track recent local changes to prevent Firebase from overwriting them
  const lastLocalChangeTime = useRef<number>(0);
  const LOCAL_CHANGE_DEBOUNCE = 2000; // 2 seconds debounce

  // Track if we've received initial Firebase data (prevent overwriting Firebase with mock data)
  const hasReceivedInitialData = useRef(false);

  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserSession>({
    role: 'GUEST',
    id: 'guest',
    name: 'Guest'
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);

  // Login Form State
  const [loginMode, setLoginMode] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // --- GOOGLE OAUTH STATE ---
  const [showGoogleSimulation, setShowGoogleSimulation] = useState(false);
  const [simulatedCandidate, setSimulatedCandidate] = useState<Member | null>(null);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false);

  // Ref to store the latest members for the Google callback
  const membersRef = useRef<Member[]>([]);
  membersRef.current = safeMembers;

  // Game Session State - Load from localStorage if available
  const [session, setSession] = useState<AppContextState & { gameId: string | null }>(() => {
    const savedSession = loadFromStorage(STORAGE_KEYS.SESSION, null);
    if (savedSession && savedSession.gameId) {
      console.log('Restoring session from localStorage:', savedSession);
      return {
        gameId: savedSession.gameId,
        game: null, // Will be populated from games state
        role: savedSession.role || 'NONE',
        myTeamId: savedSession.myTeamId,
        myPlayerId: savedSession.myPlayerId,
        myPlayerName: savedSession.myPlayerName
      };
    }
    return {
      gameId: null,
      game: null,
      role: 'NONE',
      myTeamId: null,
      myPlayerId: null,
      myPlayerName: null
    };
  });

  // Derived State
  const activeGame = safeGames.find(g => generateGameId(g.companyName) === session.gameId) || null;
  const isAuthorized = currentUser.role === 'ADMIN' || currentUser.role === 'MEMBER';

  // --- TAB STATE (DEFAULT: JOIN) ---
  const [activeTab, setActiveTab] = useState<'CREATE' | 'JOIN'>('JOIN');
  const [createFormName, setCreateFormName] = useState("삼성전자 AI팀");
  const [createFormTeams, setCreateFormTeams] = useState("2");
  const [createFormMode, setCreateFormMode] = useState<GameMode>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [joinName, setJoinName] = useState("");
  const [joinTeamIdx, setJoinTeamIdx] = useState(0);

  // --- THEME EFFECT ---
  useEffect(() => {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // --- GOOGLE SIGN-IN INITIALIZATION ---
  useEffect(() => {
    // Wait for Google Identity Services script to load
    const initGoogleSignIn = () => {
      if (!window.google?.accounts?.id) {
        console.log('Google Sign-In not yet loaded, retrying...');
        setTimeout(initGoogleSignIn, 500);
        return;
      }

      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        setIsGoogleLoaded(true);
        console.log('Google Sign-In initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Google Sign-In:', error);
        setGoogleError('Google 로그인 초기화에 실패했습니다.');
      }
    };

    initGoogleSignIn();
  }, []);

  // --- GOOGLE CREDENTIAL CALLBACK HANDLER ---
  const handleGoogleCredentialResponse = (response: GoogleCredentialResponse) => {
    setIsGoogleLoggingIn(false);

    if (!response.credential) {
      setGoogleError('Google 인증 정보를 받지 못했습니다.');
      return;
    }

    // Parse the JWT token to get user info
    const payload = parseJwt(response.credential);
    if (!payload) {
      setGoogleError('Google 인증 정보를 파싱할 수 없습니다.');
      return;
    }

    const googleEmail = payload.email.toLowerCase();

    // Debug: Log current members for troubleshooting
    console.log('=== Google Login Debug ===');
    console.log('Google Email:', googleEmail);
    console.log('Current members in ref:', membersRef.current);
    console.log('Members count:', membersRef.current.length);
    console.log('Member emails:', membersRef.current.map(m => m.email.toLowerCase()));

    // Check if this Google email is registered in our system
    const registeredMember = membersRef.current.find(
      m => m.email.toLowerCase() === googleEmail
    );

    console.log('Found member:', registeredMember);

    if (!registeredMember) {
      alert('등록되지 않은 이메일입니다.\n\n관리자에게 회원 등록을 요청해주세요.\n\nGoogle 계정 이메일: ' + payload.email + '\n\n[디버그] 현재 등록된 회원 수: ' + membersRef.current.length);
      setShowLoginModal(true);
      return;
    }

    // Check if the pre-entered email matches (if user entered one)
    if (loginEmail.trim() && loginEmail.trim().toLowerCase() !== googleEmail) {
      alert('입력하신 이메일과 Google 계정 이메일이 일치하지 않습니다.\n\n입력한 이메일: ' + loginEmail + '\nGoogle 계정: ' + payload.email);
      setShowLoginModal(true);
      return;
    }

    // Email matches a registered member - proceed with login
    console.log('Google login successful, verified email:', googleEmail);
    completeMemberLogin(googleEmail);
    setShowLoginModal(false);
    setLoginEmail('');
  };

  // --- TRIGGER GOOGLE SIGN-IN POPUP ---
  const triggerGoogleSignIn = () => {
    if (!isGoogleLoaded || !window.google?.accounts?.id) {
      alert('Google 로그인이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setGoogleError(null);
    setIsGoogleLoggingIn(true);

    // Prompt Google Sign-In One Tap or popup
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed()) {
        const reason = notification.getNotDisplayedReason();
        console.log('Google Sign-In not displayed:', reason);

        // If One Tap is blocked, try rendering a button instead
        if (reason === 'opt_out_or_no_session' || reason === 'suppressed_by_user') {
          setGoogleError('Google One Tap이 차단되었습니다. 팝업 차단을 해제해주세요.');
        } else if (reason === 'browser_not_supported') {
          setGoogleError('이 브라우저에서는 Google 로그인을 지원하지 않습니다.');
        } else {
          // Fallback to simulated mode for testing
          handleFallbackLogin();
        }
        setIsGoogleLoggingIn(false);
      } else if (notification.isSkippedMoment()) {
        console.log('Google Sign-In skipped:', notification.getSkippedReason());
        setIsGoogleLoggingIn(false);
      } else if (notification.isDismissedMoment()) {
        console.log('Google Sign-In dismissed:', notification.getDismissedReason());
        setIsGoogleLoggingIn(false);
      }
    });
  };

  // --- FALLBACK LOGIN (for environments where Google One Tap doesn't work) ---
  const handleFallbackLogin = () => {
    if (!loginEmail.trim()) {
      alert('구글 이메일 주소를 입력해주세요.');
      return;
    }

    // Check if email is registered
    const checkMember = safeMembers.find(m => m.email.toLowerCase() === loginEmail.trim().toLowerCase());
    if (!checkMember) {
      alert('등록되지 않은 이메일입니다. 관리자에게 문의하여 회원 등록을 진행해주세요.');
      return;
    }

    // Show simulation modal as fallback
    setSimulatedCandidate(checkMember);
    setShowGoogleSimulation(true);
  };

  // --- SESSION PERSISTENCE ---
  // Save session to localStorage when it changes
  useEffect(() => {
    if (session.gameId) {
      // Save session (excluding 'game' object which is derived from games state)
      const sessionToSave = {
        gameId: session.gameId,
        role: session.role,
        myTeamId: session.myTeamId,
        myPlayerId: session.myPlayerId,
        myPlayerName: session.myPlayerName
      };
      saveToStorage(STORAGE_KEYS.SESSION, sessionToSave);
    } else {
      // Clear session from storage when user exits game
      saveToStorage(STORAGE_KEYS.SESSION, null);
    }
  }, [session.gameId, session.role, session.myTeamId, session.myPlayerId, session.myPlayerName]);

  // Validate restored session - clear if game no longer exists
  useEffect(() => {
    if (session.gameId && isDataLoaded && safeGames.length > 0) {
      const gameExists = safeGames.some(g => generateGameId(g.companyName) === session.gameId);
      if (!gameExists) {
        console.log('Saved game no longer exists, clearing session');
        setSession({
          gameId: null,
          game: null,
          role: 'NONE',
          myTeamId: null,
          myPlayerId: null,
          myPlayerName: null
        });
      }
    }
  }, [session.gameId, isDataLoaded, safeGames]);

  // --- FIREBASE REAL-TIME SYNC (for cross-device sync) ---
  useEffect(() => {
    if (!useFirebase) return;

    console.log('Firebase is configured. Setting up real-time sync...');

    // Subscribe to games
    const unsubscribeGames = subscribeToGames((newGames) => {
      // Mark that we've received initial data from Firebase
      hasReceivedInitialData.current = true;

      // Skip if there was a recent local change (prevent race condition)
      const timeSinceLocalChange = Date.now() - lastLocalChangeTime.current;
      if (timeSinceLocalChange < LOCAL_CHANGE_DEBOUNCE) {
        console.log('Skipping Firebase update due to recent local change');
        return;
      }

      // Accept Firebase data (even empty arrays - don't keep mock data)
      // Safety check: ensure newGames is an array
      const firebaseGames = Array.isArray(newGames) ? newGames : [];
      isFirebaseUpdate.current = true;

      // Smart merge: preserve local board data if it has more filled cells
      // AND preserve locally created games that haven't synced to Firebase yet
      setGames(prevGames => {
        const safePrevGames = Array.isArray(prevGames) ? prevGames : [];

        // Start with Firebase games, merged with local data
        const mergedGames = firebaseGames.map(firebaseGame => {
          const localGame = safePrevGames.find(g => g.companyName === firebaseGame.companyName);
          if (!localGame) return firebaseGame;

          // Merge teams: keep the board with more filled cells
          const localTeams = Array.isArray(localGame.teams) ? localGame.teams : [];
          const firebaseTeams = Array.isArray(firebaseGame.teams) ? firebaseGame.teams : [];

          const mergedTeams = firebaseTeams.map((fbTeam, idx) => {
            const localTeam = localTeams[idx];
            if (!localTeam) return fbTeam;

            const localBoard = restoreBoardArray(localTeam.board);
            const fbBoard = restoreBoardArray(fbTeam.board);

            const localFilledCount = localBoard.filter(c => c !== null).length;
            const fbFilledCount = fbBoard.filter(c => c !== null).length;

            // CRITICAL: Check if currentRound changed (new number was issued)
            // If Firebase has a higher round, we must use Firebase's hasPlacedCurrentNumber (which is false for new round)
            const firebaseRound = firebaseGame.currentRound || 0;
            const localRound = localGame.currentRound || 0;
            const isNewRound = firebaseRound > localRound;

            // For hasPlacedCurrentNumber:
            // - If new round started (Firebase has higher round), use Firebase's value (false)
            // - If same round, preserve true if either has it (to handle simultaneous placements)
            const mergedHasPlaced = isNewRound
              ? fbTeam.hasPlacedCurrentNumber === true
              : (localTeam.hasPlacedCurrentNumber === true || fbTeam.hasPlacedCurrentNumber === true);
            const mergedPlacedBy = mergedHasPlaced ? (fbTeam.placedBy || localTeam.placedBy) : null;

            // Keep local board if it has more data (more recent placement)
            if (localFilledCount > fbFilledCount) {
              console.log(`Preserving local board for team ${fbTeam.teamNumber}: ${localFilledCount} > ${fbFilledCount}`);
              return {
                ...fbTeam,
                board: localBoard,
                score: localTeam.score,
                hasPlacedCurrentNumber: mergedHasPlaced,
                placedBy: mergedPlacedBy
              };
            }

            // Even if Firebase board has more/equal data, still preserve hasPlacedCurrentNumber
            return {
              ...fbTeam,
              hasPlacedCurrentNumber: mergedHasPlaced,
              placedBy: mergedPlacedBy
            };
          });

          // Recalculate waitingForPlacements based on merged team states
          const activeTeamsList = mergedTeams.filter(t => (Array.isArray(t.players) ? t.players : []).length > 0);
          const allPlaced = activeTeamsList.every(t => t.hasPlacedCurrentNumber === true);
          const recalculatedWaiting = firebaseGame.waitingForPlacements === true && !allPlaced;

          return {
            ...firebaseGame,
            teams: mergedTeams,
            // If all teams have placed but Firebase still shows waiting, update it
            waitingForPlacements: allPlaced ? false : firebaseGame.waitingForPlacements
          };
        });

        // Add locally created games that don't exist in Firebase yet
        // These are games created within the last 10 seconds (to allow for sync delay)
        const localOnlyGames = safePrevGames.filter(localGame => {
          const existsInFirebase = firebaseGames.some(fbGame => fbGame.companyName === localGame.companyName);
          if (existsInFirebase) return false;

          // Check if this game was created recently (within 10 seconds)
          const createdAt = new Date(localGame.createdAt).getTime();
          const now = Date.now();
          const isRecentlyCreated = (now - createdAt) < 10000; // 10 seconds

          if (isRecentlyCreated) {
            console.log(`Preserving locally created game: ${localGame.companyName}`);
          }
          return isRecentlyCreated;
        });

        return [...localOnlyGames, ...mergedGames];
      });

      // Also save to localStorage as cache
      saveToStorage(STORAGE_KEYS.GAMES, firebaseGames);
    });

    // Subscribe to members
    const unsubscribeMembers = subscribeToMembers((newMembers) => {
      // Safety check: ensure newMembers is an array
      const safeMembers = Array.isArray(newMembers) ? newMembers : [];
      isFirebaseUpdate.current = true;
      setMembers(safeMembers.length > 0 ? safeMembers : INITIAL_MEMBERS);
      saveToStorage(STORAGE_KEYS.MEMBERS, safeMembers.length > 0 ? safeMembers : INITIAL_MEMBERS);
    });

    // Subscribe to logs
    const unsubscribeLogs = subscribeToLogs((newLogs) => {
      // Safety check: ensure newLogs is an array
      const safeLogs = Array.isArray(newLogs) ? newLogs : [];
      isFirebaseUpdate.current = true;
      setLogs(safeLogs.length > 0 ? safeLogs : INITIAL_LOGS);
      saveToStorage(STORAGE_KEYS.LOGS, safeLogs.length > 0 ? safeLogs : INITIAL_LOGS);
    });

    return () => {
      unsubscribeGames();
      unsubscribeMembers();
      unsubscribeLogs();
    };
  }, [useFirebase]);

  // --- SYNC STATE TO STORAGE (localStorage + Firebase) ---
  useEffect(() => {
    // Always save to localStorage
    saveToStorage(STORAGE_KEYS.GAMES, games);

    // Only save to Firebase if:
    // 1. Firebase is configured
    // 2. This is NOT from a Firebase update
    // 3. We've already received initial data from Firebase (prevent overwriting with mock data)
    if (useFirebase && !isFirebaseUpdate.current && hasReceivedInitialData.current) {
      // Mark that we're making a local change
      lastLocalChangeTime.current = Date.now();
      saveGames(games);
    }
    isFirebaseUpdate.current = false;
  }, [games, useFirebase]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MEMBERS, members);
    if (useFirebase && !isFirebaseUpdate.current) {
      saveMembers(members);
    }
    isFirebaseUpdate.current = false;
  }, [members, useFirebase]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.LOGS, logs);
    if (useFirebase && !isFirebaseUpdate.current) {
      saveLogs(logs);
    }
    isFirebaseUpdate.current = false;
  }, [logs, useFirebase]);

  // --- CROSS-TAB SYNC: Listen for storage changes from other tabs (fallback when Firebase not configured) ---
  useEffect(() => {
    if (useFirebase) return; // Skip if using Firebase

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.GAMES && e.newValue) {
        try {
          const newGames = JSON.parse(e.newValue);
          setGames(newGames);
        } catch (err) {
          console.error('Failed to parse games from storage event:', err);
        }
      }
      if (e.key === STORAGE_KEYS.MEMBERS && e.newValue) {
        try {
          const newMembers = JSON.parse(e.newValue);
          setMembers(newMembers);
        } catch (err) {
          console.error('Failed to parse members from storage event:', err);
        }
      }
      if (e.key === STORAGE_KEYS.LOGS && e.newValue) {
        try {
          const newLogs = JSON.parse(e.newValue);
          setLogs(newLogs);
        } catch (err) {
          console.error('Failed to parse logs from storage event:', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [useFirebase]);

  // --- PERIODIC SYNC: Refresh from localStorage (fallback when Firebase not configured) ---
  useEffect(() => {
    if (useFirebase) return; // Skip if using Firebase

    const syncInterval = setInterval(() => {
      const storedGames = loadFromStorage(STORAGE_KEYS.GAMES, null);
      if (storedGames && JSON.stringify(storedGames) !== JSON.stringify(games)) {
        setGames(storedGames);
      }
    }, 2000);

    return () => clearInterval(syncInterval);
  }, [games, useFirebase]);

  // --- SECURITY EFFECT: Kick out deleted/suspended members ---
  useEffect(() => {
    if (currentUser.role === 'MEMBER') {
      const currentMember = safeMembers.find(m => m.id === currentUser.id);
      
      // If member is not found in the list (Deleted) OR status is suspended
      if (!currentMember) {
        alert("회원 정보가 존재하지 않거나 삭제되어 자동으로 로그아웃됩니다.");
        handleLogout();
      } else if (currentMember.status === 'SUSPENDED') {
        alert("계정이 정지되어 자동으로 로그아웃됩니다.");
        handleLogout();
      }
    }
  }, [members, currentUser]);

  const completeMemberLogin = (email: string) => {
      const member = safeMembers.find(m => m.email.toLowerCase() === email.toLowerCase());
      if (!member) {
        alert('등록되지 않은 이메일입니다. 관리자에게 문의하여 회원 등록을 진행해주세요.');
        return;
      }

      // Check Expiration
      if (new Date() > new Date(member.expiresAt)) {
        alert('회원 자격이 만료되었습니다. 관리자에게 문의하여 연장해주세요.');
        return;
      }
      
      // Check Status
      if (member.status === 'SUSPENDED') {
          alert('일시 정지된 계정입니다. 관리자에게 문의해주세요.');
          return;
      }

      const memberUser: UserSession = {
        role: 'MEMBER',
        id: member.id,
        name: member.name, // Use registered name
        email: member.email,
        loginAt: new Date().toISOString()
      };
      setCurrentUser(memberUser);

      addLog('LOGIN', '회원 접속 (Google Verified)');

      setShowLoginModal(false);
      setShowGoogleSimulation(false);
      setLoginEmail('');
  };

  // --- AUTOMATIC GAME CLEANUP & EXPIRATION ---
  useEffect(() => {
    const checkGames = () => {
      const now = new Date();
      setGames(prevGames => {
        const safePrevGames = Array.isArray(prevGames) ? prevGames : [];
        return safePrevGames
          .map(game => {
            const createdAt = new Date(game.createdAt);
            const diffMs = now.getTime() - createdAt.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            // Auto End after 24 hours
            if (diffHours >= 24 && !game.gameEnded) {
               return { ...game, gameEnded: true };
            }
            return game;
          })
          .filter(game => {
             // Auto Delete after 7 days (168 hours)
             const createdAt = new Date(game.createdAt);
             const diffMs = now.getTime() - createdAt.getTime();
             const diffHours = diffMs / (1000 * 60 * 60);
             return diffHours < 168;
          });
      });
    };

    const interval = setInterval(checkGames, 60000); // Check every minute
    checkGames(); // Run on mount

    return () => clearInterval(interval);
  }, []);

  // --- LOGGING HELPER ---
  const addLog = (
      type: AccessLog['type'], 
      details: string, 
      extra?: { durationMinutes?: number; relatedGameName?: string }
    ) => {
    const newLog: AccessLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type,
      userId: currentUser.id,
      userName: currentUser.name,
      details,
      ...extra
    };
    setLogs(prev => [...prev, newLog]);
  };

  // --- AUTHENTICATION HANDLERS ---
  const handleLogin = () => {
    if (loginMode === 'ADMIN') {
      if (loginPassword === '6749467') {
        const adminUser: UserSession = {
            role: 'ADMIN',
            id: 'ADMIN',
            name: '관리자',
            loginAt: new Date().toISOString()
        };
        setCurrentUser(adminUser);
        addLog('LOGIN', '관리자 접속');
        setShowLoginModal(false);
        setLoginPassword('');
      } else {
        alert('비밀번호가 올바르지 않습니다.');
      }
    } else {
      // Member Login Logic - Use Real Google OAuth
      // Pre-check email if entered (optional)
      if (loginEmail.trim()) {
        const checkMember = safeMembers.find(m => m.email.toLowerCase() === loginEmail.trim().toLowerCase());
        if (!checkMember) {
          alert('등록되지 않은 이메일입니다. 관리자에게 문의하여 회원 등록을 진행해주세요.');
          return;
        }
      }

      // Trigger Google Sign-In
      triggerGoogleSignIn();
    }
  };

  const handleLogout = () => {
    if (currentUser.loginAt) {
        const start = new Date(currentUser.loginAt);
        const end = new Date();
        const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // Minutes
        
        if (currentUser.role !== 'GUEST') { // Only log if not already guest
            addLog('LOGOUT', '사용자 로그아웃', { durationMinutes: duration });
        }
    }

    setCurrentUser({ role: 'GUEST', id: 'guest', name: 'Guest' });
    setSession({ gameId: null, game: null, role: 'NONE', myTeamId: null, myPlayerId: null, myPlayerName: null });
  };

  // --- ADMIN ACTIONS ---
  const registerMember = (name: string, email: string, phone: string) => {
    const newMember: Member = {
      id: `mem_${Date.now()}`,
      name,
      email,
      phone,
      registeredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24 * 30 * 6)).toISOString(), // 6 Months
      status: 'ACTIVE'
    };
    setMembers(prev => [...prev, newMember]);
    addLog('REGISTER_MEMBER', `${name} (${email}) 회원 등록`);
  };

  const deleteMember = (id: string) => {
      const target = safeMembers.find(m => m.id === id);
      if (!target) return;

      // Directly remove from state. This triggers the useEffect in App to kick the user out if they are logged in.
      setMembers(prev => prev.filter(m => m.id !== id));
      addLog('MEMBER_ACTION', `회원 삭제: ${target.name} (${target.email})`);
  };

  const extendMember = (id: string) => {
      const target = safeMembers.find(m => m.id === id);
      if (!target) return;

      const currentExpiry = new Date(target.expiresAt);
      const newExpiry = new Date(currentExpiry.setMonth(currentExpiry.getMonth() + 6)).toISOString();

      setMembers(prev => prev.map(m => m.id === id ? { ...m, expiresAt: newExpiry } : m));
      addLog('MEMBER_ACTION', `기간 연장 (+6개월): ${target.name}`);
  };

  const renewMember = (id: string) => {
      const target = safeMembers.find(m => m.id === id);
      if (!target) return;

      const newExpiry = new Date(Date.now() + (1000 * 60 * 60 * 24 * 30 * 6)).toISOString();

      setMembers(prev => prev.map(m => m.id === id ? { ...m, expiresAt: newExpiry } : m));
      addLog('MEMBER_ACTION', `기간 재설정 (오늘부터 6개월): ${target.name}`);
  };

  // Admin-only: Delete a game room completely
  const deleteGame = (gameId: string) => {
    if (currentUser.role !== 'ADMIN') {
      alert('게임 삭제는 관리자만 가능합니다.');
      return;
    }

    const targetGame = safeGames.find(g => generateGameId(g.companyName) === gameId);
    if (!targetGame) return;

    if (!confirm(`"${targetGame.companyName}" 게임을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setGames(prev => prev.filter(g => generateGameId(g.companyName) !== gameId));
    addLog('DELETE_GAME', `게임 삭제: ${targetGame.companyName}`, { relatedGameName: targetGame.companyName });
  };

  // --- GAME LOGIC ---
  useEffect(() => {
    if (activeGame && session.role !== 'NONE') {
       setSession(prev => {
         if (prev.game === activeGame) return prev;
         return { ...prev, game: activeGame };
       });
    }
  }, [games, activeGame, session.role]);

  const createCompanyGame = (companyName: string, teamCountStr: string, mode: GameMode) => {
    if (!isAuthorized) {
        alert("게임 생성 권한이 없습니다.");
        return;
    }

    if (!mode) {
      alert("게임 모드를 선택해주세요. (컨트롤 또는 숫자판)");
      return;
    }

    const teamCount = parseInt(teamCountStr);
    if (!companyName || isNaN(teamCount) || teamCount < 1) {
      alert("회사명과 최소 1개 이상의 팀을 입력해주세요.");
      return;
    }

    const gameId = generateGameId(companyName);
    if (safeGames.some(g => generateGameId(g.companyName) === gameId)) {
      alert("이미 존재하는 회사명입니다.");
      return;
    }

    const newGame: GameState = {
      companyName: companyName,
      teamCount: teamCount,
      teams: Array.from({ length: teamCount }, (_, i) => ({
        teamNumber: i + 1,
        players: [],
        board: Array(20).fill(null),
        score: 0,
        hasPlacedCurrentNumber: false,
        placedBy: null
      })),
      availableNumbers: createFullDeck(),
      usedNumbers: [],
      usedCardIndices: [],
      currentNumber: null,
      gameStarted: false,
      gameEnded: false,
      waitingForPlacements: false,
      currentRound: 0,
      finalRanking: [],
      creatorId: currentUser.id,
      createdAt: new Date().toISOString(),
      gameMode: mode,
      randomBoardNumbers: mode === 'RANDOM_BOARD' ? generateRandomBoardNumbers() : undefined,
      revealedCells: [],
      pendingRandomNumber: null,
      version: 1
    };

    setGames(prev => [newGame, ...prev]);
    const modeLabel = mode === 'CONTROL' ? '컨트롤' : '숫자판';
    addLog('CREATE_GAME', `${companyName} 게임 생성 (${teamCount}개 팀, ${modeLabel} 모드)`, { relatedGameName: companyName });
    
    setSession({
      gameId: gameId,
      game: newGame,
      role: 'HOST',
      myTeamId: null,
      myPlayerId: null,
      myPlayerName: null
    });
  };

  const joinTeam = (gameId: string, teamNumberIdx: number, playerName: string) => {
    const gameIndex = safeGames.findIndex(g => generateGameId(g.companyName) === gameId);
    if (gameIndex === -1) return;

    if (!playerName.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    const game = safeGames[gameIndex];
    const safeTeams = Array.isArray(game.teams) ? game.teams : [];
    const team = safeTeams[teamNumberIdx];
    if (!team) return;

    const teamPlayers = Array.isArray(team.players) ? team.players : [];
    if (teamPlayers.length >= 10) {
      alert("이 팀은 정원이 초과되었습니다.");
      return;
    }
    if (teamPlayers.some(p => p.name === playerName)) {
      alert("이미 이 팀에 존재하는 이름입니다.");
      return;
    }

    const playerId = generatePlayerId();
    const newPlayer: Player = {
      id: playerId,
      name: playerName,
      joinedAt: new Date().toISOString()
    };

    const newTeams = safeTeams.map((t, idx) =>
      idx === teamNumberIdx
        ? { ...t, players: [...(Array.isArray(t.players) ? t.players : []), newPlayer] }
        : t
    );

    const newGame = { ...game, teams: newTeams };
    const newGamesList = [...safeGames];
    newGamesList[gameIndex] = newGame;
    setGames(newGamesList);

    setSession({
      gameId: gameId,
      game: newGame,
      role: 'PLAYER',
      myTeamId: teamNumberIdx + 1,
      myPlayerId: playerId,
      myPlayerName: playerName
    });
  };

  // Generate shuffled numbers for RANDOM_BOARD mode
  const generateRandomBoardNumbers = (): (number | string)[] => {
    const numbers: (number | string)[] = [];
    for (let i = 1; i <= 10; i++) numbers.push(i);
    for (let i = 11; i <= 19; i++) numbers.push(i);
    for (let i = 11; i <= 19; i++) numbers.push(i);
    for (let i = 20; i <= 30; i++) numbers.push(i);
    numbers.push('★');
    // Shuffle
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    return numbers;
  };

  const startCompanyGame = (mode: GameMode) => {
    if (!activeGame) return;
    if (!mode) {
      alert("게임 모드를 선택해주세요. (컨트롤 또는 숫자판)");
      return;
    }
    const gameTeams = Array.isArray(activeGame.teams) ? activeGame.teams : [];
    const activeTeams = gameTeams.filter(t => (Array.isArray(t.players) ? t.players : []).length > 0);
    if (activeTeams.length < 1) {
      alert("최소 1팀 이상 참가해야 합니다.");
      return;
    }

    const updates: Partial<GameState> = {
      gameStarted: true,
      currentRound: 0,
      currentNumber: null,
      gameMode: mode,
      version: (activeGame.version || 0) + 1
    };

    // For RANDOM_BOARD mode, generate shuffled numbers
    if (mode === 'RANDOM_BOARD') {
      updates.randomBoardNumbers = generateRandomBoardNumbers();
      updates.revealedCells = [];
      updates.pendingRandomNumber = null;
    }

    updateGame(activeGame.companyName, updates);
  };

  const selectNumberByHost = (num: number | string, cardIndex: number) => {
    if (!activeGame) return;
    if (activeGame.waitingForPlacements) {
      alert("모든 팀이 숫자를 배치할 때까지 기다려주세요.");
      return;
    }
    const gameTeams = Array.isArray(activeGame.teams) ? activeGame.teams : [];
    const newUsedCardIndices = [...(Array.isArray(activeGame.usedCardIndices) ? activeGame.usedCardIndices : []), cardIndex];
    const newAvailable = [...(Array.isArray(activeGame.availableNumbers) ? activeGame.availableNumbers : [])];
    const newTeams = gameTeams.map(t => ({ ...t, hasPlacedCurrentNumber: false, placedBy: null }));

    updateGame(activeGame.companyName, {
      currentNumber: num,
      usedNumbers: [...(Array.isArray(activeGame.usedNumbers) ? activeGame.usedNumbers : []), num],
      usedCardIndices: newUsedCardIndices,
      availableNumbers: newAvailable,
      waitingForPlacements: true,
      currentRound: activeGame.currentRound + 1,
      teams: newTeams,
      version: (activeGame.version || 0) + 1
    });
  };

  // For RANDOM_BOARD mode: select a cell (set as pending)
  const selectRandomCell = (cellLabel: string, value: number | string) => {
    if (!activeGame) return;
    if (activeGame.waitingForPlacements) {
      alert("모든 팀이 숫자를 배치할 때까지 기다려주세요.");
      return;
    }

    const revealedCells = Array.isArray(activeGame.revealedCells) ? activeGame.revealedCells : [];
    if (revealedCells.includes(cellLabel)) {
      alert("이미 출제된 셀입니다.");
      return;
    }

    updateGame(activeGame.companyName, {
      pendingRandomNumber: { value, cellLabel },
      version: (activeGame.version || 0) + 1
    });
  };

  // For RANDOM_BOARD mode: submit the pending number
  const submitRandomNumber = () => {
    if (!activeGame) return;
    if (!activeGame.pendingRandomNumber) {
      alert("출제할 숫자를 먼저 선택해주세요.");
      return;
    }
    if (activeGame.waitingForPlacements) {
      alert("모든 팀이 숫자를 배치할 때까지 기다려주세요.");
      return;
    }

    const { value, cellLabel } = activeGame.pendingRandomNumber;
    const gameTeams = Array.isArray(activeGame.teams) ? activeGame.teams : [];
    const revealedCells = Array.isArray(activeGame.revealedCells) ? activeGame.revealedCells : [];
    const newTeams = gameTeams.map(t => ({ ...t, hasPlacedCurrentNumber: false, placedBy: null }));

    updateGame(activeGame.companyName, {
      currentNumber: value,
      usedNumbers: [...(Array.isArray(activeGame.usedNumbers) ? activeGame.usedNumbers : []), value],
      revealedCells: [...revealedCells, cellLabel],
      pendingRandomNumber: null,
      waitingForPlacements: true,
      currentRound: activeGame.currentRound + 1,
      teams: newTeams,
      version: (activeGame.version || 0) + 1
    });
  };

  // For RANDOM_BOARD mode: random reveal
  const randomRevealCell = () => {
    if (!activeGame) return;
    if (activeGame.waitingForPlacements) {
      alert("모든 팀이 숫자를 배치할 때까지 기다려주세요.");
      return;
    }

    const revealedCells = Array.isArray(activeGame.revealedCells) ? activeGame.revealedCells : [];
    const randomBoardNumbers = Array.isArray(activeGame.randomBoardNumbers) ? activeGame.randomBoardNumbers : [];

    // Generate grid labels
    const gridLabels: string[] = [];
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    for (const row of rows) {
      for (let col = 1; col <= 5; col++) {
        gridLabels.push(`${row}${col}`);
      }
    }

    const unrevealed = gridLabels.filter(label => !revealedCells.includes(label));
    if (unrevealed.length === 0) {
      alert("모든 숫자가 이미 출제되었습니다.");
      return;
    }

    const randomLabel = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    const index = gridLabels.indexOf(randomLabel);
    const value = randomBoardNumbers[index];

    updateGame(activeGame.companyName, {
      pendingRandomNumber: { value, cellLabel: randomLabel },
      version: (activeGame.version || 0) + 1
    });
  };

  const placeNumberInTeam = (position: number) => {
    if (!activeGame || !session.myTeamId || !session.myPlayerId) return;
    const gameTeams = Array.isArray(activeGame.teams) ? activeGame.teams : [];
    const teamIdx = session.myTeamId - 1;
    const team = gameTeams[teamIdx];
    if (!team) return;

    if (!activeGame.gameStarted || activeGame.gameEnded) return;
    if (team.hasPlacedCurrentNumber) return;
    const teamBoard = restoreBoardArray(team.board);
    if (teamBoard[position] !== null) return;
    if (!activeGame.currentNumber) return;

    const newBoard = [...teamBoard];
    newBoard[position] = activeGame.currentNumber;
    const newScore = calculatePlayerScore(newBoard);

    const newTeams = [...gameTeams];
    newTeams[teamIdx] = {
      ...team,
      board: newBoard,
      score: newScore,
      hasPlacedCurrentNumber: true,
      placedBy: session.myPlayerName
    };

    // Filter active teams and check if all have placed their number
    // Use explicit === true check to handle undefined values from Firebase
    const activeTeamsList = newTeams.filter(t => (Array.isArray(t.players) ? t.players : []).length > 0);
    const allPlaced = activeTeamsList.every(t => t.hasPlacedCurrentNumber === true);

    console.log('Placement check:', {
      activeTeams: activeTeamsList.length,
      allPlaced,
      teamStatuses: activeTeamsList.map(t => ({ teamNumber: t.teamNumber, hasPlaced: t.hasPlacedCurrentNumber }))
    });

    let updates: Partial<GameState> = {
      teams: newTeams,
      waitingForPlacements: !allPlaced,
      version: (activeGame.version || 0) + 1
    };

    if (allPlaced && checkGameEnd({ ...activeGame, ...updates } as GameState)) {
      updates.gameEnded = true;
      updates.finalRanking = calculateFinalRanking({ ...activeGame, ...updates } as GameState);
    }
    updateGameWithMerge(activeGame.companyName, updates, teamIdx, newBoard);
  };

  // Special update function for board placements that preserves board state
  // This prevents race conditions where Firebase updates could overwrite local board changes
  // CRITICAL: Also preserves hasPlacedCurrentNumber status from other teams
  const updateGameWithMerge = (companyName: string, updates: Partial<GameState>, teamIdx: number, newBoard: (number | string | null)[]) => {
    // Mark that we're making a critical local change
    lastLocalChangeTime.current = Date.now();

    setGames(prevGames =>
      prevGames.map(g => {
        if (g.companyName !== companyName) return g;

        // Get the current teams from prevGames (most up-to-date local state)
        const currentTeams = Array.isArray(g.teams) ? g.teams : [];

        // Merge: ensure the board update for this specific team is preserved
        // AND preserve hasPlacedCurrentNumber status from other teams
        const mergedTeams = updates.teams ? updates.teams.map((updatedTeam: Team, idx: number) => {
          if (idx === teamIdx) {
            // For the team that just placed a number, ensure their board is the new board
            return {
              ...updatedTeam,
              board: newBoard
            };
          }
          // For other teams, preserve their existing state
          const existingTeam = currentTeams[idx];
          if (existingTeam) {
            const existingBoard = restoreBoardArray(existingTeam.board);
            const updatedBoard = restoreBoardArray(updatedTeam.board);
            // Count filled cells
            const existingFilledCount = existingBoard.filter(c => c !== null).length;
            const updatedFilledCount = updatedBoard.filter(c => c !== null).length;

            // CRITICAL: Preserve hasPlacedCurrentNumber if either has it true
            // This prevents one team's update from overwriting another team's placement status
            const preservedHasPlaced = existingTeam.hasPlacedCurrentNumber === true || updatedTeam.hasPlacedCurrentNumber === true;
            const preservedPlacedBy = preservedHasPlaced ? (existingTeam.placedBy || updatedTeam.placedBy) : null;

            // Keep the board with more filled cells (more recent data)
            if (existingFilledCount > updatedFilledCount) {
              return {
                ...updatedTeam,
                board: existingBoard,
                hasPlacedCurrentNumber: preservedHasPlaced,
                placedBy: preservedPlacedBy
              };
            }

            // Even if updated board has more/equal data, still preserve hasPlacedCurrentNumber
            return {
              ...updatedTeam,
              hasPlacedCurrentNumber: preservedHasPlaced,
              placedBy: preservedPlacedBy
            };
          }
          return updatedTeam;
        }) : undefined;

        // Re-calculate waitingForPlacements based on the properly merged teams
        const finalTeams = mergedTeams || updates.teams || g.teams;
        const activeTeamsList = (Array.isArray(finalTeams) ? finalTeams : []).filter(t => (Array.isArray(t.players) ? t.players : []).length > 0);
        const allPlaced = activeTeamsList.every(t => t.hasPlacedCurrentNumber === true);

        console.log('updateGameWithMerge - Recalculated placement status:', {
          activeTeams: activeTeamsList.length,
          allPlaced,
          teamStatuses: activeTeamsList.map(t => ({ teamNumber: t.teamNumber, hasPlaced: t.hasPlacedCurrentNumber }))
        });

        return {
          ...g,
          ...updates,
          teams: finalTeams,
          waitingForPlacements: !allPlaced  // Override with recalculated value
        };
      })
    );
  };

  const updateGame = (companyName: string, updates: Partial<GameState>) => {
    setGames(prevGames =>
      prevGames.map(g =>
        g.companyName === companyName ? { ...g, ...updates } : g
      )
    );
  };

  const toggleViewMode = () => {
    setSession(prev => {
        const newRole = prev.role === 'HOST' ? 'PLAYER' : 'HOST';
        let newTeamId = prev.myTeamId;
        let newPlayerId = prev.myPlayerId;
        let newPlayerName = prev.myPlayerName;
        
        if (newRole === 'PLAYER' && !newTeamId) {
             newTeamId = 1; 
             newPlayerId = 'spectator'; 
             newPlayerName = '관리자(미리보기)';
        }

        return {
            ...prev,
            role: newRole,
            myTeamId: newTeamId,
            myPlayerId: newPlayerId,
            myPlayerName: newPlayerName
        };
    });
  };

  // Determine active player data.
  const activeGameTeams = Array.isArray(activeGame?.teams) ? activeGame.teams : [];
  const activePlayerTeam = activeGame && session.myTeamId ? activeGameTeams[session.myTeamId - 1] : null;
  const activePlayerTeamPlayers = Array.isArray(activePlayerTeam?.players) ? activePlayerTeam.players : [];
  const myself = activePlayerTeam && session.myPlayerId
    ? (activePlayerTeamPlayers.find(p => p.id === session.myPlayerId) || { id: 'spectator', name: session.myPlayerName || '관리자', joinedAt: '' })
    : null;

  const canSwitchToHostView = currentUser.role === 'ADMIN' || (activeGame && activeGame.creatorId === currentUser.id);

  // --- LOBBY UI ---
  if (!session.gameId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300">
        <GridBackground />
        
        {/* LOGIN / PROFILE TOP BAR */}
        <div className="absolute top-4 right-4 z-50 flex gap-2">
            <button
               onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
               className="px-3 py-2 bg-white/10 dark:bg-black/40 border border-gray-300 dark:border-white/20 text-slate-800 dark:text-white rounded-full hover:bg-gray-200 dark:hover:bg-white/20 transition-all flex items-center gap-2"
            >
               {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {currentUser.role === 'GUEST' ? (
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="px-4 py-2 bg-cyan-600/10 border border-cyan-600/30 text-cyan-600 dark:text-ai-primary hover:bg-cyan-600 hover:text-white rounded-full text-xs font-bold transition-all flex items-center gap-2"
                >
                    <LogIn className="w-3 h-3" /> 로그인
                </button>
            ) : (
                <div className="flex items-center gap-2">
                    {currentUser.role === 'ADMIN' && (
                        <button 
                        onClick={() => setShowAdminDashboard(true)}
                        className="px-4 py-2 bg-purple-600/10 border border-purple-600/30 text-purple-600 dark:text-ai-secondary hover:bg-purple-600 hover:text-white rounded-full text-xs font-bold transition-all flex items-center gap-2"
                        >
                            <ShieldCheck className="w-3 h-3" /> 관리자 대시보드
                        </button>
                    )}
                    <div className="px-4 py-2 bg-gray-200 dark:bg-white/10 border border-gray-300 dark:border-white/20 text-slate-800 dark:text-white rounded-full text-xs font-bold flex items-center gap-2">
                        <UserCog className="w-3 h-3" /> {currentUser.name} ({currentUser.role})
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="p-2 bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-all"
                    >
                        <LogOut className="w-3 h-3" />
                    </button>
                </div>
            )}
        </div>
        
        <Panel className="w-full max-w-md relative z-10 p-0 overflow-hidden shadow-2xl border-cyan-500/30">
          <div className="text-center p-8 border-b border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-black/40">
            <div className="flex justify-center mb-2">
               <Hexagon className="w-10 h-10 text-cyan-600 dark:text-ai-primary animate-pulse" />
            </div>
            <p className="text-sm font-bold text-gray-500 dark:text-ai-dim mb-2 uppercase tracking-widest neon-text">JJ Creative 교육연구소</p>
            <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight drop-shadow-lg">
              AI vs <span className="text-cyan-600 dark:text-ai-primary">집단지성</span>
            </h1>
            <p className="text-xs text-cyan-700 dark:text-ai-primary/80 font-mono mt-1 uppercase tracking-wider">
              Collective Intelligence Challenge
            </p>
          </div>

          <div className="flex p-4 gap-2 bg-gray-50 dark:bg-black/20">
            <button 
              onClick={() => setActiveTab('JOIN')}
              className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all border ${activeTab === 'JOIN' ? 'bg-purple-100 text-purple-800 border-purple-500 dark:bg-ai-secondary/20 dark:text-ai-secondary dark:border-ai-secondary shadow-sm' : 'bg-transparent text-gray-500 border-transparent hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
            >
              게임 참여
            </button>
            <button 
              onClick={() => setActiveTab('CREATE')}
              className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all border ${activeTab === 'CREATE' ? 'bg-cyan-100 text-cyan-800 border-cyan-500 dark:bg-ai-primary/20 dark:text-ai-primary dark:border-ai-primary shadow-sm' : 'bg-transparent text-gray-500 border-transparent hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
            >
              게임 생성
            </button>
          </div>

          <div className="p-6 min-h-[400px] bg-white dark:bg-transparent">
            {activeTab === 'CREATE' ? (
              <div className="space-y-6 animate-fade-in relative">
                {!isAuthorized && (
                    <div className="absolute inset-0 z-20 bg-white/80 dark:bg-black/80 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-6 rounded-lg border border-gray-200 dark:border-white/10">
                        <Lock className="w-10 h-10 text-gray-500 mb-4" />
                        <h3 className="text-slate-800 dark:text-white font-bold mb-2">접근 권한 없음</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-xs mb-4">게임 생성은 관리자 및 등록된 회원만 가능합니다.</p>
                        <Button onClick={() => setShowLoginModal(true)} variant="secondary" className="text-xs">로그인 하러 가기</Button>
                    </div>
                )}

                <div>
                  <label className="block text-xs font-mono font-bold text-gray-500 dark:text-ai-dim mb-2 uppercase">Company Name</label>
                  <input
                    className="glass-input w-full px-4 py-3 rounded-lg focus:border-cyan-500 dark:focus:border-ai-primary focus:ring-1 focus:ring-cyan-500/50 dark:focus:ring-ai-primary/50 outline-none transition-all text-slate-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 bg-gray-50 dark:bg-black/30"
                    value={createFormName}
                    onChange={e => setCreateFormName(e.target.value)}
                    placeholder="예: 삼성전자 AI팀"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono font-bold text-gray-500 dark:text-ai-dim mb-2 uppercase">Team Count</label>
                  <select
                    className="glass-input w-full px-4 py-3 rounded-lg focus:border-cyan-500 dark:focus:border-ai-primary outline-none text-slate-800 dark:text-white bg-gray-50 dark:bg-black/50"
                    value={createFormTeams}
                    onChange={e => setCreateFormTeams(e.target.value)}
                  >
                    {Array.from({length: 30}, (_, i) => i + 1).map(n => (
                      <option key={n} value={n} className="bg-white dark:bg-slate-900">{n}개 팀</option>
                    ))}
                  </select>
                </div>

                {/* Game Mode Selection */}
                <div>
                  <label className="block text-xs font-mono font-bold text-gray-500 dark:text-ai-dim mb-2 uppercase">Game Mode (필수)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setCreateFormMode('CONTROL')}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        createFormMode === 'CONTROL'
                          ? 'bg-cyan-50 dark:bg-ai-primary/10 border-cyan-500 dark:border-ai-primary'
                          : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 hover:border-cyan-300 dark:hover:border-ai-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Gamepad2 className={`w-5 h-5 ${createFormMode === 'CONTROL' ? 'text-cyan-600 dark:text-ai-primary' : 'text-gray-400'}`} />
                        <span className={`font-bold text-sm ${createFormMode === 'CONTROL' ? 'text-cyan-700 dark:text-ai-primary' : 'text-gray-600 dark:text-gray-400'}`}>컨트롤</span>
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                        모든 숫자가 보이는 상태에서<br/>
                        호스트가 직접 선택하여 출제
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateFormMode('RANDOM_BOARD')}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        createFormMode === 'RANDOM_BOARD'
                          ? 'bg-pink-50 dark:bg-ai-accent/10 border-pink-500 dark:border-ai-accent'
                          : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 hover:border-pink-300 dark:hover:border-ai-accent/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Dices className={`w-5 h-5 ${createFormMode === 'RANDOM_BOARD' ? 'text-pink-600 dark:text-ai-accent' : 'text-gray-400'}`} />
                        <span className={`font-bold text-sm ${createFormMode === 'RANDOM_BOARD' ? 'text-pink-700 dark:text-ai-accent' : 'text-gray-600 dark:text-gray-400'}`}>🎲숫자판</span>
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                        A1~H5 숫자가 숨겨진 상태에서<br/>
                        클릭하거나 랜덤으로 공개 후 출제
                      </p>
                    </button>
                  </div>
                  {!createFormMode && (
                    <p className="text-red-500 text-[10px] mt-1">⚠️ 게임 모드를 선택해주세요</p>
                  )}
                </div>

                <button
                  onClick={() => createCompanyGame(createFormName, createFormTeams, createFormMode)}
                  disabled={!createFormMode}
                  className={`w-full py-4 mt-2 font-bold rounded-lg transition-all shadow-lg flex items-center justify-center gap-2 uppercase tracking-wider ${
                    createFormMode
                      ? 'bg-cyan-600 text-white dark:bg-ai-primary/10 border dark:border-ai-primary dark:text-ai-primary hover:bg-cyan-700 dark:hover:bg-ai-primary dark:hover:text-black'
                      : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Building2 className="w-5 h-5" /> Create Game
                </button>
              </div>
            ) : !selectedGameId ? (
              <div className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300">Active Games</h3>
                  <button onClick={() => setGames([...safeGames])} className="text-xs text-cyan-600 dark:text-ai-primary flex items-center gap-1 hover:text-cyan-800 dark:hover:text-white transition-colors">
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                  {safeGames.map(g => {
                    const safeTeams = Array.isArray(g.teams) ? g.teams : [];
                    const activeCount = safeTeams.reduce((acc, t) => acc + (Array.isArray(t.players) ? t.players : []).length, 0);
                    const joinedTeams = safeTeams.filter(t => (Array.isArray(t.players) ? t.players : []).length > 0).length;
                    return (
                      <div key={generateGameId(g.companyName)} className="border border-gray-200 dark:border-white/10 rounded-lg p-4 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 hover:border-cyan-300 dark:hover:border-ai-primary/50 transition-all cursor-pointer group">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-lg text-slate-800 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-ai-primary transition-colors">{g.companyName}</h4>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-[10px] font-mono font-bold uppercase ${g.gameEnded ? 'bg-gray-200 text-gray-500' : g.gameStarted ? 'bg-green-100 text-green-600 dark:bg-ai-success/10 dark:text-ai-success' : 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'}`}>
                              {g.gameEnded ? 'Ended' : g.gameStarted ? 'Playing' : 'Waiting'}
                            </span>
                            {currentUser.role === 'ADMIN' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteGame(generateGameId(g.companyName));
                                }}
                                className="p-1.5 rounded bg-red-100 hover:bg-red-500 text-red-500 hover:text-white dark:bg-red-500/10 dark:hover:bg-red-500 dark:text-red-400 dark:hover:text-white transition-all"
                                title="게임 삭제 (관리자 전용)"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mb-3 font-mono">
                          {joinedTeams}/{g.teamCount} Teams • {activeCount} Players •
                          <span className={`ml-1 ${g.gameMode === 'CONTROL' ? 'text-cyan-600 dark:text-ai-primary' : g.gameMode === 'RANDOM_BOARD' ? 'text-pink-600 dark:text-ai-accent' : 'text-gray-400'}`}>
                            {g.gameMode === 'CONTROL' ? '컨트롤' : g.gameMode === 'RANDOM_BOARD' ? '🎲숫자판' : '미정'}
                          </span>
                        </p>
                        {!g.gameEnded && (
                          <button
                            onClick={() => setSelectedGameId(generateGameId(g.companyName))}
                            className="w-full py-2 bg-cyan-50 dark:bg-ai-primary/10 border border-cyan-200 dark:border-ai-primary/30 text-cyan-700 dark:text-ai-primary text-xs font-bold rounded hover:bg-cyan-100 dark:hover:bg-ai-primary dark:hover:text-black transition-all uppercase tracking-widest"
                          >
                            Enter Room
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {safeGames.length === 0 && (
                     <div className="text-center py-8 text-gray-500 text-sm font-mono border border-dashed border-gray-300 dark:border-white/10 rounded-lg">
                       No active games found.
                     </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-fade-in">
                 <button onClick={() => setSelectedGameId(null)} className="text-xs text-gray-500 hover:text-slate-900 dark:hover:text-white transition-colors font-mono">
                   ← Back to List
                 </button>
                 
                 <div className="bg-cyan-50 dark:bg-ai-primary/5 p-4 rounded-lg border border-cyan-200 dark:border-ai-primary/20">
                   <p className="text-xs text-cyan-700 dark:text-ai-primary font-bold mb-1 font-mono uppercase">Selected Game</p>
                   <p className="text-lg font-bold text-slate-800 dark:text-white">
                     {safeGames.find(g => generateGameId(g.companyName) === selectedGameId)?.companyName}
                   </p>
                 </div>

                 <div>
                   <label className="block text-xs font-mono font-bold text-gray-500 dark:text-ai-dim mb-2 uppercase">Your Name</label>
                   <input 
                     className="glass-input w-full px-4 py-3 rounded-lg focus:border-purple-500 dark:focus:border-ai-secondary focus:ring-1 focus:ring-purple-500/50 dark:focus:ring-ai-secondary/50 outline-none transition-all text-slate-800 dark:text-white placeholder-gray-400 bg-gray-50 dark:bg-black/30"
                     value={joinName}
                     onChange={e => setJoinName(e.target.value)}
                     placeholder="Enter your name"
                   />
                 </div>

                 <div>
                   <label className="block text-xs font-mono font-bold text-gray-500 dark:text-ai-dim mb-2 uppercase">Select Team</label>
                   <div className="grid grid-cols-4 gap-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                     {(Array.isArray(safeGames.find(g => generateGameId(g.companyName) === selectedGameId)?.teams) ? safeGames.find(g => generateGameId(g.companyName) === selectedGameId)!.teams : []).map((t, i) => (
                       <button
                         key={t.teamNumber}
                         onClick={() => setJoinTeamIdx(i)}
                         className={`p-2 rounded border font-mono text-sm transition-all ${
                           joinTeamIdx === i 
                             ? 'bg-purple-600 text-white border-purple-600 dark:bg-ai-secondary dark:border-ai-secondary shadow-md' 
                             : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200 dark:bg-white/5 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white'
                         }`}
                       >
                         {t.teamNumber}조
                       </button>
                     ))}
                   </div>
                 </div>

                 <button 
                   onClick={() => joinTeam(selectedGameId!, joinTeamIdx, joinName)}
                   className="w-full py-4 bg-purple-600 text-white dark:bg-ai-secondary/10 border dark:border-ai-secondary dark:text-ai-secondary hover:bg-purple-700 dark:hover:bg-ai-secondary dark:hover:text-white font-bold rounded-lg transition-all shadow-lg mt-4 uppercase tracking-wider"
                 >
                   Join Game
                 </button>
              </div>
            )}
          </div>
          <Footer theme={theme} />
        </Panel>

        {/* LOGIN MODAL */}
        {showLoginModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <Panel className="w-full max-w-sm relative bg-white dark:bg-[#0a0a0f]">
                    <button onClick={() => { setShowLoginModal(false); setGoogleError(null); setIsGoogleLoggingIn(false); }} className="absolute top-4 right-4 text-gray-500 hover:text-slate-900 dark:hover:text-white">✕</button>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <LogIn className="w-5 h-5 text-cyan-600 dark:text-ai-primary" /> 시스템 로그인
                    </h2>
                    
                    <div className="flex gap-2 mb-6">
                        <button 
                            onClick={() => setLoginMode('MEMBER')} 
                            className={`flex-1 py-2 text-xs font-bold rounded transition-colors ${loginMode === 'MEMBER' ? 'bg-cyan-600 text-white dark:bg-ai-primary dark:text-black' : 'bg-gray-200 dark:bg-white/5 text-gray-500 dark:text-gray-400'}`}
                        >
                            회원 로그인
                        </button>
                        <button 
                            onClick={() => setLoginMode('ADMIN')} 
                            className={`flex-1 py-2 text-xs font-bold rounded transition-colors ${loginMode === 'ADMIN' ? 'bg-purple-600 text-white dark:bg-ai-secondary' : 'bg-gray-200 dark:bg-white/5 text-gray-500 dark:text-gray-400'}`}
                        >
                            관리자 로그인
                        </button>
                    </div>

                    <div className="space-y-4">
                        {loginMode === 'MEMBER' ? (
                            <div>
                                <label className="block text-xs font-mono text-gray-500 mb-1">Google Email</label>
                                <Input
                                    value={loginEmail}
                                    onChange={e => setLoginEmail(e.target.value)}
                                    placeholder="example@gmail.com"
                                    type="email"
                                    className="bg-gray-50 dark:bg-black/30 text-slate-900 dark:text-white"
                                />
                                <p className="text-[10px] text-gray-500 mt-2">* 등록된 이메일과 일치하는 구글 계정으로만 접속 가능합니다.</p>

                                {googleError && (
                                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400">
                                    {googleError}
                                  </div>
                                )}

                                <button
                                  onClick={handleLogin}
                                  disabled={isGoogleLoggingIn}
                                  className="w-full mt-4 py-2.5 bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 font-roboto font-medium rounded transition-all flex items-center justify-center gap-3 shadow-sm active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isGoogleLoggingIn ? (
                                    <>
                                      <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                      </svg>
                                      <span className="text-sm">Google 로그인 중...</span>
                                    </>
                                  ) : (
                                    <>
                                      {/* Google Logo SVG */}
                                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                      </svg>
                                      <span className="text-sm">Google 계정으로 로그인</span>
                                    </>
                                  )}
                                </button>

                                {!isGoogleLoaded && (
                                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 animate-pulse">
                                    Google 로그인을 준비하는 중...
                                  </p>
                                )}

                                {/* Fallback option when Google Sign-In doesn't work */}
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10">
                                  <p className="text-[10px] text-gray-400 text-center mb-2">Google 로그인이 작동하지 않는 경우:</p>
                                  <button
                                    onClick={handleFallbackLogin}
                                    disabled={!loginEmail.trim()}
                                    className="w-full py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 text-xs font-medium rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    이메일 인증으로 로그인
                                  </button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-xs font-mono text-gray-500 mb-1">Admin Password</label>
                                <Input 
                                    value={loginPassword} 
                                    onChange={e => setLoginPassword(e.target.value)} 
                                    placeholder="••••••" 
                                    type="password"
                                    className="bg-gray-50 dark:bg-black/30 text-slate-900 dark:text-white"
                                />
                                <Button onClick={handleLogin} className="w-full mt-4">로그인</Button>
                            </div>
                        )}
                    </div>
                </Panel>
            </div>
        )}

        {/* FAKE GOOGLE LOGIN SIMULATION MODAL */}
        {showGoogleSimulation && simulatedCandidate && (
             <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[1px] animate-fade-in">
               <div className="bg-white text-black rounded-[8px] w-full max-w-[400px] shadow-2xl overflow-hidden font-sans">
                 <div className="p-8 pb-6 text-center">
                    <svg className="w-12 h-12 mx-auto mb-2" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    <h2 className="text-2xl font-medium text-gray-800 mb-2">계정을 선택하세요</h2>
                    <p className="text-sm text-gray-600">Slido(으)로 이동</p>
                 </div>

                 <div className="px-4 pb-4">
                   <div 
                     onClick={() => completeMemberLogin(simulatedCandidate.email)}
                     className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded cursor-pointer border-b border-gray-100 transition-colors"
                   >
                     <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
                       {simulatedCandidate.name.charAt(0)}
                     </div>
                     <div className="text-left overflow-hidden">
                       <p className="text-sm font-medium text-gray-800 truncate">{simulatedCandidate.name}</p>
                       <p className="text-xs text-gray-500 truncate">{simulatedCandidate.email}</p>
                     </div>
                   </div>
                   
                   <div className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded cursor-pointer transition-colors mt-1">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                         <UserCog className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-800">다른 계정 사용</p>
                      </div>
                   </div>
                 </div>

                 <div className="p-6 pt-2 text-center border-t border-gray-100">
                   <p className="text-[10px] text-gray-500 leading-tight">
                     앱을 사용하기 전에 Slido의 <span className="text-blue-600 font-bold cursor-pointer">개인정보처리방침</span> 및 <span className="text-blue-600 font-bold cursor-pointer">서비스 약관</span>을 검토하세요.
                   </p>
                 </div>
                 
                 <button 
                   onClick={() => setShowGoogleSimulation(false)}
                   className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600"
                 >
                   ✕
                 </button>
               </div>
             </div>
        )}

        {/* ADMIN DASHBOARD MODAL */}
        {showAdminDashboard && (
            <AdminDashboard 
                members={members} 
                logs={logs} 
                onRegisterMember={registerMember}
                onDeleteMember={deleteMember}
                onExtendMember={extendMember}
                onRenewMember={renewMember}
                onClose={() => setShowAdminDashboard(false)} 
            />
        )}
      </div>
    );
  }

  // GAME VIEW (HOST OR PLAYER)
  return (
    <>
      <GridBackground />
      
      {/* GLOBAL CONTROLS */}
      <div className="fixed bottom-4 right-4 z-[100] flex gap-2">
        <button
           onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
           className="p-3 bg-white/90 dark:bg-black/80 backdrop-blur border border-gray-300 dark:border-white/20 text-slate-800 dark:text-white rounded-full hover:bg-gray-100 dark:hover:bg-white/10 shadow-lg transition-all"
        >
           {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {canSwitchToHostView && (
          <button 
            onClick={toggleViewMode}
            className="px-4 py-2 bg-slate-900/90 dark:bg-black/80 backdrop-blur border border-white/20 text-xs text-white rounded-full hover:bg-black/70 dark:hover:bg-white/10 shadow-lg font-mono flex items-center gap-2 transition-all"
          >
            {session.role === 'HOST' ? '🔄 사용자 화면 보기' : '🔄 호스트 화면 보기'}
          </button>
        )}
        
        <button 
          onClick={() => setSession({ gameId: null, game: null, role: 'NONE', myTeamId: null, myPlayerId: null, myPlayerName: null })}
          className="px-4 py-2 bg-red-600/90 dark:bg-red-900/80 backdrop-blur border border-red-500/20 text-xs text-white rounded-full hover:bg-red-700 dark:hover:bg-red-800/80 shadow-lg font-mono"
        >
          나가기
        </button>
      </div>

      {session.role === 'HOST' && activeGame && (
        <HostView
          game={activeGame}
          onStartGame={startCompanyGame}
          onSelectNumber={selectNumberByHost}
          onSelectRandomCell={selectRandomCell}
          onSubmitRandomNumber={submitRandomNumber}
          onRandomReveal={randomRevealCell}
        />
      )}
      
      {session.role === 'PLAYER' && activeGame && activePlayerTeam ? (
        <PlayerView 
          game={activeGame} 
          team={activePlayerTeam}
          me={myself!}
          onPlaceNumber={placeNumberInTeam}
        />
      ) : (
         session.role === 'PLAYER' && <div className="text-slate-800 dark:text-white text-center mt-20 animate-pulse">Loading Game State...</div>
      )}
    </>
  );
};

export default App;
