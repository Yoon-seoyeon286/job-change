// ─── 기본 과목 데이터 ─────────────────────────────────────────
const DEFAULT_SUBJECTS = [
  { id: 'unreal',    name: '언리얼 엔진 과제', weight: 4, color: '#8b5cf6', icon: '🎮' },
  { id: 'unity',     name: '유니티 과제',       weight: 4, color: '#06b6d4', icon: '🕹️' },
  { id: 'cert',      name: '정보처리기사',       weight: 5, color: '#f59e0b', icon: '📋' },
  { id: 'cpp',       name: 'C++ 문제풀이',       weight: 4, color: '#10b981', icon: '💻' },
  { id: 'interview', name: '면접 준비',          weight: 3, color: '#f43f5e', icon: '🗣️' },
  { id: 'cyber',     name: '사이버대 강의',      weight: 2, color: '#64748b', icon: '🎓' }
];

const DEFAULT_CONFIG = {
  startTime:    '21:00',
  endTime:      '01:00',
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
  deleteSession(date) {
    const all = JSON.parse(localStorage.getItem('sessions') || '{}');
    delete all[date];
    localStorage.setItem('sessions', JSON.stringify(all));
  },

  getWeeklyPlan() {
    const saved = localStorage.getItem('weeklyPlan');
    return saved ? JSON.parse(saved) : {};
  },
  saveWeeklyPlan(plan) {
    localStorage.setItem('weeklyPlan', JSON.stringify(plan));
  }
};
