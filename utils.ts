
import { GameState, Team } from './types';

// ==========================================
// LOGIC PORTED FROM GOOGLE APPS SCRIPT
// ==========================================

/**
 * Restores a board array from Firebase data.
 * Firebase converts sparse arrays with null values to objects like {2: 5, 10: 15}
 * This function ensures we always get a proper 20-element array back.
 */
export const restoreBoardArray = (board: any): (number | string | null)[] => {
  // Create a fresh 20-element array filled with null
  const restoredBoard: (number | string | null)[] = Array(20).fill(null);

  // If board is an array, copy valid values (convert undefined to null)
  if (Array.isArray(board)) {
    board.forEach((value, index) => {
      if (index < 20 && value !== undefined && value !== null) {
        restoredBoard[index] = value;
      }
      // undefined or null values are left as null (from Array.fill)
    });
    return restoredBoard;
  }

  // If board is an object (Firebase converted sparse array to object)
  if (board && typeof board === 'object') {
    Object.keys(board).forEach(key => {
      const index = parseInt(key, 10);
      const value = board[key];
      // Only copy non-null, non-undefined values
      if (!isNaN(index) && index >= 0 && index < 20 && value !== undefined && value !== null) {
        restoredBoard[index] = value;
      }
    });
    return restoredBoard;
  }

  // Default: return empty 20-element array
  return restoredBoard;
};

export const generateGameId = (companyName: string) => {
  return companyName.replace(/[^a-zA-Z0-9가-힣]/g, '').toLowerCase();
};

export const generatePlayerId = () => {
  return 'player_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
};

export const createFullDeck = (): (number | string)[] => {
  const deck: (number | string)[] = [];
  
  // 1-10: 1 card each
  for (let i = 1; i <= 10; i++) {
    deck.push(i);
  }
  
  // 11-19: 2 cards each
  for (let i = 11; i <= 19; i++) {
    deck.push(i);
    deck.push(i);
  }
  
  // 20-30: 1 card each
  for (let i = 20; i <= 30; i++) {
    deck.push(i);
  }
  
  // Joker
  deck.push('★');
  
  // Sort (Joker at end for display consistency in host view if needed)
  deck.sort((a, b) => {
    if (a === '★') return 1;
    if (b === '★') return -1;
    return (a as number) - (b as number);
  });
  
  return deck;
};

// Helper for scoring - checks if two adjacent numbers are in ascending order
// Joker handling is done separately in the main scoring function
const isNumericAscending = (current: number | string, next: number | string): boolean => {
  // If either is a joker, let the main function handle it
  if (current === '★' || next === '★') {
    return true; // Placeholder - actual joker logic is in calculatePlayerScore
  }

  const currentNum = typeof current === 'number' ? current : parseFloat(current as string);
  const nextNum = typeof next === 'number' ? next : parseFloat(next as string);

  return currentNum <= nextNum;
};

// Get numeric value, returns null for joker or null
const getNumericValue = (val: number | string | null): number | null => {
  if (val === null || val === '★') return null;
  return typeof val === 'number' ? val : parseFloat(val as string);
};

export const calculatePlayerScore = (board: (number | string | null)[]) => {
  const SCORE_TABLE = [0, 0, 1, 3, 5, 7, 9, 11, 15, 20, 25, 30, 35, 40, 50, 60, 70, 85, 100, 150, 300];

  // Step 1: Build connection array - does position i connect to position i+1?
  // Initially mark all adjacent non-null pairs as potentially connected
  const connects: boolean[] = new Array(20).fill(false);

  for (let i = 0; i < 19; i++) {
    if (board[i] === null || board[i + 1] === null) {
      connects[i] = false;
      continue;
    }

    const curr = board[i]!;
    const next = board[i + 1]!;

    // Both are numbers - simple ascending check
    if (curr !== '★' && next !== '★') {
      connects[i] = (curr as number) <= (next as number);
    } else {
      // At least one is a joker - mark as connected for now
      connects[i] = true;
    }
  }

  // Step 2: Find joker positions that need break decisions
  // A joker needs a break decision when: before_joker >= after_joker
  for (let i = 0; i < 20; i++) {
    if (board[i] !== '★') continue;

    // Find the nearest numeric value before this joker (following connections backward)
    let beforeVal: number | null = null;
    let beforePos = -1;
    for (let k = i - 1; k >= 0; k--) {
      if (board[k] === null) break;
      if (board[k] !== '★') {
        beforeVal = board[k] as number;
        beforePos = k;
        break;
      }
    }

    // Find the nearest numeric value after this joker (following connections forward)
    let afterVal: number | null = null;
    let afterPos = -1;
    for (let k = i + 1; k < 20; k++) {
      if (board[k] === null) break;
      if (board[k] !== '★') {
        afterVal = board[k] as number;
        afterPos = k;
        break;
      }
    }

    // If both exist and NOT ascending (before >= after), we need to break somewhere
    if (beforeVal !== null && afterVal !== null && beforeVal >= afterVal) {
      // Calculate sequence length if joker connects to LEFT (before) side
      let leftLength = 1; // The joker itself
      // Count consecutive ascending going left from joker
      for (let k = i - 1; k >= 0 && board[k] !== null; k--) {
        if (k > 0 && board[k - 1] !== null && board[k] !== '★' && board[k - 1] !== '★') {
          if ((board[k - 1] as number) <= (board[k] as number)) {
            leftLength++;
          } else {
            leftLength++;
            break;
          }
        } else {
          leftLength++;
          if (board[k] !== '★') break;
        }
      }

      // Calculate sequence length if joker connects to RIGHT (after) side
      let rightLength = 1; // The joker itself
      // Count consecutive ascending going right from joker
      for (let k = i + 1; k < 20 && board[k] !== null; k++) {
        if (k < 19 && board[k + 1] !== null && board[k] !== '★' && board[k + 1] !== '★') {
          if ((board[k] as number) <= (board[k + 1] as number)) {
            rightLength++;
          } else {
            rightLength++;
            break;
          }
        } else {
          rightLength++;
          if (board[k] !== '★') break;
        }
      }

      // Break on the shorter side
      if (leftLength >= rightLength) {
        // Joker connects to left, break after joker
        if (i < 19) connects[i] = false;
      } else {
        // Joker connects to right, break before joker
        if (i > 0) connects[i - 1] = false;
      }
    }
  }

  // Step 3: Count sequences based on connection array
  let totalScore = 0;
  let i = 0;

  while (i < 20) {
    if (board[i] === null) {
      i++;
      continue;
    }

    let runLength = 1;
    while (i < 19 && connects[i]) {
      runLength++;
      i++;
    }

    totalScore += SCORE_TABLE[Math.min(runLength, SCORE_TABLE.length - 1)] || 0;
    i++;
  }

  return totalScore;
};

// Returns a Map where key = cellIndex, value = groupColorIndex (0, 1, 2...)
// Used for coloring distinct ascending sequences with alternating colors
export const getScoringGroups = (board: (number | string | null)[]) => {
  const groupMap = new Map<number, number>();

  // Use the same logic as calculatePlayerScore to determine connections
  const connects: boolean[] = new Array(20).fill(false);

  for (let i = 0; i < 19; i++) {
    if (board[i] === null || board[i + 1] === null) {
      connects[i] = false;
      continue;
    }

    const curr = board[i]!;
    const next = board[i + 1]!;

    if (curr !== '★' && next !== '★') {
      connects[i] = (curr as number) <= (next as number);
    } else {
      connects[i] = true;
    }
  }

  // Handle joker breaks
  for (let i = 0; i < 20; i++) {
    if (board[i] !== '★') continue;

    let beforeVal: number | null = null;
    for (let k = i - 1; k >= 0; k--) {
      if (board[k] === null) break;
      if (board[k] !== '★') {
        beforeVal = board[k] as number;
        break;
      }
    }

    let afterVal: number | null = null;
    for (let k = i + 1; k < 20; k++) {
      if (board[k] === null) break;
      if (board[k] !== '★') {
        afterVal = board[k] as number;
        break;
      }
    }

    if (beforeVal !== null && afterVal !== null && beforeVal >= afterVal) {
      let leftLength = 1;
      for (let k = i - 1; k >= 0 && board[k] !== null; k--) {
        if (k > 0 && board[k - 1] !== null && board[k] !== '★' && board[k - 1] !== '★') {
          if ((board[k - 1] as number) <= (board[k] as number)) {
            leftLength++;
          } else {
            leftLength++;
            break;
          }
        } else {
          leftLength++;
          if (board[k] !== '★') break;
        }
      }

      let rightLength = 1;
      for (let k = i + 1; k < 20 && board[k] !== null; k++) {
        if (k < 19 && board[k + 1] !== null && board[k] !== '★' && board[k + 1] !== '★') {
          if ((board[k] as number) <= (board[k + 1] as number)) {
            rightLength++;
          } else {
            rightLength++;
            break;
          }
        } else {
          rightLength++;
          if (board[k] !== '★') break;
        }
      }

      if (leftLength >= rightLength) {
        if (i < 19) connects[i] = false;
      } else {
        if (i > 0) connects[i - 1] = false;
      }
    }
  }

  // Build groups from connections
  let groupCounter = 0;
  let i = 0;

  while (i < 20) {
    if (board[i] === null) {
      i++;
      continue;
    }

    const currentSequence: number[] = [i];
    while (i < 19 && connects[i]) {
      i++;
      currentSequence.push(i);
    }

    // Only assign a group color if it's a scoring sequence (length >= 2)
    if (currentSequence.length >= 2) {
      currentSequence.forEach(idx => groupMap.set(idx, groupCounter));
      groupCounter++;
    }

    i++;
  }

  return groupMap;
};

export const getScoringIndices = (board: (number | string | null)[]) => {
    // Legacy support or simple boolean check
    const map = getScoringGroups(board);
    return new Set(map.keys());
}

export const checkGameEnd = (gameData: GameState) => {
  const safeTeams = Array.isArray(gameData.teams) ? gameData.teams : [];
  const teamsWithPlayers = safeTeams.filter(t => (Array.isArray(t.players) ? t.players : []).length > 0);

  // 20 rounds complete
  if (gameData.currentRound >= 20) {
    return true;
  }

  // All active boards full
  let allBoardsFull = true;
  for (let i = 0; i < teamsWithPlayers.length; i++) {
    const board = restoreBoardArray(teamsWithPlayers[i].board);
    for (let j = 0; j < board.length; j++) {
      if (board[j] === null) {
        allBoardsFull = false;
        break;
      }
    }
    if (!allBoardsFull) break;
  }

  return allBoardsFull;
};

export const calculateFinalRanking = (gameData: GameState) => {
  const safeTeams = Array.isArray(gameData.teams) ? gameData.teams : [];
  const teamsWithPlayers = safeTeams
    .filter(t => (Array.isArray(t.players) ? t.players : []).length > 0)
    .map(t => ({
      teamNumber: t.teamNumber,
      score: t.score,
      players: Array.isArray(t.players) ? t.players : []
    }));
  
  // Sort by score descending
  teamsWithPlayers.sort((a, b) => b.score - a.score);
  
  return teamsWithPlayers.map((t, index) => ({
    rank: index + 1,
    teamNumber: t.teamNumber,
    score: t.score,
    players: t.players
  }));
};
