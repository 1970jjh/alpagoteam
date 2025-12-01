
export interface Player {
  id: string;
  name: string;
  joinedAt: string;
}

export interface Team {
  teamNumber: number;
  players: Player[];
  board: (number | string | null)[];
  score: number;
  hasPlacedCurrentNumber: boolean;
  placedBy: string | null;
}

export interface GameState {
  companyName: string;
  teamCount: number;
  teams: Team[];
  availableNumbers: (number | string)[];
  usedNumbers: (number | string)[];
  // Track specific indices (0-39) of the deck that have been used
  usedCardIndices: number[];
  currentNumber: number | string | null;
  gameStarted: boolean;
  gameEnded: boolean;
  waitingForPlacements: boolean;
  currentRound: number;
  finalRanking: {
    rank: number;
    teamNumber: number;
    score: number;
    players: Player[];
  }[];
  creatorId: string; // ID of the user who created the game
  createdAt: string;
}

export type Role = 'HOST' | 'PLAYER' | 'NONE';

export interface AppContextState {
  game: GameState | null;
  role: Role;
  myTeamId: number | null; // 1-based index
  myPlayerId: string | null;
  myPlayerName: string | null;
}

// --- NEW TYPES FOR ADMIN/MEMBER SYSTEM ---

export type UserRole = 'GUEST' | 'MEMBER' | 'ADMIN';

export interface Member {
  id: string;
  name: string;
  email: string; // Google Email
  phone: string;
  registeredAt: string;
  expiresAt: string; // 6 months from registration
  status: 'ACTIVE' | 'SUSPENDED';
}

export interface AccessLog {
  id: string;
  timestamp: string;
  type: 'LOGIN' | 'LOGOUT' | 'CREATE_GAME' | 'REGISTER_MEMBER' | 'MEMBER_ACTION';
  userId: string; // 'ADMIN' or Member ID
  userName: string;
  details: string;
  durationMinutes?: number; // For LOGOUT type
  relatedGameName?: string; // For CREATE_GAME type
}

export interface UserSession {
  role: UserRole;
  id: string;
  name: string;
  email?: string;
  loginAt?: string; // Track when session started
}