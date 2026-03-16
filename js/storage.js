// ─── 기본 과목 데이터 ─────────────────────────────────────────
const DEFAULT_SUBJECTS = [
  { id: 'unreal',  name: '언리얼 엔진 과제', weight: 4, color: '#8b5cf6', icon: '🎮' },
  { id: 'unity',   name: '유니티 과제',       weight: 4, color: '#06b6d4', icon: '🕹️' },
  { id: 'cert',    name: '정보처리기사',       weight: 5, color: '#f59e0b', icon: '📋' },
  { id: 'cpp',     name: 'C++ 문제풀이',       weight: 4, color: '#10b981', icon: '💻' },
  { id: 'interview', name: '면접 준비',        weight: 3, color: '#f43f5e', icon: '🗣️' },
  { id: 'cyber',   name: '사이버대 강의',      weight: 2, color: '#64748b', icon: '🎓' }
];

const DEFAULT_CONFIG = {
  startTime: '21:00',
  endTime:   '01:00',
  breakMinutes: 10
};

// ─── Storage API ──────────────────────────────────────────────
const Storage = {
  getSubjects() {
    const saved = localStorage.getItem('subjects');
    return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
  },
  saveSubjects(subjects) {
    localStorage.setItem('subjects', JSON.stringify(subjects));
  },

  getConfig() {
    const saved = localStorage.getItem('config');
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
  },
  saveConfig(config) {
    localStorage.setItem('config', JSON.stringify(config));
  },

  // 날짜별 세션 기록
  // sessions: { [date]: [ { subjectId, plannedMin, actualMin, done } ] }
  getSessions(date) {
    const all = JSON.parse(localStorage.getItem('sessions') || '{}');
    return all[date] || null;
  },
  saveSessions(date, sessions) {
    const all = JSON.parse(localStorage.getItem('sessions') || '{}');
    all[date] = sessions;
    localStorage.setItem('sessions', JSON.stringify(all));
  },
  getAllSessions() {
    return JSON.parse(localStorage.getItem('sessions') || '{}');
  },

  // 특정 날짜의 실제 공부 시간 업데이트
  updateActual(date, subjectId, actualMin) {
    const sessions = this.getSessions(date) || [];
    const s = sessions.find(s => s.subjectId === subjectId);
    if (s) {
      s.actualMin = actualMin;
      s.done = true;
    }
    this.saveSessions(date, sessions);
  },

  toggleDone(date, subjectId) {
    const sessions = this.getSessions(date) || [];
    const s = sessions.find(s => s.subjectId === subjectId);
    if (s) {
      s.done = !s.done;
      this.saveSessions(date, sessions);
    }
    return sessions;
  }
};
