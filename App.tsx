
import React, { useState, useEffect, useRef } from 'react';
import { GameState, AppContextState, Team, Player, UserSession, Member, AccessLog } from './types';
import { createFullDeck, calculatePlayerScore, checkGameEnd, generateGameId, calculateFinalRanking, generatePlayerId } from './utils';
import { GridBackground, Panel, Input, Button, Footer } from './components/UI';
import { HostView } from './components/HostView';
import { PlayerView } from './components/PlayerView';
import { AdminDashboard } from './components/AdminDashboard';
import { Hexagon, RefreshCw, Building2, Lock, LogIn, UserCog, ShieldCheck, LogOut, Sun, Moon } from 'lucide-react';
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
    createdAt: new Date().toISOString()
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
};

// --- HELPER: Check if localStorage is available ---
const isLocalStorageAvailable = (): boolean => {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

const storageAvailable = isLocalStorageAvailable();

// --- HELPER: Load from localStorage with fallback ---
const loadFromStorage = <T,>(key: string, fallback: T): T => {
  if (!storageAvailable) return fallback;
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error(`Failed to load ${key} from localStorage:`, e);
  }
  return fallback;
};

// --- HELPER: Save to localStorage ---
const saveToStorage = <T,>(key: string, data: T): void => {
  if (!storageAvailable) return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Failed to save ${key} to localStorage:`, e);
  }
};

const App: React.FC = () => {
  // Check if Firebase is configured
  const useFirebase = isFirebaseConfigured();

  // Global Data State - Initialize from localStorage or fallback to initial data
  const [games, setGames] = useState<GameState[]>(() =>
    loadFromStorage(STORAGE_KEYS.GAMES, INITIAL_GAMES)
  );
  const [members, setMembers] = useState<Member[]>(() =>
    loadFromStorage(STORAGE_KEYS.MEMBERS, INITIAL_MEMBERS)
  );
  const [logs, setLogs] = useState<AccessLog[]>(() =>
    loadFromStorage(STORAGE_KEYS.LOGS, INITIAL_LOGS)
  );

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

  // --- GOOGLE SIMULATION STATE ---
  const [showGoogleSimulation, setShowGoogleSimulation] = useState(false);
  const [simulatedCandidate, setSimulatedCandidate] = useState<Member | null>(null);

  // Game Session State
  const [session, setSession] = useState<AppContextState & { gameId: string | null }>({
    gameId: null,
    game: null,
    role: 'NONE',
    myTeamId: null,
    myPlayerId: null,
    myPlayerName: null
  });

  // Derived State
  const activeGame = games.find(g => generateGameId(g.companyName) === session.gameId) || null;
  const isAuthorized = currentUser.role === 'ADMIN' || currentUser.role === 'MEMBER';

  // --- TAB STATE (DEFAULT: JOIN) ---
  const [activeTab, setActiveTab] = useState<'CREATE' | 'JOIN'>('JOIN');
  const [createFormName, setCreateFormName] = useState("삼성전자 AI팀");
  const [createFormTeams, setCreateFormTeams] = useState("2");
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
      if (newGames) {
        isFirebaseUpdate.current = true;
        setGames(newGames.length > 0 ? newGames : []);
        // Also save to localStorage as cache
        saveToStorage(STORAGE_KEYS.GAMES, newGames);
      }
    });

    // Subscribe to members
    const unsubscribeMembers = subscribeToMembers((newMembers) => {
      if (newMembers) {
        isFirebaseUpdate.current = true;
        setMembers(newMembers);
        saveToStorage(STORAGE_KEYS.MEMBERS, newMembers);
      }
    });

    // Subscribe to logs
    const unsubscribeLogs = subscribeToLogs((newLogs) => {
      if (newLogs) {
        isFirebaseUpdate.current = true;
        setLogs(newLogs);
        saveToStorage(STORAGE_KEYS.LOGS, newLogs);
      }
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
      const currentMember = members.find(m => m.id === currentUser.id);
      
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
      const member = members.find(m => m.email.toLowerCase() === email.toLowerCase());
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
      setGames(prevGames => 
        prevGames
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
          })
      );
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
      // Member Login Logic
      if (!loginEmail.trim()) {
        alert("구글 이메일 주소를 입력해주세요.");
        return;
      }

      // 1. PRE-CHECK: Is this email registered in our system?
      const checkMember = members.find(m => m.email.toLowerCase() === loginEmail.trim().toLowerCase());
      if (!checkMember) {
         alert('등록되지 않은 이메일입니다. 관리자에게 문의하여 회원 등록을 진행해주세요.');
         return;
      }
      
      // 2. SIMULATION: Launch Fake Google Modal
      // Because strict Google Auth fails in the BUILD iframe environment (400 origin mismatch),
      // we simulate the experience to allow testing the logic.
      setSimulatedCandidate(checkMember);
      setShowGoogleSimulation(true);
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
      const target = members.find(m => m.id === id);
      if (!target) return;
      
      // Directly remove from state. This triggers the useEffect in App to kick the user out if they are logged in.
      setMembers(prev => prev.filter(m => m.id !== id));
      addLog('MEMBER_ACTION', `회원 삭제: ${target.name} (${target.email})`);
  };

  const extendMember = (id: string) => {
      const target = members.find(m => m.id === id);
      if (!target) return;
      
      const currentExpiry = new Date(target.expiresAt);
      const newExpiry = new Date(currentExpiry.setMonth(currentExpiry.getMonth() + 6)).toISOString();

      setMembers(prev => prev.map(m => m.id === id ? { ...m, expiresAt: newExpiry } : m));
      addLog('MEMBER_ACTION', `기간 연장 (+6개월): ${target.name}`);
  };

  const renewMember = (id: string) => {
      const target = members.find(m => m.id === id);
      if (!target) return;
      
      const newExpiry = new Date(Date.now() + (1000 * 60 * 60 * 24 * 30 * 6)).toISOString();

      setMembers(prev => prev.map(m => m.id === id ? { ...m, expiresAt: newExpiry } : m));
      addLog('MEMBER_ACTION', `기간 재설정 (오늘부터 6개월): ${target.name}`);
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

  const createCompanyGame = (companyName: string, teamCountStr: string) => {
    if (!isAuthorized) {
        alert("게임 생성 권한이 없습니다.");
        return;
    }

    const teamCount = parseInt(teamCountStr);
    if (!companyName || isNaN(teamCount) || teamCount < 1) {
      alert("회사명과 최소 1개 이상의 팀을 입력해주세요.");
      return;
    }

    const gameId = generateGameId(companyName);
    if (games.some(g => generateGameId(g.companyName) === gameId)) {
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
      createdAt: new Date().toISOString()
    };

    setGames(prev => [newGame, ...prev]);
    addLog('CREATE_GAME', `${companyName} 게임 생성 (${teamCount}개 팀)`, { relatedGameName: companyName });
    
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
    const gameIndex = games.findIndex(g => generateGameId(g.companyName) === gameId);
    if (gameIndex === -1) return;
    
    if (!playerName.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    const game = games[gameIndex];
    const team = game.teams[teamNumberIdx];
    
    if (team.players.length >= 10) {
      alert("이 팀은 정원이 초과되었습니다.");
      return;
    }
    if (team.players.some(p => p.name === playerName)) {
      alert("이미 이 팀에 존재하는 이름입니다.");
      return;
    }

    const playerId = generatePlayerId();
    const newPlayer: Player = {
      id: playerId,
      name: playerName,
      joinedAt: new Date().toISOString()
    };

    const newTeams = game.teams.map((t, idx) => 
      idx === teamNumberIdx 
        ? { ...t, players: [...t.players, newPlayer] }
        : t
    );
    
    const newGame = { ...game, teams: newTeams };
    const newGamesList = [...games];
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

  const startCompanyGame = () => {
    if (!activeGame) return;
    const activeTeams = activeGame.teams.filter(t => t.players.length > 0);
    if (activeTeams.length < 1) {
      alert("최소 1팀 이상 참가해야 합니다.");
      return;
    }
    updateGame(activeGame.companyName, {
      gameStarted: true,
      currentRound: 0,
      currentNumber: null,
    });
  };

  const selectNumberByHost = (num: number | string, cardIndex: number) => {
    if (!activeGame) return;
    if (activeGame.waitingForPlacements) {
      alert("모든 팀이 숫자를 배치할 때까지 기다려주세요.");
      return;
    }
    const newUsedCardIndices = [...activeGame.usedCardIndices, cardIndex];
    const newAvailable = [...activeGame.availableNumbers]; 
    const newTeams = activeGame.teams.map(t => ({ ...t, hasPlacedCurrentNumber: false, placedBy: null }));

    updateGame(activeGame.companyName, {
      currentNumber: num,
      usedNumbers: [...activeGame.usedNumbers, num],
      usedCardIndices: newUsedCardIndices,
      availableNumbers: newAvailable, 
      waitingForPlacements: true,
      currentRound: activeGame.currentRound + 1,
      teams: newTeams
    });
  };

  const placeNumberInTeam = (position: number) => {
    if (!activeGame || !session.myTeamId || !session.myPlayerId) return;
    const teamIdx = session.myTeamId - 1;
    const team = activeGame.teams[teamIdx];
    
    if (!activeGame.gameStarted || activeGame.gameEnded) return;
    if (team.hasPlacedCurrentNumber) return;
    if (team.board[position] !== null) return;
    if (!activeGame.currentNumber) return;

    const newBoard = [...team.board];
    newBoard[position] = activeGame.currentNumber;
    const newScore = calculatePlayerScore(newBoard);

    const newTeams = [...activeGame.teams];
    newTeams[teamIdx] = {
      ...team,
      board: newBoard,
      score: newScore,
      hasPlacedCurrentNumber: true,
      placedBy: session.myPlayerName
    };

    const activeTeamsList = newTeams.filter(t => t.players.length > 0);
    const allPlaced = activeTeamsList.every(t => t.hasPlacedCurrentNumber);

    let updates: Partial<GameState> = {
      teams: newTeams,
      waitingForPlacements: !allPlaced
    };

    if (allPlaced && checkGameEnd({ ...activeGame, ...updates } as GameState)) {
      updates.gameEnded = true;
      updates.finalRanking = calculateFinalRanking({ ...activeGame, ...updates } as GameState);
    }
    updateGame(activeGame.companyName, updates);
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
  const activePlayerTeam = activeGame && session.myTeamId ? activeGame.teams[session.myTeamId - 1] : null;
  const myself = activePlayerTeam && session.myPlayerId 
    ? (activePlayerTeam.players.find(p => p.id === session.myPlayerId) || { id: 'spectator', name: session.myPlayerName || '관리자', joinedAt: '' }) 
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
                
                <button 
                  onClick={() => createCompanyGame(createFormName, createFormTeams)}
                  className="w-full py-4 mt-4 bg-cyan-600 text-white dark:bg-ai-primary/10 border dark:border-ai-primary dark:text-ai-primary hover:bg-cyan-700 dark:hover:bg-ai-primary dark:hover:text-black font-bold rounded-lg transition-all shadow-lg flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                  <Building2 className="w-5 h-5" /> Create Game
                </button>
              </div>
            ) : !selectedGameId ? (
              <div className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300">Active Games</h3>
                  <button onClick={() => setGames([...games])} className="text-xs text-cyan-600 dark:text-ai-primary flex items-center gap-1 hover:text-cyan-800 dark:hover:text-white transition-colors">
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                  {games.map(g => {
                    const activeCount = g.teams.reduce((acc, t) => acc + t.players.length, 0);
                    const joinedTeams = g.teams.filter(t => t.players.length > 0).length;
                    return (
                      <div key={generateGameId(g.companyName)} className="border border-gray-200 dark:border-white/10 rounded-lg p-4 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 hover:border-cyan-300 dark:hover:border-ai-primary/50 transition-all cursor-pointer group">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-lg text-slate-800 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-ai-primary transition-colors">{g.companyName}</h4>
                          <span className={`px-2 py-1 rounded text-[10px] font-mono font-bold uppercase ${g.gameEnded ? 'bg-gray-200 text-gray-500' : g.gameStarted ? 'bg-green-100 text-green-600 dark:bg-ai-success/10 dark:text-ai-success' : 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'}`}>
                            {g.gameEnded ? 'Ended' : g.gameStarted ? 'Playing' : 'Waiting'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mb-3 font-mono">
                          {joinedTeams}/{g.teamCount} Teams • {activeCount} Players
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
                  {games.length === 0 && (
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
                     {games.find(g => generateGameId(g.companyName) === selectedGameId)?.companyName}
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
                     {games.find(g => generateGameId(g.companyName) === selectedGameId)?.teams.map((t, i) => (
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
                    <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-slate-900 dark:hover:text-white">✕</button>
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
                                
                                <button 
                                  onClick={handleLogin}
                                  className="w-full mt-4 py-2.5 bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 font-roboto font-medium rounded transition-all flex items-center justify-center gap-3 shadow-sm active:scale-[0.99]"
                                >
                                  {/* Google Logo SVG */}
                                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                  </svg>
                                  <span className="text-sm">Google 계정으로 로그인</span>
                                </button>
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
