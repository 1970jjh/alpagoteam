
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

export type GameMode = 'CONTROL' | 'RANDOM_BOARD' | null;

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
  // Game mode: CONTROL (open numbers) or RANDOM_BOARD (hidden numbers)
  gameMode: GameMode;
  // For RANDOM_BOARD mode: shuffled numbers array (A1-H5 = 40 cells)
  randomBoardNumbers?: (number | string)[];
  // For RANDOM_BOARD mode: which cells have been revealed
  revealedCells?: string[];
  // For RANDOM_BOARD mode: pending number to be submitted
  pendingRandomNumber?: { value: number | string; cellLabel: string } | null;
  // Version counter for conflict resolution
  version?: number;
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
  type: 'LOGIN' | 'LOGOUT' | 'CREATE_GAME' | 'DELETE_GAME' | 'REGISTER_MEMBER' | 'MEMBER_ACTION';
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

// --- GOOGLE OAUTH TYPES ---
export interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
  clientId?: string;
}

export interface GoogleUserPayload {
  iss: string;
  azp: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
  iat: number;
  exp: number;
}

// Declare global google namespace for GIS
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: (momentListener?: (notification: {
            isNotDisplayed: () => boolean;
            isSkippedMoment: () => boolean;
            isDismissedMoment: () => boolean;
            getNotDisplayedReason: () => string;
            getSkippedReason: () => string;
            getDismissedReason: () => string;
          }) => void) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number;
              locale?: string;
            }
          ) => void;
          disableAutoSelect: () => void;
          revoke: (hint: string, callback: () => void) => void;
        };
      };
    };
  }
}