// ─── 날짜 유틸 ───────────────────────────────────────────────
function today() {
  return new Date().toISOString().slice(0, 10);
}
function formatDate(dateStr) {
  const d = new Date(dateStr);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
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

// ─── 대시보드 ─────────────────────────────────────────────────
function renderDashboard() {
  const dateStr  = today();
  const subjects = Storage.getSubjects();
  const sessions = getTodaySchedule(dateStr);
  const config   = Storage.getConfig();

  document.getElementById('dash-date').textContent = formatDate(dateStr);
  document.getElementById('dash-time-range').textContent =
    `${config.startTime} ~ ${config.endTime}`;

  const done  = sessions.filter(s => s.done).length;
  const total = sessions.length;
  const pct   = total ? Math.round((done / total) * 100) : 0;

  document.getElementById('dash-progress-bar').style.width = pct + '%';
  document.getElementById('dash-progress-text').textContent = `${done}/${total} 완료 (${pct}%)`;

  const list = document.getElementById('session-list');
  list.innerHTML = sessions.map((s, i) => {
    const subj = subjects.find(x => x.id === s.subjectId) || {};
    return `
    <div class="session-card ${s.done ? 'done' : ''}" data-index="${i}">
      <div class="session-left">
        <button class="check-btn" onclick="toggleSession(${i})" aria-label="완료 토글">
          ${s.done ? '✓' : ''}
        </button>
        <div class="session-info">
          <div class="session-name">
            <span class="subject-dot" style="background:${subj.color}"></span>
            ${subj.icon || ''} ${subj.name || s.subjectId}
          </div>
          <div class="session-time">${s.startTime} ~ ${s.endTime} · ${formatMinutes(s.plannedMin)}</div>
        </div>
      </div>
      <div class="session-right">
        ${s.done
          ? `<span class="done-badge">완료</span>`
          : `<button class="start-btn" onclick="openActualModal(${i})">기록</button>`
        }
      </div>
    </div>`;
  }).join('');
}

function toggleSession(index) {
  const dateStr  = today();
  const sessions = Storage.getSessions(dateStr);
  const s        = sessions[index];
  s.done = !s.done;
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
  document.getElementById('modal-title').textContent = `${subj.icon} ${subj.name}`;
  document.getElementById('modal-planned').textContent = formatMinutes(s.plannedMin);
  document.getElementById('modal-actual').value = s.actualMin || s.plannedMin;
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
      const done  = sessions.filter(s => s.done).length;
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
  let html = `<div class="detail-header">${formatDate(dateStr)} · 총 ${formatMinutes(totalActual)}</div>`;
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

function prevMonth() { historyMonth.setMonth(historyMonth.getMonth() - 1); renderHistory(); }
function nextMonth() { historyMonth.setMonth(historyMonth.getMonth() + 1); renderHistory(); }

// ─── 통계 ────────────────────────────────────────────────────
let statsChart = null;
function renderStats() {
  const subjects    = Storage.getSubjects();
  const allSessions = Storage.getAllSessions();

  // 최근 7일
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  // 과목별 누적 시간 (분)
  const totals = {};
  subjects.forEach(s => totals[s.id] = 0);
  Object.values(allSessions).forEach(sessions => {
    sessions.forEach(s => { if (totals[s.id] !== undefined) totals[s.id] += s.actualMin || 0; });
  });

  // 주간 일별 총 공부시간
  const weeklyData = last7.map(d => {
    const sessions = allSessions[d] || [];
    return sessions.reduce((a, s) => a + (s.actualMin || 0), 0);
  });

  // 총 공부 시간 및 연속 일수
  const allDates    = Object.keys(allSessions).sort();
  const todayStr    = today();
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const s  = allSessions[ds];
    if (s && s.some(x => x.done)) streak++;
    else break;
  }
  const totalStudyMin = Object.values(totals).reduce((a, b) => a + b, 0);

  document.getElementById('stat-total').textContent  = formatMinutes(totalStudyMin);
  document.getElementById('stat-streak').textContent = `${streak}일 연속`;
  document.getElementById('stat-days').textContent   = `${Object.keys(allSessions).length}일`;

  // 차트
  const ctx = document.getElementById('stats-chart').getContext('2d');
  if (statsChart) statsChart.destroy();
  statsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: last7.map(d => d.slice(5)),
      datasets: [{
        label: '공부 시간 (분)',
        data: weeklyData,
        backgroundColor: '#6366f1',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' }, beginAtZero: true }
      }
    }
  });

  // 과목별 파이 차트
  const ctx2 = document.getElementById('subject-chart').getContext('2d');
  if (window.subjectChart) window.subjectChart.destroy();
  const withTime = subjects.filter(s => totals[s.id] > 0);
  window.subjectChart = new Chart(ctx2, {
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
  list.innerHTML = subjects.map((s, i) => `
    <div class="setting-row">
      <div class="setting-left">
        <span class="subject-dot" style="background:${s.color}"></span>
        <span class="setting-icon">${s.icon}</span>
        <span class="setting-name">${s.name}</span>
      </div>
      <div class="setting-right">
        <label class="weight-label">비중</label>
        <input type="range" min="0" max="5" value="${s.weight}"
          oninput="updateWeight(${i}, this.value)"
          class="weight-slider" style="accent-color:${s.color}">
        <span class="weight-val" id="wv-${i}">${s.weight}</span>
        <input type="color" value="${s.color}"
          oninput="updateColor(${i}, this.value)" class="color-pick">
      </div>
    </div>`).join('');
}

function updateWeight(i, val) {
  const subjects = Storage.getSubjects();
  subjects[i].weight = parseInt(val);
  Storage.saveSubjects(subjects);
  document.getElementById(`wv-${i}`).textContent = val;
}
function updateColor(i, val) {
  const subjects = Storage.getSubjects();
  subjects[i].color = val;
  Storage.saveSubjects(subjects);
}
// ─── 요일별 과목 설정 ────────────────────────────────────────
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
let selectedDay = new Date().getDay();

function renderWeeklyPlan() {
  const subjects   = Storage.getSubjects();
  const weeklyPlan = Storage.getWeeklyPlan();

  // 요일 탭
  const tabs = document.getElementById('day-tabs');
  tabs.innerHTML = DAY_NAMES.map((name, i) => {
    const hasCustom = weeklyPlan[i] && weeklyPlan[i].length > 0;
    return `<button class="day-tab ${i === selectedDay ? 'active' : ''} ${hasCustom ? 'custom' : ''}"
      onclick="selectDay(${i})">${name}</button>`;
  }).join('');

  // 과목 체크박스
  const current = weeklyPlan[selectedDay];
  const isAuto  = current === undefined;
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
  renderWeeklyPlan();
}

function saveWeeklyDay() {
  const checked = [...document.querySelectorAll('.subj-chk:checked')].map(el => el.dataset.id);
  const weeklyPlan = Storage.getWeeklyPlan();
  weeklyPlan[selectedDay] = checked;
  Storage.saveWeeklyPlan(weeklyPlan);
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
}
function resetTodaySchedule() {
  if (!confirm('오늘 시간표를 다시 생성할까요? 기록이 초기화됩니다.')) return;
  const dateStr = today();
  const fresh   = generateSchedule(dateStr);
  Storage.saveSessions(dateStr, fresh);
  showView('dashboard');
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
  showView('dashboard');

  // 모달 바깥 클릭으로 닫기
  document.getElementById('actual-modal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });
});
