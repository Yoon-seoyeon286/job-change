// ─── 날짜 유틸 ───────────────────────────────────────────────
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${m}월 ${d}일 (${days[new Date(y, m - 1, d).getDay()]})`;
}
function formatMinutes(min) {
  if (!min) return '0분';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}시간 ${m > 0 ? m + '분' : ''}`.trim() : `${m}분`;
}

// ─── 뷰 전환 ─────────────────────────────────────────────────
let currentView = 'dashboard';
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  document.getElementById(`view-${name}`).classList.add('active');
  currentView = name;
  if (name === 'dashboard') renderDashboard();
  if (name === 'history')   renderHistory();
  if (name === 'stats')     renderStats();
  if (name === 'settings')  renderSettings();
}

// ─── 타이머 ────────────────────────────────────────────────────
let timerState = null;

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function startTimer(index) {
  if (timerState) clearInterval(timerState.intervalId);
  const sessions = Storage.getSessions(today());
  const s = sessions[index];
  timerState = {
    index,
    total:     s.plannedMin * 60,
    remaining: s.plannedMin * 60,
    startedAt: Date.now(),
    intervalId: null
  };
  timerState.intervalId = setInterval(tickTimer, 500);
  renderDashboard();
}

function tickTimer() {
  if (!timerState) return;
  const elapsed = Math.floor((Date.now() - timerState.startedAt) / 1000);
  timerState.remaining = Math.max(0, timerState.total - elapsed);
  if (timerState.remaining <= 0) {
    const idx      = timerState.index;
    clearInterval(timerState.intervalId);
    timerState = null;
    const sessions = Storage.getSessions(today());
    const subj     = Storage.getSubjects().find(x => x.id === sessions[idx].subjectId) || {};
    sessions[idx].done      = true;
    sessions[idx].actualMin = sessions[idx].plannedMin;
    Storage.saveSessions(today(), sessions);
    notifyTimerDone(subj.name || sessions[idx].subjectId);
    showToast('⏰ 타이머 완료!');
    renderDashboard();
    return;
  }
  const el = document.getElementById(`timer-${timerState.index}`);
  if (el) el.textContent = formatTimer(timerState.remaining);
}

function stopTimer(complete) {
  if (!timerState) return;
  const idx     = timerState.index;
  const elapsed = Math.round((Date.now() - timerState.startedAt) / 60000);
  clearInterval(timerState.intervalId);
  timerState = null;
  const sessions = Storage.getSessions(today());
  if (complete) {
    sessions[idx].done      = true;
    sessions[idx].actualMin = elapsed || sessions[idx].plannedMin;
  } else {
    sessions[idx].done      = true;
    sessions[idx].failed    = true;
    sessions[idx].actualMin = 0;
  }
  Storage.saveSessions(today(), sessions);
  renderDashboard();
}

function failSession(index) {
  if (timerState && timerState.index === index) {
    clearInterval(timerState.intervalId);
    timerState = null;
  }
  const sessions = Storage.getSessions(today());
  sessions[index].done      = true;
  sessions[index].failed    = true;
  sessions[index].actualMin = 0;
  Storage.saveSessions(today(), sessions);
  renderDashboard();
}

// ─── 타이머 알림 ──────────────────────────────────────────────
function notifyTimerDone(subjectName) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.3, 0.6].forEach(offset => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.25);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.25);
    });
  } catch(e) {}
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('타이머 완료!', {
      body: `${subjectName} 공부 시간이 완료됐습니다.`,
      icon: 'icons/icon-192.svg'
    });
  }
}

// ─── 대시보드 ─────────────────────────────────────────────────
function renderDashboard() {
  const dateStr  = today();
  const subjects = Storage.getSubjects();
  const sessions = getTodaySchedule(dateStr);
  const config   = Storage.getConfig();

  document.getElementById('dash-date').textContent = formatDate(dateStr);
  document.getElementById('dash-time-range').textContent =
    `${config.startTime} ~ ${config.endTime}`;

  const done  = sessions.filter(s => s.done && !s.failed).length;
  const total = sessions.length;
  const pct   = total ? Math.round((done / total) * 100) : 0;

  document.getElementById('dash-progress-bar').style.width = pct + '%';
  document.getElementById('dash-progress-text').textContent = `${done}/${total} 완료 (${pct}%)`;

  const list = document.getElementById('session-list');
  list.innerHTML = sessions.map((s, i) => {
    const subj      = subjects.find(x => x.id === s.subjectId) || {};
    const isRunning = timerState && timerState.index === i;

    let rightContent;
    if (s.failed) {
      rightContent = `<span class="fail-badge">실패</span>`;
    } else if (s.done) {
      rightContent = `<span class="done-badge">완료</span>`;
    } else if (isRunning) {
      rightContent = `<span class="timer-display" id="timer-${i}">${formatTimer(timerState.remaining)}</span>
        <button class="timer-done-btn" onclick="stopTimer(true)">완료</button>
        <button class="timer-stop-btn" onclick="stopTimer(false)">포기</button>`;
    } else {
      rightContent = `<button class="timer-btn" onclick="startTimer(${i})">⏱</button>
        <button class="start-btn" onclick="openActualModal(${i})">기록</button>`;
    }

    return `
    <div class="session-card ${s.failed ? 'failed' : s.done ? 'done' : ''}" data-index="${i}">
      <div class="session-left">
        <div class="check-group">
          <button class="check-btn" onclick="toggleSession(${i})" aria-label="완료 토글">
            ${s.failed ? '↩' : s.done ? '✓' : ''}
          </button>
          ${!s.done ? `<button class="fail-btn" onclick="failSession(${i})" title="실패">✗</button>` : ''}
        </div>
        <div class="session-info">
          <div class="session-name">
            <span class="subject-dot" style="background:${subj.color}"></span>
            ${subj.icon || ''} ${subj.name || s.subjectId}
          </div>
          <div class="session-time">${s.startTime} ~ ${s.endTime} · ${formatMinutes(s.plannedMin)}</div>
        </div>
      </div>
      <div class="session-right">
        ${rightContent}
      </div>
    </div>`;
  }).join('');
}

function toggleSession(index) {
  const dateStr  = today();
  const sessions = Storage.getSessions(dateStr);
  const s        = sessions[index];
  if (s.done) {
    s.done      = false;
    s.failed    = false;
    s.actualMin = 0;
    if (timerState && timerState.index === index) {
      clearInterval(timerState.intervalId);
      timerState = null;
    }
  } else {
    s.done   = true;
    s.failed = false;
    if (!s.actualMin) s.actualMin = s.plannedMin;
  }
  Storage.saveSessions(dateStr, sessions);
  renderDashboard();
}

// ─── 실제 공부시간 기록 모달 ──────────────────────────────────
let modalIndex = -1;
function openActualModal(index) {
  const dateStr  = today();
  const sessions = Storage.getSessions(dateStr);
  const s        = sessions[index];
  const subjects = Storage.getSubjects();
  const subj     = subjects.find(x => x.id === s.subjectId) || {};

  modalIndex = index;
  document.getElementById('modal-title').textContent   = `${subj.icon} ${subj.name}`;
  document.getElementById('modal-planned').textContent = formatMinutes(s.plannedMin);
  document.getElementById('modal-actual').value        = s.actualMin || s.plannedMin;
  document.getElementById('actual-modal').classList.add('open');
}
function closeModal() {
  document.getElementById('actual-modal').classList.remove('open');
  modalIndex = -1;
}
function saveActual() {
  if (modalIndex < 0) return;
  const dateStr  = today();
  const sessions = Storage.getSessions(dateStr);
  const actual   = parseInt(document.getElementById('modal-actual').value) || 0;
  sessions[modalIndex].actualMin = actual;
  sessions[modalIndex].done      = true;
  Storage.saveSessions(dateStr, sessions);
  closeModal();
  renderDashboard();
}

// ─── 기록 (달력) ──────────────────────────────────────────────
let historyMonth = new Date();

function renderHistory() {
  const allSessions = Storage.getAllSessions();
  const year  = historyMonth.getFullYear();
  const month = historyMonth.getMonth();

  document.getElementById('history-month-label').textContent =
    `${year}년 ${month + 1}월`;

  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const todayStr = today();

  let html = '<div class="cal-days-header">';
  ['일','월','화','수','목','금','토'].forEach(d => html += `<div>${d}</div>`);
  html += '</div><div class="cal-grid">';

  for (let i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';

  for (let d = 1; d <= lastDate; d++) {
    const dateStr  = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const sessions = allSessions[dateStr];
    const isToday  = dateStr === todayStr;
    let dot = '';
    if (sessions) {
      const done  = sessions.filter(s => s.done && !s.failed).length;
      const total = sessions.length;
      const pct   = total ? done / total : 0;
      const color = pct === 1 ? '#10b981' : pct > 0 ? '#f59e0b' : '#ef4444';
      dot = `<span class="cal-dot" style="background:${color}"></span>`;
    }
    html += `<div class="cal-cell ${isToday ? 'today' : ''}" onclick="showDayDetail('${dateStr}')">
      <span class="cal-day">${d}</span>${dot}
    </div>`;
  }
  html += '</div>';
  document.getElementById('calendar-area').innerHTML = html;
  document.getElementById('day-detail').innerHTML = '';
}

function showDayDetail(dateStr) {
  const sessions = Storage.getSessions(dateStr);
  const subjects = Storage.getSubjects();
  if (!sessions) {
    document.getElementById('day-detail').innerHTML =
      `<p class="empty-msg">${formatDate(dateStr)} — 기록 없음</p>`;
    return;
  }
  const totalActual = sessions.reduce((a, s) => a + (s.actualMin || 0), 0);
  let html = `<div class="detail-header">${formatDate(dateStr)} · 총 ${formatMinutes(totalActual)}
    <button onclick="deleteDayRecord('${dateStr}')" style="float:right;background:#ef4444;color:#fff;border:none;border-radius:6px;padding:2px 10px;font-size:0.8rem;cursor:pointer;">삭제</button>
  </div>`;
  html += sessions.map(s => {
    const subj = subjects.find(x => x.id === s.subjectId) || {};
    return `<div class="detail-row ${s.done ? 'done' : ''}">
      <span class="subject-dot" style="background:${subj.color}"></span>
      ${subj.icon} ${subj.name}
      <span class="detail-time">${s.done ? formatMinutes(s.actualMin || s.plannedMin) : '미완료'}</span>
    </div>`;
  }).join('');
  document.getElementById('day-detail').innerHTML = html;
}

function deleteDayRecord(dateStr) {
  if (!confirm(`${formatDate(dateStr)} 기록을 삭제할까요?`)) return;
  Storage.deleteSession(dateStr);
  renderHistory();
  document.getElementById('day-detail').innerHTML = '';
}

function prevMonth() { historyMonth.setMonth(historyMonth.getMonth() - 1); renderHistory(); }
function nextMonth() { historyMonth.setMonth(historyMonth.getMonth() + 1); renderHistory(); }

// ─── 통계 ────────────────────────────────────────────────────
let statsChart   = null;
let subjectChart = null;
let statsPeriod  = 7;

function setStatsPeriod(days, btn) {
  statsPeriod = days;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderStats();
}

function getStatsDates(allSessions) {
  if (statsPeriod === 0) {
    const allDates = Object.keys(allSessions).sort();
    return allDates.length > 0 ? allDates : [today()];
  }
  return Array.from({ length: statsPeriod }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (statsPeriod - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

function renderStats() {
  const subjects    = Storage.getSubjects();
  const allSessions = Storage.getAllSessions();
  const dates       = getStatsDates(allSessions);

  // 과목별 누적 시간 (전체 기간)
  const totals = {};
  subjects.forEach(s => totals[s.id] = 0);
  Object.values(allSessions).forEach(sessions => {
    sessions.forEach(s => {
      if (totals[s.subjectId] !== undefined) totals[s.subjectId] += s.actualMin || 0;
    });
  });

  // 기간별 일별 총 공부 시간
  const periodicData = dates.map(d => {
    const sessions = allSessions[d] || [];
    return sessions.reduce((a, s) => a + (s.actualMin || 0), 0);
  });

  // 연속 달성 (오늘 완료 세션 없으면 전날부터 카운트)
  const todaySess = allSessions[today()];
  const todayDone = todaySess && todaySess.some(x => x.done && !x.failed);
  let streak      = 0;
  for (let i = todayDone ? 0 : 1; ; i++) {
    const d  = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const s  = allSessions[ds];
    if (s && s.some(x => x.done && !x.failed)) streak++;
    else break;
  }

  const totalStudyMin = Object.values(totals).reduce((a, b) => a + b, 0);
  document.getElementById('stat-total').textContent  = formatMinutes(totalStudyMin);
  document.getElementById('stat-streak').textContent = `${streak}일`;
  document.getElementById('stat-days').textContent   = `${Object.keys(allSessions).length}일`;

  // 막대 차트 (날짜 많으면 라벨 간격 조정)
  const showEvery = dates.length > 30 ? Math.ceil(dates.length / 15) : 1;
  const labels    = dates.map((d, i) => i % showEvery === 0 ? d.slice(5) : '');

  const ctx = document.getElementById('stats-chart').getContext('2d');
  if (statsChart) statsChart.destroy();
  statsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '공부 시간 (분)',
        data: periodicData,
        backgroundColor: '#6366f1',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8', maxRotation: 45 }, grid: { color: '#1e293b' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' }, beginAtZero: true }
      }
    }
  });

  const ctx2 = document.getElementById('subject-chart').getContext('2d');
  if (subjectChart) subjectChart.destroy();
  const withTime = subjects.filter(s => totals[s.id] > 0);
  subjectChart = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: withTime.map(s => s.name),
      datasets: [{
        data: withTime.map(s => totals[s.id]),
        backgroundColor: withTime.map(s => s.color),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', boxWidth: 12 } }
      }
    }
  });
}

// ─── 설정 ────────────────────────────────────────────────────
function renderSettings() {
  const subjects = Storage.getSubjects();
  const config   = Storage.getConfig();

  document.getElementById('set-start').value = config.startTime;
  document.getElementById('set-end').value   = config.endTime;
  document.getElementById('set-break').value = config.breakMinutes;
  renderWeeklyPlan();

  const list = document.getElementById('subject-settings');
  list.innerHTML = `
    <button class="add-subj-btn" onclick="openSubjectModal(-1)">+ 과목 추가</button>
    ${subjects.map((s, i) => `
    <div class="setting-row">
      <div class="setting-left">
        <span class="subject-dot" style="background:${s.color}"></span>
        <span class="setting-icon">${s.icon}</span>
        <span class="setting-name">${s.name}</span>
        <span class="weight-badge" style="border-color:${s.color};color:${s.color}">×${s.weight}</span>
      </div>
      <div class="setting-right">
        <button class="edit-subj-btn" onclick="openSubjectModal(${i})">편집</button>
        <button class="del-subj-btn" onclick="deleteSubject(${i})">삭제</button>
      </div>
    </div>`).join('')}`;
}

// ─── 과목 CRUD ────────────────────────────────────────────────
let subjectEditIndex = -1;

function openSubjectModal(index) {
  subjectEditIndex = index;
  const subjects = Storage.getSubjects();
  if (index >= 0) {
    const s = subjects[index];
    document.getElementById('subj-modal-title').textContent = '과목 수정';
    document.getElementById('subj-name').value              = s.name;
    document.getElementById('subj-icon').value              = s.icon || '';
    document.getElementById('subj-color').value             = s.color;
    document.getElementById('subj-weight').value            = s.weight;
    document.getElementById('subj-weight-val').textContent  = s.weight;
  } else {
    document.getElementById('subj-modal-title').textContent = '과목 추가';
    document.getElementById('subj-name').value              = '';
    document.getElementById('subj-icon').value              = '';
    document.getElementById('subj-color').value             = '#6366f1';
    document.getElementById('subj-weight').value            = 3;
    document.getElementById('subj-weight-val').textContent  = '3';
  }
  document.getElementById('subject-modal').classList.add('open');
}

function closeSubjectModal() {
  document.getElementById('subject-modal').classList.remove('open');
  subjectEditIndex = -1;
}

function saveSubject() {
  const name = document.getElementById('subj-name').value.trim();
  if (!name) { showToast('과목 이름을 입력하세요'); return; }
  const subjects = Storage.getSubjects();
  const subj = {
    id:     subjectEditIndex >= 0 ? subjects[subjectEditIndex].id : 'subj_' + Date.now(),
    name,
    icon:   document.getElementById('subj-icon').value.trim() || '📚',
    color:  document.getElementById('subj-color').value,
    weight: parseInt(document.getElementById('subj-weight').value)
  };
  if (subjectEditIndex >= 0) {
    subjects[subjectEditIndex] = subj;
    showToast('과목 수정 완료');
  } else {
    subjects.push(subj);
    showToast('과목 추가 완료');
  }
  Storage.saveSubjects(subjects);
  closeSubjectModal();
  renderSettings();
}

function deleteSubject(index) {
  const subjects = Storage.getSubjects();
  if (!confirm(`"${subjects[index].name}" 과목을 삭제할까요?`)) return;
  subjects.splice(index, 1);
  Storage.saveSubjects(subjects);
  renderSettings();
  showToast('과목 삭제 완료');
}

// ─── 요일별 과목 설정 ────────────────────────────────────────
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
let selectedDay = new Date().getDay();

function renderWeeklyPlan() {
  const subjects   = Storage.getSubjects();
  const weeklyPlan = Storage.getWeeklyPlan();

  const tabs = document.getElementById('day-tabs');
  tabs.innerHTML = DAY_NAMES.map((name, i) => {
    const hasCustom = weeklyPlan[i] && weeklyPlan[i].length > 0;
    return `<button class="day-tab ${i === selectedDay ? 'active' : ''} ${hasCustom ? 'custom' : ''}"
      onclick="selectDay(${i})">${name}</button>`;
  }).join('');

  const current  = weeklyPlan[selectedDay];
  const isAuto   = current === undefined;
  const subjList = document.getElementById('weekly-subjects');
  subjList.innerHTML = `
    <div class="auto-row">
      <label class="auto-label">
        <input type="checkbox" id="day-auto" onchange="toggleDayAuto(this.checked)" ${isAuto ? 'checked' : ''}>
        자동 배분 (가중치 기반)
      </label>
    </div>
    ${subjects.map(s => `
    <label class="subj-check-row ${isAuto ? 'disabled' : ''}">
      <input type="checkbox" class="subj-chk" data-id="${s.id}"
        ${!isAuto && current.includes(s.id) ? 'checked' : ''}
        ${isAuto ? 'disabled' : ''}
        onchange="saveWeeklyDay()">
      <span class="subject-dot" style="background:${s.color}"></span>
      <span>${s.icon} ${s.name}</span>
    </label>`).join('')}`;
}

function selectDay(day) {
  selectedDay = day;
  renderWeeklyPlan();
}

function toggleDayAuto(isAuto) {
  const weeklyPlan = Storage.getWeeklyPlan();
  if (isAuto) {
    delete weeklyPlan[selectedDay];
  } else {
    weeklyPlan[selectedDay] = [];
  }
  Storage.saveWeeklyPlan(weeklyPlan);
  if (selectedDay === new Date().getDay()) {
    Storage.saveSessions(today(), generateSchedule(today()));
  }
  renderWeeklyPlan();
}

function saveWeeklyDay() {
  const checked    = [...document.querySelectorAll('.subj-chk:checked')].map(el => el.dataset.id);
  const weeklyPlan = Storage.getWeeklyPlan();
  weeklyPlan[selectedDay] = checked;
  Storage.saveWeeklyPlan(weeklyPlan);
  if (selectedDay === new Date().getDay()) {
    Storage.saveSessions(today(), generateSchedule(today()));
  }
  renderWeeklyPlan();
  showToast(`${DAY_NAMES[selectedDay]}요일 설정 저장`);
}

function saveConfig() {
  const config = {
    startTime:    document.getElementById('set-start').value,
    endTime:      document.getElementById('set-end').value,
    breakMinutes: parseInt(document.getElementById('set-break').value)
  };
  Storage.saveConfig(config);
  showToast('설정 저장 완료!');
  if (confirm('오늘 시간표를 새 설정으로 다시 생성할까요?')) {
    Storage.saveSessions(today(), generateSchedule(today()));
    showToast('오늘 시간표 재생성 완료');
  }
}

function resetTodaySchedule() {
  if (!confirm('오늘 시간표를 다시 생성할까요? 기록이 초기화됩니다.')) return;
  const dateStr = today();
  const fresh   = generateSchedule(dateStr);
  Storage.saveSessions(dateStr, fresh);
  showView('dashboard');
}

// ─── 데이터 내보내기 / 가져오기 ──────────────────────────────
function exportData() {
  const data = {
    version:    '2.0.0',
    exportedAt: new Date().toISOString(),
    subjects:   Storage.getSubjects(),
    config:     Storage.getConfig(),
    sessions:   Storage.getAllSessions(),
    weeklyPlan: Storage.getWeeklyPlan()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `study-planner-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('데이터 내보내기 완료');
}

function importData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!confirm('기존 데이터가 모두 덮어씌워집니다. 계속하시겠습니까?')) {
        input.value = '';
        return;
      }
      if (data.subjects)   Storage.saveSubjects(data.subjects);
      if (data.config)     Storage.saveConfig(data.config);
      if (data.sessions)   localStorage.setItem('sessions', JSON.stringify(data.sessions));
      if (data.weeklyPlan) Storage.saveWeeklyPlan(data.weeklyPlan);
      showToast('데이터 가져오기 완료');
      showView(currentView);
    } catch(err) {
      showToast('파일 형식이 올바르지 않습니다');
    }
  };
  reader.readAsText(file);
  input.value = '';
}

// ─── 토스트 알림 ──────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ─── 초기화 ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    const base = location.pathname.replace(/\/[^/]*$/, '');
    navigator.serviceWorker.register(base + '/sw.js').catch(() => {});
  }
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  showView('dashboard');

  document.getElementById('actual-modal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });
  document.getElementById('subject-modal').addEventListener('click', function(e) {
    if (e.target === this) closeSubjectModal();
  });
});
