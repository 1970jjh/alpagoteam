
import React, { useState, useEffect } from 'react';
import { GameState, Team, Player } from '../types';
import { Panel, Button, Footer } from './UI';
import { Wifi, Check, Lock, MousePointerClick } from 'lucide-react';
import { getScoringGroups, restoreBoardArray } from '../utils';

interface PlayerViewProps {
  game: GameState;
  team: Team; 
  me: Player;
  onPlaceNumber: (idx: number) => void;
}

export const PlayerView: React.FC<PlayerViewProps> = ({ game, team: myTeam, me, onPlaceNumber }) => {
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);

  // Safety: Ensure myTeam has all required properties (Firebase may return objects instead of arrays)
  const safeMyTeam = {
    ...myTeam,
    players: Array.isArray(myTeam?.players) ? myTeam.players : [],
    board: restoreBoardArray(myTeam?.board),
    teamNumber: myTeam?.teamNumber ?? 1,
    score: myTeam?.score ?? 0,
    hasPlacedCurrentNumber: myTeam?.hasPlacedCurrentNumber ?? false,
    placedBy: myTeam?.placedBy ?? null
  };

  useEffect(() => {
    setPendingIndex(null);
  }, [game.currentRound, safeMyTeam.hasPlacedCurrentNumber]);

  // Ensure all teams have players and board arrays (Firebase may return objects instead of arrays)
  const gameTeams = Array.isArray(game.teams) ? game.teams : [];
  const safeTeams = gameTeams.map((t, idx) => ({
    ...t,
    players: Array.isArray(t.players) ? t.players : [],
    board: restoreBoardArray(t.board),
    hasPlacedCurrentNumber: t.hasPlacedCurrentNumber ?? false,
    // Ensure teamNumber is a number (Firebase may convert to string)
    teamNumber: Number(t.teamNumber) || (idx + 1)
  }));

  // Use Number() for comparison to handle type mismatch from Firebase
  const myTeamNum = Number(safeMyTeam.teamNumber);
  const sortedTeams = [...safeTeams].sort((a, b) => {
    if (a.teamNumber === myTeamNum) return -1;
    if (b.teamNumber === myTeamNum) return 1;
    return a.teamNumber - b.teamNumber;
  });

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

  const getGroupColorClass = (groupId: number) => {
    const colors = [
      'bg-yellow-500/20 border-yellow-500/40',
      'bg-cyan-500/20 border-cyan-500/40', 
      'bg-pink-500/20 border-pink-500/40',
      'bg-purple-500/20 border-purple-500/40'
    ];
    return colors[groupId % colors.length];
  };

  const SCORE_TABLE_DATA = [
    { len: 1, pts: 0 }, { len: 11, pts: 30 },
    { len: 2, pts: 1 }, { len: 12, pts: 35 },
    { len: 3, pts: 3 }, { len: 13, pts: 40 },
    { len: 4, pts: 5 }, { len: 14, pts: 50 },
    { len: 5, pts: 7 }, { len: 15, pts: 60 },
    { len: 6, pts: 9 }, { len: 16, pts: 70 },
    { len: 7, pts: 11 }, { len: 17, pts: 85 },
    { len: 8, pts: 15 }, { len: 18, pts: 100 },
    { len: 9, pts: 20 }, { len: 19, pts: 150 },
    { len: 10, pts: 25 }, { len: 20, pts: 300 },
  ];

  return (
    <div className="min-h-screen pb-24 flex flex-col transition-colors duration-300">
      <div className="sticky top-0 z-50 bg-white/95 dark:bg-[#050508]/95 backdrop-blur-lg border-b border-gray-200 dark:border-glass-border px-4 py-3 shadow-md dark:shadow-2xl">
        {/* BRANDING HEADER */}
        <div className="w-full flex justify-center pb-2">
            <span className="text-xl font-display font-bold text-cyan-600 dark:text-ai-primary neon-text tracking-wider uppercase">JJ Creative 교육연구소</span>
        </div>
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-green-600 dark:text-ai-success animate-pulse" />
            <span className="font-display font-bold text-slate-900 dark:text-white text-lg">
                {safeMyTeam.teamNumber}조 <span className="text-xs font-normal text-gray-500 dark:text-ai-dim">(나의 팀)</span>
            </span>
            </div>
            <div className="text-right">
            <span className="block text-[10px] text-gray-500 dark:text-ai-dim font-mono uppercase">내 점수</span>
            <span className="font-mono font-bold text-purple-600 dark:text-ai-secondary text-xl">{safeMyTeam.score}</span>
            </div>
        </div>
      </div>

      <div className="p-4 space-y-8 max-w-3xl mx-auto flex-1 w-full">
        {!game.gameStarted ? (
          <Panel className="text-center py-10 space-y-4 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10">
             <div className="w-16 h-16 bg-gray-200 dark:bg-white/5 rounded-full mx-auto flex items-center justify-center animate-pulse">
               <Lock className="w-6 h-6 text-gray-500 dark:text-ai-dim" />
             </div>
             <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white">게임 대기 중</h3>
             <p className="text-gray-500 dark:text-ai-dim text-sm">호스트가 게임을 시작할 때까지 잠시만 기다려주세요.</p>
          </Panel>
        ) : (
           <Panel className="relative overflow-hidden border-cyan-200 dark:border-ai-primary/30 text-center bg-gradient-to-b from-cyan-50 to-transparent dark:from-ai-primary/5 dark:to-transparent">
              <p className="text-xs font-mono text-cyan-600 dark:text-ai-primary uppercase tracking-[0.2em] mb-2">현재 숫자</p>
              {game.currentNumber ? (
                <div className="text-7xl font-display font-bold text-green-600 dark:text-ai-success neon-green-text drop-shadow-xl">{game.currentNumber}</div>
              ) : (
                <div className="text-4xl font-mono text-gray-400 dark:text-gray-600 animate-pulse">대기중...</div>
              )}
              
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/10">
                {safeMyTeam.hasPlacedCurrentNumber ? (
                  <div className="flex items-center justify-center gap-2 text-green-700 dark:text-ai-success bg-green-100 dark:bg-ai-success/10 py-2 rounded-lg">
                    <Check className="w-5 h-5" />
                    <span className="font-bold text-sm">배치 완료! 다음 숫자를 기다리세요</span>
                  </div>
                ) : game.currentNumber ? (
                  <p className="text-red-500 dark:text-ai-accent font-bold animate-pulse text-sm">팀원들과 상의하여 위치를 선택하세요!</p>
                ) : (
                  <p className="text-gray-500 dark:text-ai-dim text-sm">다음 숫자를 기다리는 중...</p>
                )}
              </div>
            </Panel>
        )}

        {sortedTeams.map((team) => {
          const isMyTeam = team.teamNumber === myTeamNum;
          // For my team, prefer props data (safeMyTeam) over game.teams data due to Firebase sync timing
          const teamBoard = isMyTeam ? safeMyTeam.board : restoreBoardArray(team.board);
          const teamPlayers = isMyTeam ? safeMyTeam.players : (Array.isArray(team.players) ? team.players : []);
          const scoringGroups = getScoringGroups(teamBoard);

          // Debug info for my team
          const debugInfo = {
            isMyTeam,
            myTeamNum,
            teamNum: team.teamNumber,
            currentNum: game.currentNumber,
            hasPlaced: safeMyTeam.hasPlacedCurrentNumber,
            gameEnded: game.gameEnded,
            emptyCells: teamBoard.filter(c => c === null).length
          };

          return (
            <div key={team.teamNumber} className={`relative transition-all duration-500 ${isMyTeam ? 'opacity-100 scale-100' : 'opacity-80 scale-95 grayscale-[0.3]'}`}>
              {/* DEBUG INFO - 항상 첫번째 팀에 표시 */}
              {debugInfo && sortedTeams.indexOf(team) === 0 && (
                <div className="mb-2 p-2 bg-red-900/80 text-white text-[10px] font-mono rounded border border-red-500">
                  <div>🔍 DEBUG: isMyTeam={String(debugInfo.isMyTeam)} | myTeamNum={debugInfo.myTeamNum} | teamNum={debugInfo.teamNum}</div>
                  <div>currentNum={String(debugInfo.currentNum)} (type:{typeof debugInfo.currentNum}) | hasPlaced={String(debugInfo.hasPlaced)} | gameEnded={String(debugInfo.gameEnded)}</div>
                  <div>emptyCells={debugInfo.emptyCells} | canInteract조건: {debugInfo.isMyTeam && debugInfo.currentNum !== null && !debugInfo.hasPlaced && !debugInfo.gameEnded ? '✅ OK' : '❌ FAIL'}</div>
                  <div>safeMyTeam.teamNumber={safeMyTeam.teamNumber} | props myTeam.teamNumber={String(myTeam?.teamNumber)}</div>
                </div>
              )}
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <div className={`px-2 py-1 rounded text-xs font-bold ${isMyTeam ? 'bg-cyan-600 text-white dark:bg-ai-primary dark:text-black' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {team.teamNumber}조
                  </div>
                  {!isMyTeam && <span className="text-xs text-gray-500">관전 모드</span>}
                </div>
                <div className="text-xs font-mono text-gray-400">
                  {teamPlayers.length}명 참여 • <span className={`${isMyTeam ? 'text-purple-600 dark:text-ai-secondary' : 'text-gray-500'} font-bold`}>{team.score}점</span>
                </div>
              </div>

              <div className={`
                w-full aspect-[8/6] relative rounded-xl border p-2 shadow-sm
                ${isMyTeam ? 'bg-white dark:bg-slate-900 border-cyan-200 dark:border-ai-primary/20 shadow-lg dark:shadow-[0_0_30px_rgba(0,0,0,0.5)]' : 'bg-gray-100 dark:bg-black/40 border-gray-200 dark:border-white/5'}
              `}>
                 <div className="grid grid-cols-8 grid-rows-6 gap-1 h-full">
                   
                   <div className="col-start-1 col-end-8 row-start-2 row-end-6 flex flex-row items-stretch justify-between p-2 z-0 overflow-hidden gap-2">
                      
                      {/* Score Table: Increased vertical spacing/height, larger font, same width */}
                      <div className="w-[45%] flex flex-col justify-center overflow-y-auto custom-scrollbar border-r border-gray-200 dark:border-white/5 pr-2">
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                          {SCORE_TABLE_DATA.map(d => (
                            <div key={d.len} className="flex justify-between items-center text-[10px] sm:text-xs md:text-sm bg-gray-50 dark:bg-white/5 px-2 py-1 rounded border-l-2 border-cyan-200 dark:border-ai-primary/50">
                              <span className="text-gray-500 dark:text-gray-400">{d.len}칸</span>
                              <span className="font-bold text-green-600 dark:text-ai-success ml-1">+{d.pts}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col items-center justify-center text-center">
                         <h2 className={`text-4xl sm:text-5xl font-display font-bold ${isMyTeam ? 'text-gray-200 dark:text-white/10' : 'text-gray-200 dark:text-white/5'}`}>{team.teamNumber}조</h2>
                         
                         {/* GAME END BIG SCORE */}
                         {game.gameEnded && (
                            <div className="my-2 animate-pulse-slow">
                              <span className="text-6xl font-black text-cyan-600 dark:text-ai-primary dark:drop-shadow-[0_0_20px_rgba(0,242,255,0.6)] leading-none">
                                {team.score}
                              </span>
                              <span className="text-lg text-gray-500 dark:text-ai-dim block">FINAL SCORE</span>
                            </div>
                         )}

                         {isMyTeam && team.placedBy && team.hasPlacedCurrentNumber && !game.gameEnded && (
                           <div className="mt-1 px-2 py-1 bg-green-100 text-green-700 dark:bg-ai-success/20 rounded text-[10px] dark:text-ai-success flex items-center gap-1 justify-center w-full">
                              <Check className="w-3 h-3" /> 
                              <span className="truncate">{team.placedBy === me.name ? '나' : team.placedBy}</span>
                           </div>
                         )}
                         <div className="mt-2 flex flex-wrap justify-center gap-1.5 opacity-60 max-h-[80px] overflow-y-auto custom-scrollbar w-full">
                            {teamPlayers.map(p => (
                               <span key={p.id} className="text-[10px] bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300 truncate max-w-[80px]">{p.name}</span>
                            ))}
                         </div>
                      </div>
                   </div>

                   {teamBoard.map((cell, index) => {
                     const isFilled = cell !== null;
                     const groupID = scoringGroups.get(index);
                     const isScoring = groupID !== undefined;

                     // For my team, use safeMyTeam.hasPlacedCurrentNumber (from props) which is more reliable
                     // than team.hasPlacedCurrentNumber (from game.teams) due to Firebase sync timing
                     const hasPlacedNumber = isMyTeam ? safeMyTeam.hasPlacedCurrentNumber : team.hasPlacedCurrentNumber;
                     const canInteract = isMyTeam && !isFilled && game.currentNumber !== null && !hasPlacedNumber && !game.gameEnded;
                     const isSelected = pendingIndex === index;
                     const style = getGridStyle(index);

                     // Sequence Coloring Logic
                     const colorClass = isScoring ? getGroupColorClass(groupID) : 'bg-white dark:bg-black/60 border-gray-300 dark:border-white/20 text-slate-900 dark:text-white shadow-sm dark:shadow-none';

                     return (
                       <button
                         key={index}
                         style={style}
                         disabled={!canInteract}
                         onClick={() => {
                           if (canInteract) {
                             setPendingIndex(index);
                           }
                         }}
                         className={`
                           relative rounded-md flex items-center justify-center transition-all duration-200 z-10 overflow-hidden
                           ${isFilled 
                             ? colorClass
                             : canInteract 
                               ? isSelected 
                                 ? 'bg-cyan-100 dark:bg-ai-primary/20 border-cyan-500 dark:border-ai-primary shadow-lg dark:shadow-[0_0_15px_rgba(0,242,255,0.4)] scale-105 z-20' 
                                 : 'bg-gray-200 dark:bg-black/40 border-gray-300 dark:border-white/30 hover:bg-white dark:hover:bg-white/10 hover:border-cyan-400 dark:hover:border-white/50 cursor-pointer' 
                               : 'bg-gray-100 dark:bg-[#0a0a0f] border-gray-200 dark:border-white/10 opacity-50' 
                           }
                           ${isFilled ? 'border-2' : 'border'}
                         `}
                       >
                         {!isFilled && !isSelected && (
                           <span className={`font-display font-bold text-lg ${canInteract ? 'text-gray-400 dark:text-white/40' : 'text-gray-300 dark:text-white/20'}`}>
                             {index + 1}
                           </span>
                         )}
                         
                         {!isFilled && isSelected && (
                            <span className="text-cyan-600 dark:text-ai-primary font-bold text-xs animate-pulse">선택</span>
                         )}

                         {isFilled && (
                           <span className={`text-3xl font-black neon-green-text drop-shadow-md z-20 ${isScoring ? 'scale-110' : ''}`}>{cell}</span>
                         )}
                       </button>
                     );
                   })}
                 </div>
              </div>
            </div>
          );
        })}
        
        {game.gameEnded && (
           <div className="fixed bottom-0 left-0 w-full p-6 bg-white/90 dark:bg-black/90 backdrop-blur border-t border-purple-200 dark:border-ai-secondary/50 text-center z-50">
             <h2 className="text-xl text-slate-900 dark:text-white font-bold mb-2">게임 종료!</h2>
             <p className="text-gray-500 dark:text-ai-dim text-sm">관리자 화면에서 최종 결과를 확인하세요.</p>
           </div>
        )}
      </div>

      <Footer />

      {pendingIndex !== null && !safeMyTeam.hasPlacedCurrentNumber && game.currentNumber !== null && (
         <div className="fixed bottom-6 left-0 w-full px-6 z-50 animate-bounce-in">
            <Button 
               variant="primary" 
               className="w-full max-w-md mx-auto py-4 text-lg shadow-2xl border-2 border-cyan-500 dark:border-ai-primary"
               onClick={() => {
                 onPlaceNumber(pendingIndex);
                 setPendingIndex(null);
               }}
            >
              <MousePointerClick className="w-5 h-5" />
              {pendingIndex + 1}번 칸에 배치 확정
            </Button>
         </div>
      )}
    </div>
  );
};
