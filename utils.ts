
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

// Helper for scoring
const isAscendingOrder = (current: number | string, next: number | string) => {
  if (current === '★' || next === '★') {
    return true;
  }
  
  const currentNum = typeof current === 'number' ? current : parseFloat(current);
  const nextNum = typeof next === 'number' ? next : parseFloat(next);
  
  return currentNum <= nextNum;
};

export const calculatePlayerScore = (board: (number | string | null)[]) => {
  const SCORE_TABLE = [0, 0, 1, 3, 5, 7, 9, 11, 15, 20, 25, 30, 35, 40, 50, 60, 70, 85, 100, 150, 300];
  let totalScore = 0;
  let i = 0;
  
  while (i < 20) {
    if (board[i] === null) {
      i++;
      continue;
    }
    
    let runLength = 1;
    while (i + 1 < 20 && 
           board[i + 1] !== null && 
           isAscendingOrder(board[i]!, board[i + 1]!)) {
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
  let i = 0;
  let groupCounter = 0;
  
  while (i < 20) {
    if (board[i] === null) {
      i++;
      continue;
    }
    
    let runLength = 1;
    let currentSequence = [i];
    
    // Check forward for sequence
    let tempI = i;
    while (tempI + 1 < 20 && 
           board[tempI + 1] !== null && 
           isAscendingOrder(board[tempI]!, board[tempI + 1]!)) {
      runLength++;
      tempI++;
      currentSequence.push(tempI);
    }
    
    // Only assign a group color if it's a scoring sequence (length >= 2)
    // Or we can color single numbers too if desired, but request implies "continuous ascending"
    if (runLength >= 2) {
      currentSequence.forEach(idx => groupMap.set(idx, groupCounter));
      groupCounter++; 
    }
    
    // Move main iterator
    i = tempI + 1;
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
