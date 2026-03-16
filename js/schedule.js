// ─── 날짜 기반 시드 난수 ──────────────────────────────────────
function seededRand(seed) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function dateSeed(dateStr) {
  return dateStr.replace(/-/g, '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

// ─── 시간 파싱 ────────────────────────────────────────────────
function parseTime(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(totalMin) {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── 시간표 생성 ──────────────────────────────────────────────
// 하루 4시간(240분)을 가중치에 따라 과목별로 배분
// 같은 날짜는 항상 같은 결과를 반환 (시드 기반)
function generateSchedule(dateStr) {
  const subjects = Storage.getSubjects().filter(s => s.weight > 0);
  const config   = Storage.getConfig();

  let startMin = parseTime(config.startTime);
  let endMin   = parseTime(config.endTime);
  if (endMin < startMin) endMin += 24 * 60; // 자정 넘기는 경우

  const totalMin   = endMin - startMin;
  const breakMin   = config.breakMinutes;
  const rand       = seededRand(dateSeed(dateStr));
  const dayOfWeek  = new Date(dateStr).getDay(); // 0=일 ~ 6=토

  // 오늘 포함할 과목 선택: 가중치 높을수록 자주 등장
  // 가중치 합 기준 4~5개 선택
  const pool = [];
  subjects.forEach(s => {
    for (let i = 0; i < s.weight; i++) pool.push(s.id);
  });

  // 셔플
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // 중복 제거하되 순서 유지, 최대 4개
  const seen = new Set();
  const todayIds = [];
  for (const id of pool) {
    if (!seen.has(id)) { seen.add(id); todayIds.push(id); }
    if (todayIds.length >= 4) break;
  }

  // 선택된 과목의 가중치 합
  const todaySubjects = todayIds.map(id => subjects.find(s => s.id === id));
  const weightSum     = todaySubjects.reduce((a, s) => a + s.weight, 0);

  // 세션별 시간 배분 (break 시간 제외)
  const sessionCount   = todaySubjects.length;
  const totalBreakMin  = breakMin * (sessionCount - 1);
  const studyMin       = totalMin - totalBreakMin;

  let cursor = startMin;
  const sessions = todaySubjects.map((subj, i) => {
    const allocated = Math.round((subj.weight / weightSum) * studyMin);
    const start     = cursor;
    const end       = cursor + allocated;
    cursor = end + (i < sessionCount - 1 ? breakMin : 0);
    return {
      subjectId:   subj.id,
      plannedMin:  allocated,
      startTime:   minutesToTime(start),
      endTime:     minutesToTime(end),
      actualMin:   0,
      done:        false
    };
  });

  return sessions;
}

// ─── 저장된 세션 또는 새 세션 반환 ───────────────────────────
function getTodaySchedule(dateStr) {
  const saved = Storage.getSessions(dateStr);
  if (saved) return saved;
  const fresh = generateSchedule(dateStr);
  Storage.saveSessions(dateStr, fresh);
  return fresh;
}
