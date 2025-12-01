
import React, { useState } from 'react';
import { Member, AccessLog } from '../types';
import { Panel, Button, Input } from './UI';
import { UserPlus, Shield, Clock, FileText, Search, UserCheck, Trash2, CalendarPlus, RefreshCcw, X } from 'lucide-react';

interface AdminDashboardProps {
  members: Member[];
  logs: AccessLog[];
  onRegisterMember: (name: string, email: string, phone: string) => void;
  onDeleteMember: (id: string) => void;
  onExtendMember: (id: string) => void;
  onRenewMember: (id: string) => void;
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  members, logs, onRegisterMember, onDeleteMember, onExtendMember, onRenewMember, onClose
}) => {
  // Safety: Ensure arrays are always valid (Firebase may return undefined)
  const safeMembers = Array.isArray(members) ? members : [];
  const safeLogs = Array.isArray(logs) ? logs : [];

  const [activeTab, setActiveTab] = useState<'MEMBERS' | 'LOGS'>('MEMBERS');
  
  // Form State
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const handleRegister = () => {
    if (!newName || !newEmail || !newPhone) {
      alert("모든 필드를 입력해주세요.");
      return;
    }
    onRegisterMember(newName, newEmail, newPhone);
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    alert("회원이 성공적으로 등록되었습니다.");
  };

  const handleDelete = (member: Member) => {
    if (window.confirm(`${member.name} 회원을 정말로 삭제하시겠습니까? \n삭제 시 회원은 즉시 로그아웃되며 접속이 차단됩니다.`)) {
        onDeleteMember(member.id);
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-white/80 dark:bg-black/90 backdrop-blur-md animate-fade-in transition-colors duration-300">
      <Panel className="w-full max-w-6xl h-[85vh] flex flex-col relative border-gray-300 dark:border-ai-primary/30 shadow-2xl dark:shadow-[0_0_50px_rgba(0,242,255,0.1)]">
        
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-cyan-600 dark:text-ai-primary animate-pulse" />
            <div>
              <h2 className="text-2xl font-display font-bold text-slate-800 dark:text-white">ADMIN DASHBOARD</h2>
              <p className="text-xs text-gray-500 dark:text-ai-dim font-mono">SYSTEM MANAGEMENT CONSOLE</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
             <X className="w-5 h-5 text-gray-500 dark:text-white" />
          </button>
        </div>

        <div className="flex gap-2 mb-4 shrink-0">
          <button 
            onClick={() => setActiveTab('MEMBERS')}
            className={`px-6 py-3 rounded-t-lg font-bold text-sm transition-all flex items-center gap-2 border-b-2 ${activeTab === 'MEMBERS' ? 'bg-cyan-50 text-cyan-700 border-cyan-500 dark:bg-ai-primary/10 dark:text-ai-primary dark:border-ai-primary' : 'text-gray-500 border-transparent hover:text-gray-900 dark:text-gray-500 dark:hover:text-white'}`}
          >
            <UserCheck className="w-4 h-4" /> 회원 관리
          </button>
          <button 
            onClick={() => setActiveTab('LOGS')}
            className={`px-6 py-3 rounded-t-lg font-bold text-sm transition-all flex items-center gap-2 border-b-2 ${activeTab === 'LOGS' ? 'bg-purple-50 text-purple-700 border-purple-500 dark:bg-ai-secondary/10 dark:text-ai-secondary dark:border-ai-secondary' : 'text-gray-500 border-transparent hover:text-gray-900 dark:text-gray-500 dark:hover:text-white'}`}
          >
            <FileText className="w-4 h-4" /> 접속/활동 로그
          </button>
        </div>

        <div className="flex-1 overflow-hidden relative bg-gray-50 dark:bg-black/40 rounded-lg border border-gray-200 dark:border-white/5 transition-colors">
          
          {/* MEMBERS TAB */}
          {activeTab === 'MEMBERS' && (
            <div className="h-full flex flex-col md:flex-row">
              {/* Registration Form */}
              <div className="w-full md:w-1/3 p-6 border-r border-gray-200 dark:border-white/10 overflow-y-auto">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-green-600 dark:text-ai-success" /> 신규 회원 등록
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-gray-500 dark:text-ai-dim mb-1">회원 성명</label>
                    <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="예: 홍길동" className="bg-white dark:bg-black/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-gray-500 dark:text-ai-dim mb-1">구글 이메일</label>
                    <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="example@gmail.com" className="bg-white dark:bg-black/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-gray-500 dark:text-ai-dim mb-1">휴대폰 번호</label>
                    <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="010-1234-5678" className="bg-white dark:bg-black/30" />
                  </div>
                  <div className="pt-4">
                    <Button onClick={handleRegister} className="w-full">등록하기</Button>
                    <p className="text-[10px] text-gray-500 mt-2 text-center">
                      * 등록일로부터 6개월간 유효하며, 이후 자동 정지됩니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* Member List */}
              <div className="flex-1 p-6 overflow-hidden flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">등록된 회원 목록 ({safeMembers.length})</h3>
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                    <input className="pl-9 pr-4 py-2 bg-white dark:bg-white/5 rounded border border-gray-300 dark:border-white/10 text-xs text-slate-800 dark:text-white outline-none focus:border-cyan-500 dark:focus:border-ai-primary w-48 transition-colors" placeholder="검색..." />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 dark:bg-white/5 text-xs text-gray-500 dark:text-ai-dim font-mono uppercase sticky top-0 backdrop-blur-md z-10">
                      <tr>
                        <th className="p-3">상태</th>
                        <th className="p-3">이름</th>
                        <th className="p-3">이메일</th>
                        <th className="p-3">만료일</th>
                        <th className="p-3 text-center">관리</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-gray-200 dark:divide-white/5">
                      {safeMembers.map(member => (
                        <tr key={member.id} className="hover:bg-gray-100 dark:hover:bg-white/5 transition-colors group">
                          <td className="p-3">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              member.status === 'ACTIVE' 
                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20' 
                                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                member.status === 'ACTIVE' ? 'bg-green-500 dark:bg-green-400 animate-pulse' : 'bg-red-500 dark:bg-red-400'
                              }`} />
                              {member.status}
                            </div>
                          </td>
                          <td className="p-3 font-bold text-slate-800 dark:text-white">
                            {member.name}
                            <div className="text-[10px] text-gray-500 font-mono">{member.phone}</div>
                          </td>
                          <td className="p-3 text-gray-600 dark:text-gray-400 font-mono text-xs">{member.email}</td>
                          <td className="p-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                             {formatDate(member.expiresAt)}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              <button 
                                onClick={() => onExtendMember(member.id)}
                                title="기간 연장 (6개월)"
                                type="button"
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded border border-blue-200 dark:bg-blue-500/10 dark:hover:bg-blue-500 dark:hover:text-white dark:text-blue-500 dark:border-blue-500/30 transition-all"
                              >
                                <CalendarPlus className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => onRenewMember(member.id)}
                                title="기간 재설정 (오늘부터 6개월)"
                                type="button"
                                className="p-1.5 bg-green-50 hover:bg-green-100 text-green-600 rounded border border-green-200 dark:bg-green-500/10 dark:hover:bg-green-500 dark:hover:text-white dark:text-green-500 dark:border-green-500/30 transition-all"
                              >
                                <RefreshCcw className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(member);
                                }}
                                title="회원 삭제"
                                type="button"
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 dark:bg-red-500/10 dark:hover:bg-red-500 dark:hover:text-white dark:text-red-500 dark:border-red-500/30 transition-all cursor-pointer z-10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {safeMembers.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-gray-600 text-xs">등록된 회원이 없습니다.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* LOGS TAB */}
          {activeTab === 'LOGS' && (
            <div className="h-full flex flex-col p-6 overflow-hidden">
               <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-600 dark:text-ai-secondary" /> 시스템 접속 및 활동 로그
               </h3>
               <div className="flex-1 overflow-y-auto custom-scrollbar border border-gray-200 dark:border-white/10 rounded-lg">
                 <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 dark:bg-white/5 text-xs text-gray-500 dark:text-ai-dim font-mono uppercase sticky top-0 backdrop-blur-md">
                      <tr>
                        <th className="p-3 w-40">일시</th>
                        <th className="p-3 w-28">유형</th>
                        <th className="p-3 w-32">사용자</th>
                        <th className="p-3 w-24">사용시간</th>
                        <th className="p-3">상세 내용 / 게임방</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-gray-200 dark:divide-white/5 font-mono">
                      {safeLogs.slice().reverse().map(log => (
                        <tr key={log.id} className="hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                          <td className="p-3 text-gray-500 text-xs">{formatDate(log.timestamp)}</td>
                          <td className="p-3">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                              log.type === 'LOGIN' ? 'bg-cyan-100 text-cyan-700 dark:bg-ai-primary/10 dark:text-ai-primary' : 
                              log.type === 'LOGOUT' ? 'bg-gray-200 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400' :
                              log.type === 'CREATE_GAME' ? 'bg-green-100 text-green-700 dark:bg-ai-success/10 dark:text-ai-success' : 
                              'text-gray-500 dark:text-gray-400'
                            }`}>
                              {log.type}
                            </span>
                          </td>
                          <td className="p-3 text-slate-700 dark:text-gray-300">
                             {log.userName}
                          </td>
                          <td className="p-3 text-gray-500 dark:text-gray-400 text-xs">
                             {log.durationMinutes ? `${log.durationMinutes}분` : '-'}
                          </td>
                          <td className="p-3 text-gray-600 dark:text-gray-400">
                             {log.relatedGameName && (
                               <span className="inline-block px-1.5 py-0.5 mr-2 rounded bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-white text-[10px] font-bold">
                                 {log.relatedGameName}
                               </span>
                             )}
                             {log.details}
                          </td>
                        </tr>
                      ))}
                      {safeLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-gray-600 text-xs">기록된 로그가 없습니다.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
               </div>
            </div>
          )}

        </div>
      </Panel>
    </div>
  );
};
