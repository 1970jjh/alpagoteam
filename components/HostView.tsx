
import React, { useState, useMemo } from 'react';
import { GameState, Team } from '../types';
import { Panel, Button, Badge, Footer } from './UI';
import { Play, Trophy, Users, Activity, CheckCircle2, Eye, X, Gamepad2, ListOrdered, Dices } from 'lucide-react';
import { createFullDeck, getScoringGroups } from '../utils';

interface HostViewProps {
  game: GameState;
  onStartGame: () => void;
  onSelectNumber: (num: number | string, cardIndex: number) => void;
}

export const HostView: React.FC<HostViewProps> = ({ game, onStartGame, onSelectNumber }) => {
  // Ensure all arrays exist (Firebase doesn't store empty arrays)
  const gameTeams = game.teams || [];
  const safeUsedCardIndices = game.usedCardIndices || [];
  const safeTeams = gameTeams.map(t => ({
    ...t,
    players: t.players || [],
    board: t.board || Array(20).fill(null)
  }));
  const activeTeams = safeTeams.filter(t => t.players.length > 0);
  const sortedTeams = [...activeTeams].sort((a, b) => b.score - a.score);
  
  // Sidebar Tab State
  const [activeTab, setActiveTab] = useState<'CONTROLS' | 'RANKING'>('CONTROLS');
  
  // Local state for the selected number value { value, index }
  const [pendingSelection, setPendingSelection] = useState<{val: number|string, idx: number} | null>(null);
  
  // State for Team Detail View Modal
  const [viewingTeam, setViewingTeam] = useState<Team | null>(null);

  // Generate the full deck structure (Flat array of 40 items)
  const FULL_DECK = useMemo(() => createFullDeck(), []);

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
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded transition-all ${activeTab === 'CONTROLS' ? 'bg-cyan-600 text-white dark:bg-ai-primary dark:text-black' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'}`}
            >
              <Gamepad2 className="w-4 h-4" /> 🎮 컨트롤
            </button>
            <button 
              onClick={() => setActiveTab('RANKING')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded transition-all ${activeTab === 'RANKING' ? 'bg-purple-600 text-white dark:bg-ai-secondary dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'}`}
            >
              <ListOrdered className="w-4 h-4" /> 🏆 순위
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
                    <div className="text-center p-2 bg-gray-900/5 dark:bg-black/40 rounded-xl border border-gray-200 dark:border-white/5 mb-3 shrink-0 flex items-center justify-between px-4">
                      <div className="text-left">
                          <span className="text-[10px] font-mono text-gray-500 dark:text-ai-dim uppercase tracking-[0.2em] block">현재 출제된 숫자</span>
                          {game.waitingForPlacements ? (
                            <span className="text-red-500 dark:text-ai-accent text-[10px] animate-pulse">배치 대기 중...</span>
                          ) : (
                            <span className="text-green-600 dark:text-ai-success text-[10px]">출제 가능</span>
                          )}
                      </div>
                      <div className="text-4xl font-display font-bold text-green-600 dark:text-ai-success neon-green-text">
                        {game.currentNumber || '-'}
                      </div>
                    </div>

                    {/* Number Selector Grid - 40 Cards */}
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                       <div className="flex justify-between items-center mb-1 shrink-0">
                          <p className="text-xs font-mono text-gray-500 dark:text-ai-dim uppercase">
                            <span>다음 숫자 선택</span>
                            <span className="text-slate-900 dark:text-white ml-2">{pendingSelection ? `선택됨: ${pendingSelection.val}` : ''}</span>
                          </p>
                          <button 
                             onClick={handleRandomSelect}
                             disabled={game.waitingForPlacements}
                             className="text-xs flex items-center gap-1 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 px-2 py-1 rounded text-purple-600 dark:text-ai-secondary font-bold transition-colors disabled:opacity-50"
                          >
                             <Dices className="w-3 h-3" /> 🎲 랜덤 선택
                          </button>
                       </div>

                       <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar grid grid-cols-5 gap-1 content-start">
                         {FULL_DECK.map((val, idx) => {
                           const isUsed = safeUsedCardIndices.includes(idx);
                           const isSelected = pendingSelection?.idx === idx;
                           
                           return (
                             <button
                               key={idx}
                               onClick={() => !game.waitingForPlacements && !isUsed && setPendingSelection({ val, idx })}
                               disabled={game.waitingForPlacements || isUsed}
                               className={`
                                 aspect-square rounded-md text-xs sm:text-sm font-mono font-bold transition-all border relative flex items-center justify-center
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
                       
                       <div className="mt-2 pt-2 border-t border-gray-200 dark:border-white/10 shrink-0">
                         <button
                           onClick={handleSubmitNumber}
                           disabled={game.waitingForPlacements || pendingSelection === null}
                           className={`
                             w-full py-3 rounded-lg font-bold text-base shadow-lg transition-all flex items-center justify-center gap-2
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
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                 {displayedTeams.map(team => {
                   const scoringGroups = getScoringGroups(team.board);

                   return (
                   <div key={team.teamNumber} className={`relative p-4 rounded-xl border transition-all ${team.hasPlacedCurrentNumber && game.waitingForPlacements ? 'bg-green-50 border-green-200 dark:bg-ai-success/5 dark:border-ai-success/30' : 'bg-gray-100 dark:bg-black/30 border-gray-200 dark:border-white/10'}`}>
                     
                     <button 
                       onClick={() => setViewingTeam(team)}
                       className="absolute top-2 right-2 p-2 bg-white/50 hover:bg-white dark:bg-white/10 dark:hover:bg-white/20 rounded-full z-20 text-gray-600 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors"
                     >
                        <Eye className="w-4 h-4" />
                     </button>

                     <div className="w-full aspect-[8/6] grid grid-cols-8 grid-rows-6 gap-1 relative">
                        
                        {/* Center Info */}
                        <div className="col-start-1 col-end-8 row-start-2 row-end-6 flex flex-col items-center justify-center p-2 z-0">
                           <div className="text-center w-full">
                              <div className="flex items-center justify-center gap-2 mb-1">
                                <span className="font-display font-bold text-slate-800 dark:text-white text-xl">{team.teamNumber}조</span>
                                <div className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-white/10 text-[10px] text-gray-600 dark:text-ai-dim">{team.players.length}명</div>
                              </div>
                              
                              {/* FINAL SCORE LARGE DISPLAY IN CENTER */}
                              <div className="my-2">
                                <span className={`font-mono font-bold block leading-none ${game.gameEnded ? 'text-5xl text-cyan-600 dark:text-ai-primary dark:drop-shadow-[0_0_10px_rgba(0,242,255,0.8)]' : 'text-2xl text-purple-600 dark:text-ai-secondary'}`}>
                                  {team.score}<span className="text-sm ml-1">점</span>
                                </span>
                              </div>

                              <div className="flex flex-wrap justify-center gap-1 max-h-[30px] overflow-hidden px-2 opacity-70 dark:opacity-50">
                                {team.players.map(p => (
                                  <span key={p.id} className="text-[9px] text-gray-600 dark:text-gray-400 bg-white dark:bg-white/5 px-1 rounded truncate max-w-[50px] border border-gray-100 dark:border-none">{p.name}</span>
                                ))}
                              </div>

                              {team.hasPlacedCurrentNumber && game.waitingForPlacements && (
                                <div className="mt-1 flex items-center justify-center text-green-600 dark:text-ai-success text-[10px] font-bold gap-1 animate-pulse">
                                  <CheckCircle2 className="w-3 h-3" /> 배치완료
                                </div>
                              )}
                           </div>
                        </div>

                        {/* Cells */}
                        {(team.board || Array(20).fill(null)).map((cell, cIdx) => {
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
                                 relative rounded flex items-center justify-center text-sm font-bold z-10 overflow-hidden
                                 ${isFilled 
                                   ? colorClass
                                   : 'bg-gray-200 dark:bg-[#0a0a0f] border-gray-300 dark:border-white/30'}
                                 ${isFilled ? 'border-2' : 'border'}
                               `}
                             >
                               {isFilled && (
                                 <span className="text-xl font-black neon-green-text">{cell}</span>
                               )}
                               {!isFilled && (
                                 <span className="text-gray-400 dark:text-white/50 font-display text-xs">{cIdx + 1}</span>
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
                        {(viewingTeam.players || []).map(p => (
                          <span key={p.id} className="px-2 py-1 bg-white dark:bg-white/10 rounded text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-transparent">{p.name}</span>
                        ))}
                      </div>
                    </div>
                </div>

                {(viewingTeam.board || Array(20).fill(null)).map((cell, idx) => {
                   const style = getGridStyle(idx);
                   const isFilled = cell !== null;
                   const viewingBoard = viewingTeam.board || Array(20).fill(null);
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
