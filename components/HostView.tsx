
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { GameState, Team } from '../types';
import { Panel, Button, Badge, Footer } from './UI';
import { Play, Trophy, Users, Activity, CheckCircle2, Eye, X, Gamepad2, ListOrdered, Dices, RotateCcw, AlertTriangle } from 'lucide-react';
import { createFullDeck, getScoringGroups, restoreBoardArray } from '../utils';

interface HostViewProps {
  game: GameState;
  onStartGame: () => void;
  onSelectNumber: (num: number | string, cardIndex: number) => void;
}

export const HostView: React.FC<HostViewProps> = ({ game, onStartGame, onSelectNumber }) => {
  // Ensure all arrays exist (Firebase may return objects instead of arrays)
  const gameTeams = Array.isArray(game.teams) ? game.teams : [];
  const safeUsedCardIndices = Array.isArray(game.usedCardIndices) ? game.usedCardIndices : [];
  const safeTeams = gameTeams.map(t => ({
    ...t,
    players: Array.isArray(t.players) ? t.players : [],
    board: restoreBoardArray(t.board)
  }));
  const activeTeams = safeTeams.filter(t => t.players.length > 0);
  const sortedTeams = [...activeTeams].sort((a, b) => b.score - a.score);
  
  // Sidebar Tab State
  const [activeTab, setActiveTab] = useState<'CONTROLS' | 'RANKING' | 'RANDOM_BOARD'>('CONTROLS');

  // Local state for the selected number value { value, index }
  const [pendingSelection, setPendingSelection] = useState<{val: number|string, idx: number} | null>(null);

  // State for Team Detail View Modal
  const [viewingTeam, setViewingTeam] = useState<Team | null>(null);

  // Random Number Board State
  const [revealedCovers, setRevealedCovers] = useState<Set<string>>(new Set());
  const [boardKey, setBoardKey] = useState(0);

  // Timer state for 1-minute placement timeout alert
  const [placementStartTime, setPlacementStartTime] = useState<number | null>(null);
  const [showTimeoutAlert, setShowTimeoutAlert] = useState(false);
  const prevWaitingRef = useRef(game.waitingForPlacements);

  // Calculate unplaced teams
  const unplacedTeams = useMemo(() => {
    if (!game.waitingForPlacements) return [];
    return activeTeams.filter(t => !t.hasPlacedCurrentNumber);
  }, [activeTeams, game.waitingForPlacements]);

  const allTeamsPlaced = useMemo(() => {
    return activeTeams.length > 0 && unplacedTeams.length === 0;
  }, [activeTeams, unplacedTeams]);

  // Effect to track placement start time and 1-minute timeout
  useEffect(() => {
    // When waitingForPlacements changes from false to true, start timer
    if (game.waitingForPlacements && !prevWaitingRef.current) {
      setPlacementStartTime(Date.now());
      setShowTimeoutAlert(false);
    }
    // When waitingForPlacements changes from true to false, reset timer
    if (!game.waitingForPlacements && prevWaitingRef.current) {
      setPlacementStartTime(null);
      setShowTimeoutAlert(false);
    }
    prevWaitingRef.current = game.waitingForPlacements;
  }, [game.waitingForPlacements]);

  // Effect for 1-minute timeout check
  useEffect(() => {
    if (!placementStartTime || !game.waitingForPlacements) return;

    const checkTimeout = () => {
      const elapsed = Date.now() - placementStartTime;
      if (elapsed >= 60000 && unplacedTeams.length > 0) {
        setShowTimeoutAlert(true);
      }
    };

    // Check immediately
    checkTimeout();

    // Check every second
    const intervalId = setInterval(checkTimeout, 1000);
    return () => clearInterval(intervalId);
  }, [placementStartTime, game.waitingForPlacements, unplacedTeams]);

  // Generate the full deck structure (Flat array of 40 items)
  const FULL_DECK = useMemo(() => createFullDeck(), []);

  // Generate shuffled numbers for the random board (1-10, 11-19, 11-19, 20-30, ★)
  const shuffledNumbers = useMemo(() => {
    const numbers: (number | string)[] = [];
    for (let i = 1; i <= 10; i++) numbers.push(i);
    for (let i = 11; i <= 19; i++) numbers.push(i);
    for (let i = 11; i <= 19; i++) numbers.push(i);
    for (let i = 20; i <= 30; i++) numbers.push(i);
    numbers.push('★');
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    return numbers;
  }, [boardKey]);

  // Grid labels (A1-H5)
  const gridLabels = useMemo(() => {
    const labels: string[] = [];
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    for (const row of rows) {
      for (let col = 1; col <= 5; col++) {
        labels.push(`${row}${col}`);
      }
    }
    return labels;
  }, []);

  // Random board handlers
  const handleRandomReveal = useCallback(() => {
    const unrevealed = gridLabels.filter(label => !revealedCovers.has(label));
    if (unrevealed.length === 0) return;
    const randomIndex = Math.floor(Math.random() * unrevealed.length);
    setRevealedCovers(prev => new Set([...prev, unrevealed[randomIndex]]));
  }, [gridLabels, revealedCovers]);

  const handleCoverClick = useCallback((label: string) => {
    if (revealedCovers.has(label)) return;
    setRevealedCovers(prev => new Set([...prev, label]));
  }, [revealedCovers]);

  const handleResetBoard = useCallback(() => {
    setRevealedCovers(new Set());
    setBoardKey(prev => prev + 1);
  }, []);

  const handleSubmitNumber = () => {
    if (pendingSelection !== null) {
      onSelectNumber(pendingSelection.val, pendingSelection.idx);
      setPendingSelection(null);
    }
  };

  const handleRandomSelect = () => {
    if (game.waitingForPlacements || game.gameEnded) return;
    
    // Find all available indices (0-39) that are NOT in game.usedCardIndices
    const availableIndices = FULL_DECK.map((_, idx) => idx).filter(
      idx => !safeUsedCardIndices.includes(idx)
    );

    if (availableIndices.length === 0) return;

    // Pick random index
    const randomIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    const val = FULL_DECK[randomIdx];
    
    setPendingSelection({ val, idx: randomIdx });
  };

  // Logic to determine which teams to display in the main grid (Top 8)
  const displayedTeams = useMemo(() => {
    if (!game.gameStarted) {
      const teamsToShow = activeTeams.length > 0 ? activeTeams : safeTeams;
      return teamsToShow.slice(0, 8);
    } else {
      return sortedTeams.slice(0, 8);
    }
  }, [safeTeams, game.gameStarted, activeTeams, sortedTeams]);

  // Determine grid layout based on team count
  const teamCount = displayedTeams.length;
  const useThreeColumns = teamCount > 4;

  const getGridStyle = (index: number) => {
    let colStart, rowStart;
    if (index < 8) {
      colStart = index + 1;
      rowStart = 1;
    } else if (index < 12) {
      colStart = 8;
      rowStart = (index - 8) + 2;
    } else {
      colStart = 8 - (index - 12);
      rowStart = 6;
    }
    return { gridColumnStart: colStart, gridRowStart: rowStart };
  };

  // Helper to get background color for scoring groups
  const getGroupColorClass = (groupId: number) => {
    const colors = [
      'bg-yellow-500/20 border-yellow-500/40',
      'bg-cyan-500/20 border-cyan-500/40', 
      'bg-pink-500/20 border-pink-500/40',
      'bg-purple-500/20 border-purple-500/40'
    ];
    return colors[groupId % colors.length];
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col space-y-4">
      
      {/* BRANDING HEADER */}
      <div className="w-full flex justify-center pb-4">
        <span className="text-2xl font-display font-bold text-cyan-600 dark:text-ai-primary neon-text tracking-wider uppercase border-b border-cyan-200 dark:border-ai-primary/30 pb-1">
          JJ Creative 교육연구소
        </span>
      </div>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
            AI vs <span className="text-cyan-600 dark:text-ai-primary">집단지성</span> <span className="text-xs align-top bg-cyan-100 text-cyan-700 dark:bg-ai-primary/20 dark:text-ai-primary px-2 py-1 rounded">ADMIN</span>
          </h1>
          <p className="text-gray-500 dark:text-ai-dim font-mono text-xs mt-1">COMPANY: {game.companyName}</p>
        </div>
        
        <div className="flex gap-4 p-2 glass-panel rounded-xl scale-90 origin-right shadow-sm">
           <Badge label="라운드" value={`${game.currentRound}/20`} />
           <Badge label="참가 팀" value={`${activeTeams.length}/${game.teamCount}`} color="text-purple-600 dark:text-ai-secondary" />
           <Badge label="상태" value={game.gameEnded ? "종료됨" : game.gameStarted ? "진행중" : "대기중"} color={game.gameStarted ? "text-green-600 dark:text-ai-success" : "text-gray-700 dark:text-white"} />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-180px)]">
        
        {/* Left Sidebar (Tabbed) */}
        <div className="lg:col-span-3 flex flex-col gap-2 min-h-0">
          <div className="flex p-1 bg-gray-200 dark:bg-white/5 rounded-lg border border-gray-300 dark:border-white/10 shrink-0">
            <button
              onClick={() => setActiveTab('CONTROLS')}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold rounded transition-all ${activeTab === 'CONTROLS' ? 'bg-cyan-600 text-white dark:bg-ai-primary dark:text-black' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'}`}
            >
              <Gamepad2 className="w-3 h-3" /> 컨트롤
            </button>
            <button
              onClick={() => setActiveTab('RANKING')}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold rounded transition-all ${activeTab === 'RANKING' ? 'bg-purple-600 text-white dark:bg-ai-secondary dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'}`}
            >
              <ListOrdered className="w-3 h-3" /> 순위
            </button>
            <button
              onClick={() => setActiveTab('RANDOM_BOARD')}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold rounded transition-all ${activeTab === 'RANDOM_BOARD' ? 'bg-pink-600 text-white dark:bg-ai-accent dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'}`}
            >
              <Dices className="w-3 h-3" /> 🎲숫자판
            </button>
          </div>

          <Panel className="flex-1 flex flex-col relative overflow-hidden min-h-0 p-4">
            {activeTab === 'CONTROLS' && (
              <div className="flex-1 flex flex-col h-full">
                {!game.gameStarted ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-full p-6 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                      <div className="w-16 h-16 bg-cyan-100 dark:bg-ai-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <Users className="w-8 h-8 text-cyan-600 dark:text-ai-primary" />
                      </div>
                      <p className="text-slate-800 dark:text-white font-bold text-lg mb-2">참가자 대기 중</p>
                      <p className="text-gray-500 dark:text-ai-dim text-sm">
                        현재 <span className="text-cyan-600 dark:text-ai-primary font-bold">{activeTeams.length}</span>개 팀이 준비되었습니다.
                      </p>
                    </div>

                    <div className="w-full pt-4 border-t border-gray-200 dark:border-white/10">
                      <Button 
                        onClick={onStartGame} 
                        disabled={activeTeams.length < 1} 
                        className="w-full py-4 text-lg shadow-lg shadow-cyan-500/20 dark:shadow-ai-primary/20"
                      >
                        <Play className="w-5 h-5" /> 게임 시작
                      </Button>
                    </div>
                  </div>
                ) : !game.gameEnded ? (
                  <div className="flex flex-col h-full overflow-hidden">
                    {/* Current Number Status */}
                    <div className="text-center p-2 bg-gray-900/5 dark:bg-black/40 rounded-xl border border-gray-200 dark:border-white/5 mb-2 shrink-0 flex items-center justify-between px-3">
                      <div className="text-left">
                          <span className="text-xs font-mono text-gray-600 dark:text-ai-dim uppercase tracking-wide block font-bold">현재 출제된 숫자</span>
                          {game.waitingForPlacements ? (
                            allTeamsPlaced ? (
                              <span className="text-green-600 dark:text-ai-success text-xs font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> 다음 출제 준비 완료
                              </span>
                            ) : (
                              <div className="flex flex-col">
                                <span className="text-amber-600 dark:text-amber-400 text-xs animate-pulse font-semibold flex items-center gap-1">
                                  배치 대기 중... ({unplacedTeams.length}팀 남음)
                                </span>
                                {showTimeoutAlert && unplacedTeams.length > 0 && (
                                  <span className="text-red-500 dark:text-red-400 text-[10px] font-bold flex items-center gap-1 mt-0.5">
                                    <AlertTriangle className="w-3 h-3" />
                                    {unplacedTeams.map(t => `${t.teamNumber}조`).join(', ')}
                                  </span>
                                )}
                              </div>
                            )
                          ) : (
                            <span className="text-green-600 dark:text-ai-success text-xs font-semibold">출제 가능</span>
                          )}
                      </div>
                      <div className="text-4xl font-display font-bold text-green-600 dark:text-ai-success neon-green-text">
                        {game.currentNumber || '-'}
                      </div>
                    </div>

                    {/* Number Selector Grid - 40 Cards */}
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                       <div className="flex justify-between items-center mb-1 shrink-0">
                          <p className="text-sm font-mono text-gray-600 dark:text-ai-dim font-bold">
                            <span>다음 숫자 선택</span>
                            <span className="text-purple-600 dark:text-ai-secondary ml-2">{pendingSelection ? `선택됨: ${pendingSelection.val}` : ''}</span>
                          </p>
                          <button
                             onClick={handleRandomSelect}
                             disabled={game.waitingForPlacements}
                             className="text-sm flex items-center gap-1 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 px-2 py-1 rounded text-purple-600 dark:text-ai-secondary font-bold transition-colors disabled:opacity-50"
                          >
                             <Dices className="w-4 h-4" /> 🎲 랜덤 선택
                          </button>
                       </div>

                       <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar grid grid-cols-5 gap-0.5 content-start">
                         {FULL_DECK.map((val, idx) => {
                           const isUsed = safeUsedCardIndices.includes(idx);
                           const isSelected = pendingSelection?.idx === idx;

                           return (
                             <button
                               key={idx}
                               onClick={() => !game.waitingForPlacements && !isUsed && setPendingSelection({ val, idx })}
                               disabled={game.waitingForPlacements || isUsed}
                               className={`
                                 aspect-[1/0.85] rounded text-sm font-mono font-bold transition-all border relative flex items-center justify-center
                                 ${isUsed
                                   ? 'bg-gray-200 dark:bg-black/40 border-gray-300 dark:border-white/5 text-gray-400 dark:text-gray-800 cursor-not-allowed'
                                   : isSelected
                                     ? 'bg-cyan-600 text-white dark:bg-ai-primary dark:text-black border-cyan-600 dark:border-ai-primary shadow-lg scale-105 z-10'
                                     : 'bg-white dark:bg-ai-primary/5 border-gray-200 dark:border-ai-primary/30 text-cyan-700 dark:text-ai-primary hover:bg-cyan-50 dark:hover:bg-ai-primary/20 hover:border-cyan-200 dark:hover:border-ai-primary'}
                               `}
                             >
                               {val}
                             </button>
                           );
                         })}
                       </div>

                       <div className="mt-1.5 pt-1.5 border-t border-gray-200 dark:border-white/10 shrink-0">
                         <button
                           onClick={handleSubmitNumber}
                           disabled={game.waitingForPlacements || pendingSelection === null}
                           className={`
                             w-full py-2.5 rounded-lg font-bold text-base shadow-lg transition-all flex items-center justify-center gap-2
                             ${game.waitingForPlacements || pendingSelection === null
                               ? 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed'
                               : 'bg-gradient-to-r from-blue-600 to-cyan-500 dark:to-ai-primary text-white hover:scale-[1.02] hover:shadow-cyan-500/30'}
                           `}
                         >
                           {game.waitingForPlacements
                             ? '배치 대기 중...'
                             : pendingSelection
                               ? '출제하기'
                               : '선택 필요'}
                         </button>
                       </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-center items-center text-center space-y-4">
                     <Trophy className="w-16 h-16 text-purple-500 dark:text-ai-secondary" />
                     <h3 className="text-2xl font-display font-bold text-slate-800 dark:text-white">게임 종료</h3>
                     <p className="text-gray-500 dark:text-ai-dim">우측 리더보드에서 최종 순위를 확인하세요.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'RANKING' && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-purple-600 dark:text-ai-secondary" /> 실시간 순위
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-ai-dim">총 {activeTeams.length}팀</span>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                  {sortedTeams.map((team, idx) => (
                    <div key={team.teamNumber} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded border border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 flex items-center justify-center rounded font-mono text-xs font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-500' : idx === 1 ? 'bg-gray-200 text-gray-600 dark:bg-gray-400/20 dark:text-gray-400' : idx === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-700/20 dark:text-orange-700' : 'text-gray-500 dark:text-gray-600'}`}>
                          {idx + 1}
                        </span>
                        <div>
                          <span className="text-sm text-slate-800 dark:text-gray-200 font-bold block">{team.teamNumber}조</span>
                          <span className="text-[10px] text-gray-500">{team.players.length}명</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-cyan-600 dark:text-ai-primary text-lg">{team.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'RANDOM_BOARD' && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Dices className="w-4 h-4 text-pink-600 dark:text-ai-accent" /> 🎲 랜덤 숫자 출제
                  </h3>
                  <span className="text-xs text-pink-600 dark:text-ai-accent font-bold">{revealedCovers.size}/40</span>
                </div>

                {/* Buttons */}
                <div className="flex gap-2 mb-3 shrink-0">
                  <button
                    onClick={handleRandomReveal}
                    disabled={revealedCovers.size >= 40}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-xs font-bold rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Dices className="w-4 h-4" /> 랜덤 출제
                  </button>
                  <button
                    onClick={handleResetBoard}
                    className="flex items-center justify-center gap-1 px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 text-gray-700 dark:text-white text-xs font-bold rounded-lg transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                {/* Team Placement Status */}
                {game.gameStarted && !game.gameEnded && game.waitingForPlacements && (
                  <div className={`mb-2 p-2 rounded-lg border text-xs font-bold shrink-0 ${
                    allTeamsPlaced
                      ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400'
                      : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400'
                  }`}>
                    {allTeamsPlaced ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> 다음 출제 준비 완료
                      </span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1">
                          배치 대기 중... ({unplacedTeams.length}팀 남음)
                        </span>
                        {showTimeoutAlert && unplacedTeams.length > 0 && (
                          <span className="text-red-500 dark:text-red-400 text-[10px] flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {unplacedTeams.map(t => `${t.teamNumber}조`).join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Board Grid */}
                <div className="flex-1 overflow-auto">
                  <div className="grid grid-cols-5 gap-1 p-2 bg-slate-900 dark:bg-black/60 rounded-xl">
                    {gridLabels.map((label, index) => {
                      const isRevealed = revealedCovers.has(label);
                      const number = shuffledNumbers[index];
                      const isJoker = number === '★';

                      return (
                        <button
                          key={label}
                          onClick={() => handleCoverClick(label)}
                          disabled={isRevealed}
                          className={`
                            aspect-square rounded-lg font-bold text-xs transition-all duration-300 transform
                            ${isRevealed
                              ? isJoker
                                ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg shadow-yellow-500/50 border border-yellow-300'
                                : 'bg-gradient-to-br from-green-400 to-emerald-600 text-white shadow-md border border-green-300'
                              : 'backdrop-blur-md bg-gradient-to-br from-amber-200/60 via-yellow-300/50 to-amber-400/60 hover:from-amber-300/70 hover:via-yellow-400/60 hover:to-amber-500/70 text-amber-900 cursor-pointer hover:scale-105 active:scale-95 border border-amber-300/80 shadow-lg shadow-amber-200/30'
                            }
                          `}
                        >
                          {isRevealed ? (
                            <span className={`text-lg font-black ${isJoker ? 'animate-pulse' : ''}`}>
                              {number}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold opacity-80">{label}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex justify-center gap-3 mt-2 pt-2 border-t border-gray-200 dark:border-white/10 shrink-0">
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-gradient-to-br from-amber-200 via-yellow-300 to-amber-400 border border-amber-300/50"></span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">미공개</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-gradient-to-br from-green-400 to-emerald-600"></span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">공개</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-gradient-to-br from-yellow-400 to-orange-500"></span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">조커</span>
                  </div>
                </div>
              </div>
            )}
          </Panel>
        </div>

        {/* Right Dashboard */}
        <div className="lg:col-span-9 flex flex-col gap-6 min-h-0">
          <Panel className="flex-1 overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-900/50">
             <div className="flex justify-between items-center mb-4 shrink-0">
               <h3 className="text-lg font-display font-bold text-slate-800 dark:text-white flex items-center gap-2">
                 <Activity className="w-5 h-5 text-purple-600 dark:text-ai-secondary" /> 실시간 보드 현황 
                 <span className="text-xs text-gray-500 dark:text-ai-dim font-normal ml-2">
                   (상위 8개 팀 표시됨)
                 </span>
               </h3>
               <div className="flex gap-4 text-xs font-mono text-gray-600 dark:text-gray-400">
                 <div className="flex items-center gap-2"><span className="w-3 h-3 bg-green-500 dark:bg-ai-success rounded-sm"></span>배치완료</div>
                 <div className="flex items-center gap-2"><span className="w-3 h-3 bg-purple-500/30 dark:bg-ai-secondary/30 rounded-sm"></span>점수획득(연속)</div>
               </div>
             </div>
             
             <div className="flex-1 overflow-y-auto custom-scrollbar">
               <div className={`grid gap-2 pb-2 ${useThreeColumns ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
                 {displayedTeams.map(team => {
                   const scoringGroups = getScoringGroups(team.board);

                   return (
                   <div key={team.teamNumber} className={`relative p-1.5 rounded-lg border transition-all ${team.hasPlacedCurrentNumber && game.waitingForPlacements ? 'bg-green-50 border-green-200 dark:bg-ai-success/5 dark:border-ai-success/30' : 'bg-gray-100 dark:bg-black/30 border-gray-200 dark:border-white/10'}`}>

                     <button
                       onClick={() => setViewingTeam(team)}
                       className="absolute top-1 right-1 p-1 bg-white/50 hover:bg-white dark:bg-white/10 dark:hover:bg-white/20 rounded-full z-20 text-gray-600 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors"
                     >
                        <Eye className="w-3 h-3" />
                     </button>

                     <div className={`w-full grid grid-cols-8 grid-rows-6 gap-0.5 relative ${useThreeColumns ? 'aspect-[8/5.5]' : 'aspect-[8/4.5]'}`}>

                        {/* Center Info */}
                        <div className="col-start-1 col-end-8 row-start-2 row-end-6 flex flex-col items-center justify-center p-1 z-0">
                           <div className="text-center w-full">
                              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                                <span className={`font-display font-bold text-slate-800 dark:text-white ${useThreeColumns ? 'text-xl' : 'text-2xl'}`}>{team.teamNumber}조</span>
                                <div className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-white/10 text-[10px] text-gray-600 dark:text-ai-dim">{team.players.length}명</div>
                              </div>

                              {/* FINAL SCORE LARGE DISPLAY IN CENTER */}
                              <div className="my-1">
                                <span className={`font-mono font-bold block leading-none ${game.gameEnded
                                  ? `${useThreeColumns ? 'text-4xl' : 'text-5xl'} text-cyan-600 dark:text-ai-primary dark:drop-shadow-[0_0_10px_rgba(0,242,255,0.8)]`
                                  : `${useThreeColumns ? 'text-3xl' : 'text-4xl'} text-purple-600 dark:text-ai-secondary`}`}>
                                  {team.score}<span className="text-sm ml-0.5">점</span>
                                </span>
                              </div>

                              <div className="flex flex-wrap justify-center gap-0.5 max-h-[24px] overflow-hidden px-1 opacity-70 dark:opacity-50">
                                {team.players.map(p => (
                                  <span key={p.id} className="text-[9px] text-gray-600 dark:text-gray-400 bg-white dark:bg-white/5 px-1 rounded truncate max-w-[50px] border border-gray-100 dark:border-none">{p.name}</span>
                                ))}
                              </div>

                              {team.hasPlacedCurrentNumber && game.waitingForPlacements && (
                                <div className="mt-0.5 flex items-center justify-center text-green-600 dark:text-ai-success text-[10px] font-bold gap-0.5 animate-pulse">
                                  <CheckCircle2 className="w-3 h-3" /> 배치완료
                                </div>
                              )}
                           </div>
                        </div>

                        {/* Cells */}
                        {restoreBoardArray(team.board).map((cell, cIdx) => {
                           const style = getGridStyle(cIdx);
                           const isFilled = cell !== null;
                           const groupID = scoringGroups.get(cIdx);
                           const isScoring = groupID !== undefined;

                           // Alternating Colors for Scoring Groups
                           const colorClass = isScoring ? getGroupColorClass(groupID) : 'bg-white dark:bg-black/60 border-gray-300 dark:border-white/20 text-slate-900 dark:text-white shadow-sm dark:shadow-none';

                           return (
                             <div
                               key={cIdx}
                               style={style}
                               className={`
                                 relative rounded flex items-center justify-center font-bold z-10 overflow-hidden
                                 ${isFilled
                                   ? colorClass
                                   : 'bg-gray-200 dark:bg-[#0a0a0f] border-gray-300 dark:border-white/30'}
                                 border
                               `}
                             >
                               {isFilled && (
                                 <span className={`font-black neon-green-text ${useThreeColumns ? 'text-base' : 'text-lg'}`}>{cell}</span>
                               )}
                               {!isFilled && (
                                 <span className={`text-gray-400 dark:text-white/50 font-display ${useThreeColumns ? 'text-xs' : 'text-sm'}`}>{cIdx + 1}</span>
                               )}
                             </div>
                           );
                        })}
                     </div>
                   </div>
                 )})}
               </div>
             </div>
          </Panel>
        </div>
      </div>

      <Footer />

      {/* TEAM DETAIL MODAL */}
      {viewingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-4xl bg-white dark:bg-[#0a0a0f] border border-cyan-500/20 dark:border-ai-primary/20 rounded-2xl shadow-2xl p-6 relative">
            <button 
              onClick={() => setViewingTeam(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-red-500 dark:hover:text-white"
            >
              <X className="w-8 h-8" />
            </button>

            <div className="flex items-center gap-4 mb-6">
               <h2 className="text-3xl font-bold text-slate-800 dark:text-white">{viewingTeam.teamNumber}조 상세 보기</h2>
               <span className="text-4xl font-mono text-purple-600 dark:text-ai-secondary">{viewingTeam.score}점</span>
            </div>

            <div className="w-full aspect-[8/6] grid grid-cols-8 grid-rows-6 gap-2 bg-gray-100 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-white/10">
                <div className="col-start-1 col-end-8 row-start-2 row-end-6 flex flex-col items-center justify-center p-4 z-0">
                    <div className="text-center">
                      <p className="text-gray-500 dark:text-ai-dim mb-2">팀원 명단</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {(Array.isArray(viewingTeam.players) ? viewingTeam.players : []).map(p => (
                          <span key={p.id} className="px-2 py-1 bg-white dark:bg-white/10 rounded text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-transparent">{p.name}</span>
                        ))}
                      </div>
                    </div>
                </div>

                {restoreBoardArray(viewingTeam.board).map((cell, idx) => {
                   const style = getGridStyle(idx);
                   const isFilled = cell !== null;
                   const viewingBoard = restoreBoardArray(viewingTeam.board);
                   const groupID = getScoringGroups(viewingBoard).get(idx);
                   const isScoring = groupID !== undefined;
                   const colorClass = isScoring ? getGroupColorClass(groupID) : 'bg-white dark:bg-black/60 border-gray-300 dark:border-white/20 text-slate-900 dark:text-white';

                   return (
                     <div 
                       key={idx} 
                       style={style}
                       className={`
                         relative rounded-lg flex items-center justify-center font-bold z-10 overflow-hidden
                         ${isFilled 
                           ? colorClass
                           : 'bg-gray-200 dark:bg-[#0a0a0f] border-gray-300 dark:border-white/30'}
                         ${isFilled ? 'border-2' : 'border'}
                       `}
                     >
                       {isFilled && (
                         <span className="text-4xl font-black neon-green-text">{cell}</span>
                       )}
                       {!isFilled && (
                         <span className="text-gray-400 dark:text-white/50 font-display text-lg">{idx + 1}</span>
                       )}
                     </div>
                   );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
