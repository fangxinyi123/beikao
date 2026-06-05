// ==================== 数据存储 ====================
const Storage = {
  get(key, def = null) {
    try {
      const v = localStorage.getItem('study_' + key);
      return v ? JSON.parse(v) : def;
    } catch { return def; }
  },
  set(key, val) {
    localStorage.setItem('study_' + key, JSON.stringify(val));
    // 每次数据变更时标记需要同步
    _markDirty();
  }
};

// 防抖同步标记
let _dirtyTimer = null;
function _markDirty() {
  if (_dirtyTimer) clearTimeout(_dirtyTimer);
  _dirtyTimer = setTimeout(() => {
    if (typeof CloudSync !== 'undefined' && CloudSync.pushToCloud) {
      CloudSync.pushToCloud();
    }
  }, 2000);
}

// ==================== 共享数据引用 ====================
function getMottos() { return typeof SharedData !== 'undefined' ? SharedData.MOTTOS : []; }
function getHeaderMottos() { return typeof SharedData !== 'undefined' ? SharedData.HEADER_MOTTOS : []; }
function getDailyQuotes() { return typeof SharedData !== 'undefined' ? SharedData.DAILY_QUOTES : []; }
function getDailyReadings() { return typeof SharedData !== 'undefined' ? SharedData.DAILY_READINGS : []; }
function getQuizBank() { return typeof SharedData !== 'undefined' ? SharedData.QUIZ_BANK : {}; }

// ==================== 成就系统 ====================
const BADGES = [
  { id: 'first_task', icon: '🌟', name: '初出茅庐', desc: '完成第一个任务', check: () => Storage.get('tasks',[]).some(x=>x.done) },
  { id: 'ten_tasks', icon: '🔥', name: '任务达人', desc: '累计完成10个任务', check: () => Storage.get('tasks',[]).filter(x=>x.done).length>=10 },
  { id: 'first_focus', icon: '⏱️', name: '专注新人', desc: '完成第一次专注', check: () => Storage.get('focusSessions',0)>=1 },
  { id: 'ten_focus', icon: '🏆', name: '专注大师', desc: '累计专注10次', check: () => Storage.get('focusSessions',0)>=10 },
  { id: 'first_error', icon: '📖', name: '知错能改', desc: '记录第一道错题', check: () => Storage.get('errors',[]).length>=1 },
  { id: 'ten_errors', icon: '💪', name: '错题克星', desc: '记录10道错题', check: () => Storage.get('errors',[]).length>=10 },
  { id: 'first_note', icon: '📒', name: '笔记先锋', desc: '创建第一篇笔记', check: () => Storage.get('notes',[]).length>=1 },
  { id: 'five_notes', icon: '✍️', name: '笔记达人', desc: '创建5篇笔记', check: () => Storage.get('notes',[]).length>=5 },
  { id: 'total_hours', icon: '🎯', name: '时间管理大师', desc: '累计专注5小时', check: () => Storage.get('totalFocus',0)>=300 },
  { id: 'first_quiz', icon: '📝', name: '初试锋芒', desc: '完成第一次刷题', check: () => Storage.get('quizTotal',0)>=1 },
  { id: 'quiz_master', icon: '🧠', name: '刷题达人', desc: '累计刷题50道', check: () => Storage.get('quizTotal',0)>=50 },
  { id: 'quiz_perfect', icon: '💯', name: '满分成就', desc: '单次刷题全部正确', check: () => Storage.get('quizPerfect',false) },
  { id: 'checkin_3', icon: '📅', name: '三日之约', desc: '连续打卡3天', check: () => Storage.get('checkinStreak',0)>=3 },
  { id: 'checkin_7', icon: '🗓️', name: '一周不断', desc: '连续打卡7天', check: () => Storage.get('checkinStreak',0)>=7 },
  { id: 'checkin_30', icon: '🏔️', name: '月度坚持', desc: '连续打卡30天', check: () => Storage.get('checkinStreak',0)>=30 },

  { id: 'challenge_5', icon: '⚡', name: '挑战者', desc: '完成5次每日挑战', check: () => Storage.get('challengeDone',0)>=5 },
  { id: 'level_5', icon: '🎖️', name: '五级学者', desc: '学习等级达到5级', check: () => getStudyLevel()>=5 },
  { id: 'level_10', icon: '🏅', name: '十级大师', desc: '学习等级达到10级', check: () => getStudyLevel()>=10 },
];

// ==================== 学习等级 ====================
const LEVEL_TITLES = ['小白', '入门', '学徒', '学徒', '学者', '学者', '达人', '达人', '大师', '大师', '宗师', '宗师', '传奇', '传奇', '神话'];
function getStudyXP() {
  const totalFocus = Storage.get('totalFocus', 0);
  const quizTotal = Storage.get('quizTotal', 0);
  const tasks = Storage.get('tasks', []).filter(t => t.done).length;
  const notes = Storage.get('notes', []).length;
  const checkins = Storage.get('checkinTotal', 0);
  return Math.floor(totalFocus * 2 + quizTotal * 10 + tasks * 15 + notes * 20 + checkins * 5);
}
function getStudyLevel() {
  const xp = getStudyXP();
  // 每级所需XP递增：100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250, ...
  let level = 0, needed = 100, total = 0;
  while (total + needed <= xp) { total += needed; level++; needed = Math.floor(100 + level * 150); }
  return level;
}
function getLevelProgress() {
  const xp = getStudyXP();
  let level = 0, needed = 100, total = 0;
  while (total + needed <= xp) { total += needed; level++; needed = Math.floor(100 + level * 150); }
  const currentXP = xp - total;
  return { level, title: LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length - 1)], currentXP, needed, xp };
}



// ==================== 全局状态 ====================
let currentTab = 'dashboard';
let currentReadingIndex = 0;
let focusTimer = null;
let focusSeconds = 0;
let focusIsRunning = false;
let focusPresetMinutes = 25;
let darkMode = Storage.get('darkMode', false);

let quizState = { subject: '', questions: [], currentIndex: 0, answers: [], selectedOption: -1, answered: false, questionCount: 10 };
let weeklyOffset = 0;
let buddiesLocalPosts = [];
let buddiesSort = 'newest';
let dailyChallengeState = { questions: [], currentIndex: 0, answers: [], selectedOption: -1, answered: false, startTime: 0, timeLimit: 300 };
let whiteNoiseType = null;
let whiteNoiseAudio = null;

// Supabase 配置（仅用于研友圈社区功能）
const SUPABASE_URL = 'https://gmnkebtoaxadityitklp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_UUJh0srqIrr8PBVrhH4u9Q_P7B6RkU-';

// ==================== 音效 ====================
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    if (type === 'done') { o.frequency.value = 800; o.type = 'sine'; g.gain.value = 0.3; o.start(); o.stop(ctx.currentTime + 0.15); setTimeout(() => { const o2 = ctx.createOscillator(); o2.connect(g); o2.frequency.value = 1000; o2.type = 'sine'; o2.start(); o2.stop(ctx.currentTime + 0.2); }, 150); }
    else if (type === 'click') { o.frequency.value = 600; o.type = 'sine'; g.gain.value = 0.1; o.start(); o.stop(ctx.currentTime + 0.05); }
    else if (type === 'start') { o.frequency.value = 440; o.type = 'triangle'; g.gain.value = 0.15; o.start(); o.stop(ctx.currentTime + 0.3); }
    else if (type === 'correct') { o.frequency.value = 1000; o.type = 'sine'; g.gain.value = 0.2; o.start(); o.stop(ctx.currentTime + 0.1); }
    else if (type === 'wrong') { o.frequency.value = 300; o.type = 'sawtooth'; g.gain.value = 0.15; o.start(); o.stop(ctx.currentTime + 0.2); }
    setTimeout(() => ctx.close(), 500);
  } catch (e) {}
}

// ==================== Toast ====================
function showToast(msg, duration = 2000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), duration);
}

// ==================== 模态框 ====================
function showModal(title, contentHtml, onSave) {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('modal');
  if (!overlay || !modal) return;
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = contentHtml;
  overlay.classList.add('show');
  document.getElementById('modalSaveBtn').onclick = () => { if (onSave) onSave(); closeModal(); };
}
function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.remove('show');
}

// ==================== 用户信息显示 ====================
async function updateUserInfo() {
  const el = document.getElementById('userInfo');
  if (!el) return;
  
  let loggedIn = false;
  if (typeof Auth !== 'undefined') {
    try {
      loggedIn = await Auth.isLoggedIn();
    } catch { loggedIn = false; }
  }

  if (loggedIn) {
    const nickname = typeof Auth !== 'undefined' ? await Auth.nickname() : '研友';
    el.innerHTML = '👤 ' + escapeHtml(nickname) + ' | <span style="color:#e74c3c;cursor:pointer" onclick="handleLogout()">退出</span>';
  } else if (typeof Auth !== 'undefined' && Auth.isSkipped()) {
    el.innerHTML = '👤 离线模式 | <a href="auth.html" style="color:var(--primary)">登录</a>';
  } else {
    el.innerHTML = '<a href="auth.html" style="color:var(--primary)">登录/注册</a>';
  }

  // 导出按钮：只在登录后显示
  const exportBtn = document.getElementById('exportDataBtn');
  if (exportBtn) {
    if (loggedIn) {
      exportBtn.style.display = 'inline-block';
      exportBtn.title = '导出数据（换设备时用）';
    } else {
      exportBtn.style.display = 'none';
    }
  }
}

async function handleLogout() {
  if (typeof Auth !== 'undefined') await Auth.logout();
}

// 导出数据按钮事件
document.addEventListener('DOMContentLoaded', function() {
  const exportBtn = document.getElementById('exportDataBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      if (typeof CloudSync !== 'undefined' && CloudSync.exportData) {
        CloudSync.exportData();
      }
    });
  }
});

// ==================== 激励语 ====================
function updateMottos() {
  const mottos = getMottos();
  const headerMottos = getHeaderMottos();
  const footerQuote = document.getElementById('footerQuote');
  const headerMotto = document.getElementById('headerMotto');
  if (mottos.length > 0 && footerQuote) {
    const m = mottos[Math.floor(Math.random() * mottos.length)];
    footerQuote.textContent = '"' + m.text + '" — ' + m.author;
  }
  if (headerMottos.length > 0 && headerMotto) {
    headerMotto.textContent = headerMottos[Math.floor(Math.random() * headerMottos.length)];
  }
}
setInterval(updateMottos, 30000);

// ==================== 每日一句 ====================
function renderDailyQuote() {
  const quotes = getDailyQuotes();
  if (quotes.length === 0) return '';
  const today = new Date().toDateString();
  let index = Storage.get('quoteIndex', -1);
  let savedDate = Storage.get('quoteDate', '');
  if (savedDate !== today) {
    index = Math.floor(Math.random() * quotes.length);
    Storage.set('quoteIndex', index);
    Storage.set('quoteDate', today);
  }
  const q = quotes[index] || quotes[0];
  return '<div class="daily-quote"><div class="quote-text">💡 ' + escapeHtml(q.text) + '</div><div class="quote-source">—— ' + escapeHtml(q.source) + '</div></div>';
}

// ==================== 主题切换 ====================
function initTheme() {
  darkMode = Storage.get('darkMode', false);
  document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.textContent = darkMode ? '☀️' : '🌙';
    btn.addEventListener('click', () => {
      darkMode = !darkMode;
      document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
      btn.textContent = darkMode ? '☀️' : '🌙';
      Storage.set('darkMode', darkMode);
      renderTab(currentTab);
    });
  }
}

// ==================== 导航 ====================
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      currentTab = item.dataset.tab;
      renderTab(currentTab);
      playSound('click');
    });
  });
}
function switchTab(tab) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const t = document.querySelector('.nav-item[data-tab="' + tab + '"]');
  if (t) t.classList.add('active');
  currentTab = tab;
  renderTab(tab);
}

// ==================== Tab 路由 ====================
function renderTab(tab) {
  const c = document.getElementById('contentArea');
  if (!c) return;
  const map = { dashboard:renderDashboard, tasks:renderTasks, focus:renderFocus, memo:renderMemo, errors:renderErrors, notes:renderNotes, reading:renderReading, quiz:renderQuiz, buddies:renderBuddies, weekly:renderWeekly, checkin:renderCheckin, challenge:renderDailyChallenge };
  (map[tab] || renderDashboard)(c);
}

// ==================== 成就检测 ====================
function getEarnedBadges() {
  const earned = Storage.get('earnedBadges', []);
  BADGES.forEach(b => { if (!earned.includes(b.id) && b.check()) earned.push(b.id); });
  Storage.set('earnedBadges', earned);
  return earned;
}
function renderBadges() {
  const earned = getEarnedBadges();
  return '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
    BADGES.map(b => '<span class="badge-item' + (earned.includes(b.id) ? '' : ' locked') + '">' + b.icon + ' ' + b.name + '</span>').join('') +
    '</div>';
}

// ==================== 考试倒计时 ====================
function renderCountdown() {
  const examDate = Storage.get('examDate', '2026-12-20');
  const examName = Storage.get('examName', '考研初试');
  const now = new Date();
  const target = new Date(examDate);
  const diff = target - now;
  if (diff <= 0) return '<div class="countdown"><div class="cd-label">🎉</div><div>距' + escapeHtml(examName) + '</div><div>考试已结束</div><div class="cd-edit" onclick="editCountdown()">⚙️ 修改</div></div>';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return '<div class="countdown"><div class="cd-label">📅 距' + escapeHtml(examName) + '</div><div class="cd-days">' + days + ' 天</div><div class="cd-detail">' + hours + '时 ' + mins + '分</div><div class="cd-edit" onclick="editCountdown()">⚙️ 修改</div></div>';
}
function editCountdown() {
  const examDate = Storage.get('examDate', '2026-12-20');
  const examName = Storage.get('examName', '考研初试');
  showModal('设置考试信息',
    '<div class="form-group"><label>考试名称</label><input id="examNameInput" value="' + escapeHtml(examName) + '"></div>' +
    '<div class="form-group"><label>考试日期</label><input type="date" id="examDateInput" value="' + examDate + '"></div>',
    () => {
      const name = document.getElementById('examNameInput').value.trim();
      const date = document.getElementById('examDateInput').value;
      if (name) Storage.set('examName', name);
      if (date) Storage.set('examDate', date);
      renderTab(currentTab);
      showToast('考试设置已保存 ✅');
    });
}

// ==================== 学习面板 ====================
function renderDashboard(container) {
  const tasks = Storage.get('tasks', []);
  const errors = Storage.get('errors', []);
  const notes = Storage.get('notes', []);
  const todayFocus = Storage.get('todayFocus', 0);
  const totalFocus = Storage.get('totalFocus', 0);
  const sessions = Storage.get('focusSessions', 0);
  const quizTotal = Storage.get('quizTotal', 0);
  const quizCorrect = Storage.get('quizCorrect', 0);
  const completedTasks = tasks.filter(t => t.done).length;
  const totalTasks = tasks.length;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const mottos = getMottos();
  const motto = mottos.length > 0 ? mottos[Math.floor(Math.random() * mottos.length)] : { text: '加油！', author: '' };
  const earnedBadges = getEarnedBadges();
  const quizAccuracy = quizTotal > 0 ? Math.round(quizCorrect / quizTotal * 100) : 0;
  const focusHours = Math.floor(totalFocus / 60);
  const focusMins = totalFocus % 60;

  // 学习等级
  const lvl = getLevelProgress();

  // 打卡状态
  const today = new Date().toDateString();
  const lastCheckin = Storage.get('lastCheckin', '');
  const checkedToday = lastCheckin === today;
  const streak = Storage.get('checkinStreak', 0);

  // 检查登录状态并显示同步状态
  let syncBadge = '';
  if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
    syncBadge = '<span style="font-size:11px;color:#27ae60;margin-left:8px">👤 已登录 · 数据已保存</span>';
  } else {
    syncBadge = '<span style="font-size:11px;color:#999;margin-left:8px">💾 离线模式</span>';
  }

  container.innerHTML =
    // 等级卡片
    '<div class="card level-card">' +
    '<div class="level-left"><div class="level-badge">Lv.' + lvl.level + '</div><div><div style="font-weight:800;font-size:16px">' + lvl.title + '</div><div style="font-size:12px;color:var(--text-muted)">经验值 ' + lvl.currentXP + '/' + lvl.needed + '</div></div></div>' +
    '<div class="level-bar-wrap"><div class="level-bar" style="width:' + Math.round(lvl.currentXP / lvl.needed * 100) + '%"></div></div>' +
    '</div>' +

    // 打卡 + 每日一句
    '<div class="card"><div class="card-title">📊 学习概览' + syncBadge + '</div>' +
    renderDailyQuote() +
    '<div style="text-align:center;margin-bottom:12px;color:var(--text-secondary);font-style:italic">"' + escapeHtml(motto.text) + '" — ' + escapeHtml(motto.author) + '</div>' +
    renderCountdown() +
    '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">' +
    (checkedToday
      ? '<button class="btn btn-small" style="background:var(--success-light);color:var(--success);border:1px solid var(--success)">✅ 已打卡（连续 ' + streak + ' 天）</button>'
      : '<button class="btn btn-small btn-primary" onclick="doCheckin()">🎯 点击打卡</button>') +
    '<button class="btn btn-small btn-cancel" onclick="switchTab(\'checkin\')">📅 打卡日历</button>' +
    '</div>' +
    '<div class="stats-grid">' +
    '<div class="stat-card"><div class="stat-value">' + taskProgress + '%</div><div class="stat-label">任务完成度</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + todayFocus + 'min</div><div class="stat-label">今日专注</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + quizTotal + '</div><div class="stat-label">刷题总数</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + quizAccuracy + '%</div><div class="stat-label">正确率</div></div>' +
    '</div>' +
    '<div style="text-align:center;margin-top:8px"><span class="btn btn-small" onclick="switchTab(\'weekly\')">📊 查看周报 →</span></div>' +
    '</div>' +

    // 学习热力图
    '<div class="card"><div class="card-title">🔥 学习热力图</div>' +
    renderHeatmap() +
    '</div>' +

    '<div class="card"><div class="card-title">🏅 成就徽章 (' + earnedBadges.length + '/' + BADGES.length + ')</div>' +
    renderBadges() +
    '</div>';
}

// ==================== 日历 ====================
function getCalendarData() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const today = now.getDate();
  const activeDates = new Set();
  [Storage.get('tasks',[]), Storage.get('memos',[]), Storage.get('errors',[]), Storage.get('notes',[])].flat().forEach(item => {
    const d = new Date(item.date);
    if (d.getFullYear() === year && d.getMonth() === month) activeDates.add(d.getDate());
  });
  // 也加入打卡日期
  const checkinDates = Storage.get('checkinDates', []);
  checkinDates.forEach(d => { const dt = new Date(d); if (dt.getFullYear() === year && dt.getMonth() === month) activeDates.add(dt.getDate()); });
  return { year, month, daysInMonth, firstDay, today, activeDates };
}
function renderCalendar(data) {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  let html = '<div class="calendar"><div class="calendar-header">' + weekdays.map(w => '<span>' + w + '</span>').join('') + '</div><div class="calendar-grid">';
  for (let i = 0; i < data.firstDay; i++) html += '<div></div>';
  for (let d = 1; d <= data.daysInMonth; d++) {
    let cls = 'calendar-day';
    if (d === data.today) cls += ' today';
    if (data.activeDates.has(d)) cls += ' has-data';
    html += '<div class="' + cls + '">' + d + '</div>';
  }
  html += '</div><div style="font-size:11px;color:var(--text-muted);margin-top:8px;text-align:center">' + (data.month + 1) + '月 · 紫色日期为有学习活动</div></div>';
  return html;
}

// ==================== 学习热力图 ====================
function renderHeatmap() {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 90); // 最近91天
  const checkinDates = new Set(Storage.get('checkinDates', []));
  const tasks = Storage.get('tasks', []);
  const notes = Storage.get('notes', []);
  const errors = Storage.get('errors', []);

  // 计算每天的活动量
  const activityMap = {};
  [tasks, notes, errors].flat().forEach(item => {
    const d = new Date(item.date).toDateString();
    activityMap[d] = (activityMap[d] || 0) + 1;
  });
  // 专注也计入
  const focusDate = Storage.get('focusDate', '');
  if (focusDate) {
    const todayFocus = Storage.get('todayFocus', 0);
    if (todayFocus > 0) activityMap[new Date().toDateString()] = (activityMap[new Date().toDateString()] || 0) + Math.floor(todayFocus / 10);
  }

  const days = [];
  for (let i = 90; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const count = activityMap[key] || 0;
    const isChecked = checkinDates.has(key);
    let level = 0;
    if (isChecked) level = 1;
    if (count >= 1) level = 2;
    if (count >= 3) level = 3;
    if (count >= 5) level = 4;
    days.push({ date: d, level, count, key });
  }

  const monthLabels = [];
  let lastMonth = -1;
  days.forEach(d => {
    const m = d.date.getMonth();
    if (m !== lastMonth) { monthLabels.push({ label: (m + 1) + '月', idx: days.indexOf(d) }); lastMonth = m; }
  });

  let html = '<div style="overflow-x:auto"><div style="display:flex;gap:2px;align-items:flex-end;min-width:400px">';
  // 月份标签
  html += '<div style="display:flex;flex-direction:column;gap:2px;margin-right:4px">';
  ['一', '', '三', '', '五', '', '日'].map(l => '<div style="height:12px;font-size:9px;color:var(--text-muted);line-height:12px">' + l + '</div>').forEach(l => html += l);
  html += '</div>';
  html += '<div style="display:flex;gap:2px;flex-wrap:wrap;flex-direction:column;height:calc(7*14px)">';
  // 按列排列（每列7天=一周）
  let weekIdx = 0;
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const colors = ['var(--border)', '#c6e48b', '#7bc96f', '#449e48', '#196127'];
    const darkColors = ['var(--border)', '#1a3a1a', '#2d5a2d', '#3d7a3d', '#4d9a4d'];
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const color = isDark ? darkColors[d.level] : colors[d.level];
    html += '<div style="width:12px;height:12px;border-radius:2px;background:' + color + ';cursor:pointer" title="' + d.key + ': ' + (d.count > 0 ? d.count + '项活动' : '无活动') + '"></div>';
  }
  html += '</div></div>';
  html += '<div style="display:flex;gap:4px;align-items:center;margin-top:8px;font-size:11px;color:var(--text-muted)"><span>少</span>';
  ['var(--border)', '#c6e48b', '#7bc96f', '#449e48', '#196127'].forEach(c => html += '<div style="width:12px;height:12px;border-radius:2px;background:' + c + '"></div>');
  html += '<span>多</span></div></div>';
  return html;
}

// ==================== 打卡系统 ====================
function doCheckin() {
  const today = new Date().toDateString();
  const lastCheckin = Storage.get('lastCheckin', '');
  if (lastCheckin === today) { showToast('今天已经打卡过了 ✅'); return; }

  // 计算连续打卡
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  let streak = Storage.get('checkinStreak', 0);
  if (lastCheckin === yesterday.toDateString()) {
    streak++;
  } else {
    streak = 1;
  }

  const total = Storage.get('checkinTotal', 0) + 1;
  const dates = Storage.get('checkinDates', []);
  dates.push(today);

  Storage.set('lastCheckin', today);
  Storage.set('checkinStreak', streak);
  Storage.set('checkinTotal', total);
  Storage.set('checkinDates', dates);

  playSound('done');

  // 检查新成就
  getEarnedBadges();

  let streakMsg = '';
  if (streak === 3) streakMsg = ' 🌟 三日之约成就达成！';
  else if (streak === 7) streakMsg = ' 🎉 一周不断成就达成！';
  else if (streak === 30) streakMsg = ' 🏔️ 月度坚持成就达成！';

  showToast('打卡成功！连续 ' + streak + ' 天 🔥' + streakMsg, 3000);
  renderTab(currentTab);
}

function renderCheckin(container) {
  const streak = Storage.get('checkinStreak', 0);
  const total = Storage.get('checkinTotal', 0);
  const today = new Date().toDateString();
  const lastCheckin = Storage.get('lastCheckin', '');
  const checkedToday = lastCheckin === today;
  const dates = Storage.get('checkinDates', []);

  // 打卡日历
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const checkinSet = new Set(dates.map(d => new Date(d).toDateString()));
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  let calendarHtml = '<div class="calendar"><div class="calendar-header">' + weekdays.map(w => '<span>' + w + '</span>').join('') + '</div><div class="calendar-grid">';
  for (let i = 0; i < firstDay; i++) calendarHtml += '<div></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d).toDateString();
    let cls = 'calendar-day';
    if (d === now.getDate()) cls += ' today';
    if (checkinSet.has(dt)) cls += ' has-data';
    calendarHtml += '<div class="' + cls + '">' + d + '</div>';
  }
  calendarHtml += '</div></div>';

  // 连续打卡统计
  const streakMilestones = [3, 7, 14, 21, 30, 60, 100];
  const nextMilestone = streakMilestones.find(m => m > streak) || 100;
  const streakProgress = Math.min(streak / nextMilestone * 100, 100);

  container.innerHTML =
    '<div class="card" style="text-align:center">' +
    '<div style="font-size:60px;margin-bottom:8px">' + (checkedToday ? '🔥' : '🎯') + '</div>' +
    '<div style="font-size:32px;font-weight:800;background:linear-gradient(135deg,#ff6b6b,#ffa502);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">' + streak + ' 天</div>' +
    '<div style="font-size:14px;color:var(--text-muted);margin-bottom:12px">连续打卡</div>' +
    (checkedToday
      ? '<button class="btn btn-primary" style="opacity:0.7;cursor:default">✅ 今日已打卡</button>'
      : '<button class="btn btn-primary" onclick="doCheckin()" style="font-size:16px;padding:14px 36px">🎯 立即打卡</button>') +
    '</div>' +

    '<div class="card">' +
    '<div class="card-title">📊 打卡统计</div>' +
    '<div class="stats-grid">' +
    '<div class="stat-card"><div class="stat-value" style="color:#ff6b6b">' + streak + '</div><div class="stat-label">🔥 连续天数</div></div>' +
    '<div class="stat-card"><div class="stat-value" style="color:#ffa502">' + total + '</div><div class="stat-label">📅 累计打卡</div></div>' +
    '<div class="stat-card"><div class="stat-value" style="color:#26de81">' + nextMilestone + '</div><div class="stat-label">🎯 下一目标</div></div>' +
    '</div>' +
    '<div style="margin-top:12px"><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:4px"><span>距离 ' + nextMilestone + ' 天目标</span><span>' + Math.round(streakProgress) + '%</span></div>' +
    '<div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden"><div style="height:100%;width:' + streakProgress + '%;background:linear-gradient(90deg,#ff6b6b,#ffa502);border-radius:4px;transition:width 0.5s"></div></div></div>' +
    '</div>' +

    '<div class="card"><div class="card-title">📅 本月打卡日历</div>' + calendarHtml + '</div>' +

    '<div class="card"><div class="card-title">🏆 打卡成就</div>' +
    '<div style="display:flex;flex-direction:column;gap:8px">' +
    [{ d: 3, icon: '📅', name: '三日之约' }, { d: 7, icon: '🗓️', name: '一周不断' }, { d: 14, icon: '💪', name: '两周坚持' }, { d: 21, icon: '🌟', name: '三周不辍' }, { d: 30, icon: '🏔️', name: '月度坚持' }, { d: 100, icon: '👑', name: '百日传奇' }].map(m =>
      '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;background:' + (streak >= m.d ? 'var(--success-light)' : 'var(--bg)') + ';border:1px solid ' + (streak >= m.d ? 'var(--success)' : 'var(--border)') + '">' +
      '<span style="font-size:22px">' + m.icon + '</span>' +
      '<div style="flex:1"><div style="font-weight:600">' + m.name + '</div><div style="font-size:12px;color:var(--text-muted)">连续打卡 ' + m.d + ' 天</div></div>' +
      (streak >= m.d ? '<span style="color:var(--success);font-weight:700">✅ 已达成</span>' : '<span style="color:var(--text-muted);font-size:12px">' + streak + '/' + m.d + '</span>') +
      '</div>').join('') +
    '</div></div>';
}

// ==================== 每日挑战 ====================
function renderDailyChallenge(container) {
  const today = new Date().toDateString();
  const challengeDate = Storage.get('challengeDate', '');
  const challengeDone = Storage.get('challengeDone', 0);

  if (dailyChallengeState.questions.length > 0 && dailyChallengeState.currentIndex < dailyChallengeState.questions.length) {
    renderChallengeQuestion(container);
    return;
  }

  const bank = getQuizBank();
  const allQuestions = [];
  Object.values(bank).forEach(subj => subj.questions.forEach((q, i) => allQuestions.push({ ...q, _subject: subj.name, _icon: subj.icon || '📝', _idx: i })));
  const shuffled = allQuestions.sort(() => Math.random() - 0.5);
  const challengeQs = shuffled.slice(0, 5);

  const hasDoneToday = challengeDate === today;

  container.innerHTML =
    '<div class="card" style="text-align:center">' +
    '<div style="font-size:48px;margin-bottom:12px">⚡</div>' +
    '<div style="font-size:22px;font-weight:800;background:linear-gradient(135deg,#ffa502,#ff6348);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">每日挑战</div>' +
    '<div style="font-size:14px;color:var(--text-muted);margin-top:6px;margin-bottom:20px">每天5道随机题，限时5分钟！</div>' +
    (hasDoneToday
      ? '<div style="padding:16px;background:var(--success-light);border-radius:12px;margin-bottom:16px"><div style="font-size:18px;font-weight:700;color:var(--success)">✅ 今日挑战已完成</div><div style="font-size:13px;color:var(--text-muted);margin-top:4px">明天再来挑战吧！</div></div>'
      : '<button class="btn btn-primary" style="font-size:16px;padding:14px 36px" onclick="startDailyChallenge()">🚀 开始今日挑战</button>') +
    '<div class="stats-grid" style="margin-top:16px">' +
    '<div class="stat-card"><div class="stat-value">' + challengeDone + '</div><div class="stat-label">完成次数</div></div>' +
    '<div class="stat-card"><div class="stat-value">5</div><div class="stat-label">每轮题数</div></div>' +
    '<div class="stat-card"><div class="stat-value">5min</div><div class="stat-label">限时</div></div>' +
    '</div></div>';
}

function startDailyChallenge() {
  const bank = getQuizBank();
  const allQuestions = [];
  Object.values(bank).forEach(subj => subj.questions.forEach((q, i) => allQuestions.push({ ...q, _subject: subj.name, _icon: subj.icon || '📝', _idx: i })));
  const shuffled = allQuestions.sort(() => Math.random() - 0.5);
  const challengeQs = shuffled.slice(0, 5);

  dailyChallengeState = {
    questions: challengeQs,
    currentIndex: 0,
    answers: [],
    selectedOption: -1,
    answered: false,
    startTime: Date.now(),
    timeLimit: 300
  };
  playSound('start');
  renderChallengeQuestion(document.getElementById('contentArea'));
}

function renderChallengeQuestion(container) {
  const q = dailyChallengeState.questions[dailyChallengeState.currentIndex];
  const elapsed = Math.floor((Date.now() - dailyChallengeState.startTime) / 1000);
  const remaining = Math.max(0, dailyChallengeState.timeLimit - elapsed);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeColor = remaining < 60 ? '#e74c3c' : remaining < 120 ? '#f39c12' : 'var(--primary)';

  container.innerHTML =
    '<div class="card">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
    '<span style="font-size:16px;font-weight:700">⚡ 每日挑战</span>' +
    '<span style="font-size:18px;font-weight:800;color:' + timeColor + '" id="challengeTimer">' + String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0') + '</span></div>' +
    '<div style="margin-bottom:8px;font-size:12px;color:var(--text-muted)">' + (q._icon || '') + ' ' + q._subject + ' · 第 ' + (dailyChallengeState.currentIndex + 1) + '/' + dailyChallengeState.questions.length + ' 题</div>' +
    '<div style="font-size:15px;font-weight:600;margin-bottom:16px">' + (dailyChallengeState.currentIndex + 1) + '. ' + escapeHtml(q.q) + '</div>' +
    q.opts.map((opt, i) => {
      let cls = 'quiz-answer';
      if (dailyChallengeState.answered) { if (i === q.ans) cls += ' correct'; else if (i === dailyChallengeState.selectedOption) cls += ' wrong'; }
      else if (i === dailyChallengeState.selectedOption) cls += ' selected';
      const marker = dailyChallengeState.answered ? (i === q.ans ? '✓ ' : (i === dailyChallengeState.selectedOption ? '✗ ' : '')) : (i === dailyChallengeState.selectedOption ? '● ' : '');
      return '<div class="' + cls + '" onclick="selectChallengeAnswer(' + i + ')">' + marker + ['A','B','C','D'][i] + '. ' + escapeHtml(opt) + '</div>';
    }).join('') +
    (dailyChallengeState.answered ? '<div style="margin-top:12px;text-align:center"><button class="btn btn-primary" onclick="' + (dailyChallengeState.currentIndex < dailyChallengeState.questions.length - 1 ? 'nextChallengeQuestion()' : 'showChallengeResult(document.getElementById(\'contentArea\'))') + '">' + (dailyChallengeState.currentIndex < dailyChallengeState.questions.length - 1 ? '下一题 →' : '查看结果 🎯') + '</button></div>' : '') +
    '</div>';

  // 计时器
  if (remaining > 0 && !dailyChallengeState._timerInterval) {
    dailyChallengeState._timerInterval = setInterval(() => {
      const el = document.getElementById('challengeTimer');
      if (!el) { clearInterval(dailyChallengeState._timerInterval); dailyChallengeState._timerInterval = null; return; }
      const e2 = Math.floor((Date.now() - dailyChallengeState.startTime) / 1000);
      const r = Math.max(0, dailyChallengeState.timeLimit - e2);
      const m2 = Math.floor(r / 60), s2 = r % 60;
      el.textContent = String(m2).padStart(2, '0') + ':' + String(s2).padStart(2, '0');
      el.style.color = r < 60 ? '#e74c3c' : r < 120 ? '#f39c12' : 'var(--primary)';
      if (r <= 0) { clearInterval(dailyChallengeState._timerInterval); dailyChallengeState._timerInterval = null; showChallengeResult(document.getElementById('contentArea')); }
    }, 1000);
  }
}

function selectChallengeAnswer(index) {
  if (dailyChallengeState.answered) return;
  dailyChallengeState.selectedOption = index;
  dailyChallengeState.answered = true;
  const q = dailyChallengeState.questions[dailyChallengeState.currentIndex];
  dailyChallengeState.answers.push({ selected: index, correct: index === q.ans });
  if (index === q.ans) playSound('correct'); else playSound('wrong');
  renderChallengeQuestion(document.getElementById('contentArea'));
}
function nextChallengeQuestion() {
  dailyChallengeState.currentIndex++;
  dailyChallengeState.selectedOption = -1;
  dailyChallengeState.answered = false;
  renderChallengeQuestion(document.getElementById('contentArea'));
}
function showChallengeResult(container) {
  if (dailyChallengeState._timerInterval) { clearInterval(dailyChallengeState._timerInterval); dailyChallengeState._timerInterval = null; }
  const total = dailyChallengeState.questions.length;
  const correct = dailyChallengeState.answers.filter(a => a.correct).length;
  const elapsed = Math.floor((Date.now() - dailyChallengeState.startTime) / 1000);
  const mins = Math.floor(elapsed / 60), secs = elapsed % 60;

  Storage.set('challengeDate', new Date().toDateString());
  Storage.set('challengeDone', Storage.get('challengeDone', 0) + 1);
  getEarnedBadges();

  let emoji = correct === total ? '🏆' : correct >= 4 ? '🌟' : correct >= 3 ? '💪' : '📚';

  container.innerHTML =
    '<div class="card" style="text-align:center">' +
    '<div style="font-size:48px;margin-bottom:12px">' + emoji + '</div>' +
    '<div style="font-size:28px;font-weight:800">' + correct + '/' + total + '</div>' +
    '<div style="color:var(--text-muted);margin-bottom:12px">用时 ' + mins + '分' + secs + '秒</div>' +
    '<div class="stats-grid"><div class="stat-card"><div class="stat-value" style="color:#27ae60">' + correct + '</div><div class="stat-label">✅ 正确</div></div>' +
    '<div class="stat-card"><div class="stat-value" style="color:#e74c3c">' + (total - correct) + '</div><div class="stat-label">❌ 错误</div></div></div>' +
    '<div style="margin-top:16px"><button class="btn btn-primary" onclick="dailyChallengeState={questions:[],currentIndex:0,answers:[],selectedOption:-1,answered:false,startTime:0,timeLimit:300};renderDailyChallenge(document.getElementById(\'contentArea\'))">返回挑战首页</button></div>' +
    '</div>';
}

// ==================== 每日任务 ====================
function renderTasks(container) {
  const tasks = Storage.get('tasks', []);
  container.innerHTML =
    '<div class="card"><div class="card-title">✅ 每日任务 <button class="btn btn-small btn-primary" onclick="addTask()" style="margin-left:auto">+ 添加</button></div>' +
    (tasks.length === 0 ? '<div style="text-align:center;color:var(--text-muted);padding:20px">📋 还没有任务，点击上方按钮添加吧</div>' :
    tasks.map(t =>
      '<div class="task-item">' +
      '<div class="task-checkbox' + (t.done ? ' done' : '') + '" onclick="toggleTask(\'' + t.id + '\')">' + (t.done ? '✓' : '') + '</div>' +
      '<span class="task-text' + (t.done ? ' done' : '') + '">' + escapeHtml(t.text) + '</span>' +
      '<span class="task-priority priority-' + t.priority + '">' + (t.priority==='urgent'?'紧急':t.priority==='important'?'重要':'普通') + '</span>' +
      '<span style="cursor:pointer;font-size:12px" onclick="deleteTask(\'' + t.id + '\')">🗑️</span>' +
      '</div>').join('')) +
    (tasks.length > 0 ? '<button class="btn btn-small btn-cancel" onclick="clearCompletedTasks()" style="margin-top:8px">清除已完成任务</button>' : '') +
    '</div>';
}
function addTask() {
  showModal('添加任务',
    '<div class="form-group"><label>任务内容</label><input id="taskInput" placeholder="例如：背100个单词"></div>' +
    '<div class="form-group"><label>优先级</label><select id="taskPriority"><option value="normal">普通</option><option value="important">重要</option><option value="urgent">紧急</option></select></div>',
    () => {
      const text = document.getElementById('taskInput').value.trim();
      const priority = document.getElementById('taskPriority').value;
      if (!text) return showToast('请输入任务内容');
      const tasks = Storage.get('tasks', []);
      tasks.push({ id: Date.now().toString(), text, priority, done: false, date: new Date().toISOString() });
      Storage.set('tasks', tasks);
      renderTasks(document.getElementById('contentArea'));
      showToast('任务已添加 ✅');
    });
}
function toggleTask(id) {
  const tasks = Storage.get('tasks', []);
  const task = tasks.find(t => t.id === id);
  if (task) { task.done = !task.done; Storage.set('tasks', tasks); renderTasks(document.getElementById('contentArea')); if (task.done) playSound('done'); }
}
function deleteTask(id) {
  let tasks = Storage.get('tasks', []); tasks = tasks.filter(t => t.id !== id); Storage.set('tasks', tasks);
  renderTasks(document.getElementById('contentArea')); showToast('任务已删除');
}
function clearCompletedTasks() {
  let tasks = Storage.get('tasks', []); tasks = tasks.filter(t => !t.done); Storage.set('tasks', tasks);
  renderTasks(document.getElementById('contentArea')); showToast('已完成任务已清除');
}

// ==================== 专注计时 ====================
function renderFocus(container) {
  const totalFocus = Storage.get('totalFocus', 0);
  const todayFocus = Storage.get('todayFocus', 0);
  const sessions = Storage.get('focusSessions', 0);
  const todayDate = new Date().toDateString();
  if (Storage.get('focusDate', '') !== todayDate) { Storage.set('todayFocus', 0); Storage.set('focusDate', todayDate); }
  const mins = Math.floor(focusSeconds / 60);
  const secs = focusSeconds % 60;
  const display = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  container.innerHTML =
    '<div class="card"><div class="card-title">⏱️ 专注计时</div>' +
    '<div class="timer-presets">' + [15, 25, 45, 60].map(m => '<div class="timer-preset" onclick="setFocusPreset(' + m + ')">' + m + ' 分钟</div>').join('') + '</div>' +
    '<div class="timer-circle"><span class="timer-display">' + display + '</span></div>' +
    '<div style="text-align:center;margin-bottom:12px;color:var(--text-muted)">' + (focusIsRunning ? '专注中...' : '准备开始') + '</div>' +
    '<div class="timer-actions">' +
    (focusIsRunning
      ? '<button class="btn btn-cancel" onclick="stopFocus()">⏹ 停止</button><button class="btn btn-cancel" onclick="pauseFocus()">⏸ 暂停</button>'
      : '<button class="btn btn-primary" onclick="startFocus()">▶ 开始专注</button><button class="btn btn-cancel" onclick="resetFocus()">↺ 重置</button>') +
    '</div>' +
    '<div class="stats-grid" style="margin-top:16px">' +
    '<div class="stat-card"><div class="stat-value">' + todayFocus + '</div><div class="stat-label">今日(分钟)</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + totalFocus + '</div><div class="stat-label">总专注(分钟)</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + sessions + '</div><div class="stat-label">完成次数</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + (Math.round(totalFocus / 60 * 10) / 10) + '</div><div class="stat-label">总小时</div></div>' +
    '</div></div>';
}
function setFocusPreset(minutes) { focusPresetMinutes = minutes; if (!focusIsRunning) focusSeconds = minutes * 60; renderFocus(document.getElementById('contentArea')); }
function startFocus() {
  if (focusSeconds === 0) focusSeconds = focusPresetMinutes * 60;
  focusIsRunning = true; renderFocus(document.getElementById('contentArea')); playSound('start');
  focusTimer = setInterval(() => {
    focusSeconds--;
    if (focusSeconds <= 0) {
      stopFocus();
      const tf = Storage.get('todayFocus', 0), ttf = Storage.get('totalFocus', 0), ss = Storage.get('focusSessions', 0);
      Storage.set('todayFocus', tf + focusPresetMinutes); Storage.set('totalFocus', ttf + focusPresetMinutes);
      Storage.set('focusSessions', ss + 1); Storage.set('focusDate', new Date().toDateString());
      playSound('done'); showToast('🎉 太棒了！专注完成！', 3000);
      focusSeconds = 0; renderFocus(document.getElementById('contentArea')); return;
    }
    const display = document.querySelector('.timer-display');
    if (display) { const m = Math.floor(focusSeconds / 60); const s = focusSeconds % 60; display.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); }
  }, 1000);
}
function pauseFocus() { focusIsRunning = false; clearInterval(focusTimer); renderFocus(document.getElementById('contentArea')); }
function stopFocus() {
  focusIsRunning = false; clearInterval(focusTimer);
  if (focusSeconds > 0 && focusSeconds < focusPresetMinutes * 60) {
    const elapsed = Math.round((focusPresetMinutes * 60 - focusSeconds) / 60);
    if (elapsed > 0) { const tf = Storage.get('todayFocus', 0), ttf = Storage.get('totalFocus', 0); Storage.set('todayFocus', tf + elapsed); Storage.set('totalFocus', ttf + elapsed); Storage.set('focusDate', new Date().toDateString()); }
  }
  focusSeconds = 0; renderFocus(document.getElementById('contentArea'));
}
function resetFocus() { focusSeconds = focusPresetMinutes * 60; focusIsRunning = false; clearInterval(focusTimer); renderFocus(document.getElementById('contentArea')); }

// ==================== 备忘录 ====================
function renderMemo(container) {
  const memos = Storage.get('memos', []);
  const now = new Date(), thisMonth = now.getMonth(), thisYear = now.getFullYear();
  const todayStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');

  // 统计
  const newThisMonth = memos.filter(m => { const d = new Date(m.date); return d.getMonth()===thisMonth && d.getFullYear()===thisYear; }).length;
  const completedCount = memos.filter(m => m.completed).length;
  const pendingCount = memos.filter(m => !m.completed).length;
  const overdueMemos = memos.filter(m => !m.completed && m.deadline && m.deadline < todayStr);

  // 统计卡片
  let html = '<div class="stats-grid memo-stats">' +
    '<div class="stat-card"><div class="stat-value">' + newThisMonth + '</div><div class="stat-label">📅 本月新增</div></div>' +
    '<div class="stat-card"><div class="stat-value" style="color:#00b894">' + completedCount + '</div><div class="stat-label">✅ 已完成</div></div>' +
    '<div class="stat-card"><div class="stat-value" style="color:#e17055">' + pendingCount + '</div><div class="stat-label">📋 待查看</div></div>' +
    '</div>';

  // 到期提醒
  if (overdueMemos.length > 0) {
    const names = overdueMemos.slice(0,3).map(m => m.title).join('、');
    const more = overdueMemos.length > 3 ? '等' + overdueMemos.length + '条' : '';
    html += '<div class="memo-reminder-banner">' +
      '<span>⏰</span>' +
      '<span><strong>' + overdueMemos.length + '条备忘已过期</strong>：' + names + more + '</span>' +
      '</div>';
  }

  // 备忘列表
  html += '<div class="card"><div class="card-title">📋 备忘录 <button class="btn btn-small btn-primary" onclick="addMemo()" style="margin-left:auto">+ 新建</button></div>' +
    (memos.length === 0 ? '<div style="text-align:center;color:var(--text-muted);padding:20px">📋 还没有备忘录，开始记录吧</div>' :
    memos.map(m => {
      const isOverdue = !m.completed && m.deadline && m.deadline < todayStr;
      const isSoon = !m.completed && m.deadline && m.deadline >= todayStr && (new Date(m.deadline)-now)/(1000*60*60*24) <= 2;
      const deadlineText = m.deadline ? ('📅 ' + (isOverdue ? '<span style="color:#e17055">已过期 ' : isSoon ? '<span style="color:#e67e22">即将到期 ' : '') + formatDate(m.deadline) + (isOverdue||isSoon?'</span>':'')) : '';
      return '<div class="task-item' + (m.completed?' task-done':'') + '" style="border-left:4px solid ' + (m.color==='blue'?'#667eea':m.color==='yellow'?'#f39c12':m.color==='green'?'#27ae60':'#e74c3c') + '">' +
        '<div class="task-checkbox' + (m.completed?' done':'') + '" onclick="toggleMemoComplete(\'' + m.id + '\')">' + (m.completed?'✓':'') + '</div>' +
        '<div style="flex:1"><strong' + (m.completed?' style="text-decoration:line-through;color:var(--text-muted)"':'') + '>' + escapeHtml(m.title) + '</strong>' +
        '<div style="font-size:12px;color:var(--text-muted)">' + escapeHtml(m.content).substring(0, 60) + '</div>' +
        '<div style="font-size:11px;color:var(--text-muted)">' + formatDate(m.date) + (m.deadline?' | ' + deadlineText:'') + '</div></div>' +
        '<span style="cursor:pointer" onclick="editMemo(\'' + m.id + '\')">✏️</span>' +
        '<span style="cursor:pointer" onclick="deleteMemo(\'' + m.id + '\')">🗑️</span>' +
        '</div>';
    }).join('')) +
    '</div>';

  container.innerHTML = html;
}

function toggleMemoComplete(id) {
  const memos = Storage.get('memos', []), memo = memos.find(m => m.id === id);
  if (!memo) return;
  memo.completed = !memo.completed;
  Storage.set('memos', memos);
  renderMemo(document.getElementById('contentArea'));
  showToast(memo.completed ? '已标记完成 ✅' : '已恢复待处理 📋');
}

function addMemo() {
  showModal('新建备忘',
    '<div class="form-group"><label>标题</label><input id="memoTitle"></div>' +
    '<div class="form-group"><label>内容</label><textarea id="memoContent"></textarea></div>' +
    '<div class="form-group"><label>截止日期</label><input type="date" id="memoDeadline"></div>' +
    '<div class="form-group"><label>颜色标记</label><select id="memoColor"><option value="blue">蓝色</option><option value="yellow">黄色</option><option value="green">绿色</option><option value="red">红色</option></select></div>',
    () => {
      const title = document.getElementById('memoTitle').value.trim(), content = document.getElementById('memoContent').value.trim(),
            deadline = document.getElementById('memoDeadline').value, color = document.getElementById('memoColor').value;
      if (!title) return showToast('请输入标题');
      const memos = Storage.get('memos', []);
      memos.push({ id: Date.now().toString(), title, content, color, deadline: deadline || '', completed: false, date: new Date().toISOString() });
      Storage.set('memos', memos); renderMemo(document.getElementById('contentArea')); showToast('备忘已创建 📋');
    });
}
function editMemo(id) {
  const memos = Storage.get('memos', []), memo = memos.find(m => m.id === id); if (!memo) return;
  showModal('编辑备忘',
    '<div class="form-group"><label>标题</label><input id="memoTitle" value="' + escapeHtml(memo.title) + '"></div>' +
    '<div class="form-group"><label>内容</label><textarea id="memoContent">' + escapeHtml(memo.content || '') + '</textarea></div>' +
    '<div class="form-group"><label>截止日期</label><input type="date" id="memoDeadline" value="' + (memo.deadline||'') + '"></div>' +
    '<div class="form-group"><label>颜色</label><select id="memoColor">' + ['blue','yellow','green','red'].map(c => '<option value="' + c + '"' + (c===memo.color?' selected':'') + '>' + (c==='blue'?'蓝色':c==='yellow'?'黄色':c==='green'?'绿色':'红色') + '</option>').join('') + '</select></div>',
    () => {
      memo.title = document.getElementById('memoTitle').value.trim();
      memo.content = document.getElementById('memoContent').value.trim();
      memo.deadline = document.getElementById('memoDeadline').value;
      memo.color = document.getElementById('memoColor').value;
      if (!memo.title) return showToast('请输入标题');
      Storage.set('memos', memos); renderMemo(document.getElementById('contentArea')); showToast('备忘已更新');
    });
}
function deleteMemo(id) { let memos = Storage.get('memos', []); memos = memos.filter(m => m.id !== id); Storage.set('memos', memos); renderMemo(document.getElementById('contentArea')); showToast('备忘已删除'); }

// ==================== 错题集 ====================
function renderErrors(container) {
  const errors = Storage.get('errors', []);
  container.innerHTML =
    '<div class="card"><div class="card-title">❌ 错题集 <button class="btn btn-small btn-primary" onclick="addError()" style="margin-left:auto">+ 添加</button></div>' +
    (errors.length === 0 ? '<div style="text-align:center;color:var(--text-muted);padding:20px">📖 还没有错题记录</div>' :
    errors.map(e => {
      const subj = getQuizBank()[e.subject];
      const subjName = subj ? ((subj.icon||'') + ' ' + subj.name) : (e.subject==='math3'?'📐 数学三':e.subject==='english'?'📖 英语':e.subject==='politics'?'🏛 政治':e.subject==='stats432'?'📊 统计学432':'📋 ' + (e.subject||'其他'));
      const imgHtml = e.image ? '<div style="margin-top:4px"><img src="' + e.image + '" style="max-width:100%;max-height:150px;border-radius:6px;cursor:pointer" onclick="viewErrorImage(this)"></div>' : '';
      return '<div class="task-item"><div style="flex:1"><div style="font-weight:600">' + subjName + '</div>' +
      (e.question ? '<div>📌 ' + escapeHtml(e.question).substring(0, 60) + '</div>' : '') +
      imgHtml +
      '<div style="font-size:12px">✅ ' + escapeHtml(e.answer) + '</div>' +
      (e.reason ? '<div style="font-size:12px;color:var(--text-muted)">💡 ' + escapeHtml(e.reason) + '</div>' : '') +
      '<div style="font-size:11px;color:var(--text-muted)">' + formatDate(e.date) + '</div></div>' +
      '<span style="cursor:pointer;font-size:12px" onclick="toggleErrorReview(\'' + e.id + '\')">' + (e.reviewed ? '✅' : '👁') + '</span>' +
      '<span style="cursor:pointer;font-size:12px" onclick="deleteError(\'' + e.id + '\')">🗑️</span>' +
      '</div>';
    }).join('')) +
    '</div>';
}
function addError() {
  const bank = getQuizBank();
  const subjOptions = Object.entries(bank).map(([k, v]) => '<option value="' + k + '">' + (v.icon || '') + ' ' + v.name + '</option>').join('');
  showModal('添加错题',
    '<div class="form-group"><label>科目</label><select id="errorSubject">' + subjOptions + '<option value="other">📋 其他</option></select></div>' +
    '<div class="form-group"><label>题目</label><textarea id="errorQuestion"></textarea></div>' +
    '<div class="form-group"><label>📷 添加图片</label><button type="button" class="btn btn-small btn-primary" onclick="openImagePicker(\'errorImageInput\', this)">📷 选择图片</button><input type="file" id="errorImageInput" accept="image/*" onchange="previewErrorImage(this)" style="display:none"></div><div id="errorImagePreview" style="margin-top:8px"></div>' +
    '<div class="form-group"><label>正确答案</label><input id="errorAnswer"></div>' +
    '<div class="form-group"><label>错误原因</label><input id="errorReason"></div>',
    () => {
      const subject = document.getElementById('errorSubject').value, question = document.getElementById('errorQuestion').value.trim(),
        answer = document.getElementById('errorAnswer').value.trim(), reason = document.getElementById('errorReason').value.trim();
      const imgEl = document.querySelector('#errorImagePreview img');
      const image = imgEl ? imgEl.src : '';
      if (!question && !image) return showToast('请填写题目或上传图片');
      if (!answer) return showToast('请填写正确答案');
      const errors = Storage.get('errors', []); errors.push({ id: Date.now().toString(), subject, question, answer, reason, image, reviewed: false, date: new Date().toISOString() });
      Storage.set('errors', errors); renderErrors(document.getElementById('contentArea')); showToast('错题已记录 📝');
    });
}
function previewErrorImage(input) {
  const preview = document.getElementById('errorImagePreview');
  if (!input.files || !input.files[0]) { preview.innerHTML = ''; return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    preview.innerHTML = '<img src="' + e.target.result + '" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid var(--border)">';
  };
  reader.readAsDataURL(input.files[0]);
}
function viewErrorImage(img) {
  showModal('📷 错题图片', '<img src="' + img.src + '" style="max-width:100%;border-radius:8px">');
}
function toggleErrorReview(id) {
  const errors = Storage.get('errors', []); const e = errors.find(x => x.id === id);
  if (e) { e.reviewed = !e.reviewed; Storage.set('errors', errors); renderErrors(document.getElementById('contentArea')); showToast(e.reviewed ? '已复习 ✅' : '取消标记'); }
}
function deleteError(id) { let errors = Storage.get('errors', []); errors = errors.filter(e => e.id !== id); Storage.set('errors', errors); renderErrors(document.getElementById('contentArea')); showToast('错题已删除'); }

// ==================== 笔记 ====================
// 计算连续打卡天数
function calcStreak(notes) {
  if (!notes.length) return 0;
  const now = new Date();
  const daysWithNotes = new Set();
  notes.forEach(n => {
    const d = new Date(n.date);
    daysWithNotes.add(d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'));
  });
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    if (daysWithNotes.has(key)) streak++;
    else break;
  }
  return streak;
}

function renderNotes(container) {
  const notes = Storage.get('notes', []);
  let html = '';

  // 智能分析汇总卡片
  if (notes.length > 0) {
    const streak = calcStreak(notes);
    html += '<div class="card ai-analysis-card">' +
      '<div class="card-title">📊 智能笔记分析 <span style="font-size:11px;color:var(--text-muted);font-weight:400">（深度解读你的学习数据）</span>' +
      '<button class="btn btn-small btn-cancel" onclick="toggleAiDetail()" style="margin-left:auto;font-size:11px">' +
      '<span id="aiToggleIcon">📊</span> <span id="aiToggleText">展开报告</span></button></div>' +
      '<div id="aiSummaryArea">' +
      '<div class="ai-summary-grid">' +
      '<div class="ai-summary-item"><div class="ai-summary-num">' + notes.length + '</div><div class="ai-summary-label">📒 笔记总数</div></div>' +
      '<div class="ai-summary-item"><div class="ai-summary-num">' + notes.reduce((s,n) => s+(n.content||'').length, 0).toLocaleString() + '</div><div class="ai-summary-label">📝 总字数</div></div>' +
      '<div class="ai-summary-item"><div class="ai-summary-num">' + streak + '天</div><div class="ai-summary-label">🔥 连续打卡</div></div>' +
      '<div class="ai-summary-item"><div class="ai-summary-num" id="aiStatus">--</div><div class="ai-summary-label">🧠 分析状态</div></div>' +
      '</div>' +
      '<button class="btn btn-small btn-primary" onclick="runAiAnalysis()" style="margin-top:12px;width:100%">🔍 开始智能分析</button>' +
      '</div>' +

      // 展开详情区域
      '<div id="aiDetailArea" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">' +
      '<div id="aiResultContent" style="line-height:1.9;font-size:14px">' +
      '<div style="text-align:center;color:var(--text-muted);padding:20px">👆 点击上方「开始智能分析」按钮，查看基于你笔记内容的深度分析报告</div>' +
      '</div></div>' +
      '</div>';
  }

  // 笔记列表
  html += '<div class="card"><div class="card-title">📒 学习笔记 <button class="btn btn-small btn-primary" onclick="addNote()" style="margin-left:auto">+ 新建</button></div>' +
    (notes.length === 0 ? '<div style="text-align:center;color:var(--text-muted);padding:20px">📒 还没有笔记，开始记录吧</div>' :
    notes.map(n => {
      const imgHtml = n.image ? '<div style="margin-top:4px"><img src="' + n.image + '" style="max-width:60px;max-height:60px;border-radius:4px;object-fit:cover"></div>' : '';
      return '<div class="task-item" style="cursor:pointer" onclick="viewNote(\'' + n.id + '\')"><div style="flex:1"><div style="font-weight:600">📌 ' + escapeHtml(n.title) + '</div>' +
      (n.content ? '<div style="font-size:12px;color:var(--text-muted)">' + escapeHtml(n.content).substring(0, 60) + '</div>' : '') +
      imgHtml +
      '<div style="font-size:11px;color:var(--text-muted)">' + formatDate(n.date) + ' · ' + escapeHtml(n.subject || '通用') + '</div></div>' +
      '<span style="cursor:pointer" onclick="event.stopPropagation();deleteNote(\'' + n.id + '\')">🗑️</span></div>';
    }).join('')) +
    '</div>';

  container.innerHTML = html;

  // 检查是否有缓存的 AI 分析结果
  if (notes.length > 0) {
    const cached = Storage.get('aiAnalysis', null);
    if (cached) {
      document.getElementById('aiStatus').textContent = '✅ 已分析';
      const resultDiv = document.getElementById('aiResultContent');
      if (resultDiv) resultDiv.innerHTML = cached;
    }
  }
}

// ==================== 智能笔记分析引擎 ====================
// 基于笔记内容做真正的深度分析，不依赖外部 API

function runAiAnalysis() {
  const notes = Storage.get('notes', []);
  if (notes.length === 0) return showToast('请先创建笔记');

  const statusEl = document.getElementById('aiStatus');
  const resultDiv = document.getElementById('aiResultContent');
  const detailArea = document.getElementById('aiDetailArea');
  const btn = document.querySelector('.ai-analysis-card .btn-primary');

  if (statusEl) statusEl.textContent = '⏳ 分析中...';
  if (btn) { btn.disabled = true; btn.textContent = '🔍 正在分析...'; }
  if (detailArea) detailArea.style.display = 'block';

  if (resultDiv) resultDiv.innerHTML = '<div style="text-align:center;padding:30px"><div class="ai-loading-spinner"></div><div style="margin-top:12px;color:var(--text-muted)">🔍 正在深度分析你的笔记...</div></div>';

  // 使用 setTimeout 让 loading 动画先渲染出来
  setTimeout(() => {
    const html = buildAnalysisReport(notes);
    if (resultDiv) resultDiv.innerHTML = html;
    if (statusEl) statusEl.textContent = '✅ 已分析';
    if (btn) { btn.disabled = false; btn.textContent = '🔄 重新分析'; }
    Storage.set('aiAnalysis', html);
    showToast('智能分析完成 📊');
  }, 300);
}

// ========== 核心分析引擎 ==========
function buildAnalysisReport(notes) {
  const analysis = deepAnalyze(notes);
  return renderAnalysisHTML(analysis);
}

function deepAnalyze(notes) {
  const now = new Date();
  const totalChars = notes.reduce((s, n) => s + (n.content || '').length, 0);
  const avgLen = Math.round(totalChars / notes.length);

  // 1. 科目分析
  const subjects = {};
  notes.forEach(n => { const s = n.subject || '未分类'; subjects[s] = (subjects[s] || 0) + 1; });
  const subjectList = Object.entries(subjects).sort((a, b) => b[1] - a[1]);
  const totalSubjects = subjectList.length;
  const topSubject = subjectList[0];
  const bottomSubject = subjectList[subjectList.length - 1];

  // 2. 时间分析 - 学习日历热力图数据
  const daysWithNotes = {};
  const dailyCounts = {};
  notes.forEach(n => {
    const d = new Date(n.date);
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    daysWithNotes[key] = true;
    dailyCounts[key] = (dailyCounts[key] || 0) + 1;
  });

  // 过去30天热力图数据
  const heatmap = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    heatmap.push({
      date: key,
      day: d.getDate(),
      month: d.getMonth() + 1,
      weekday: d.getDay(),
      count: dailyCounts[key] || 0
    });
  }

  // 连续打卡天数
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    if (daysWithNotes[key]) streak++;
    else break;
  }

  // 近7天活跃度
  const recent7Count = heatmap.slice(-7).filter(h => h.count > 0).length;
  const recent30Count = heatmap.filter(h => h.count > 0).length;

  // 3. 内容深度分析
  const deepNotes = notes.filter(n => (n.content || '').length >= 200).length;
  const shallowNotes = notes.filter(n => (n.content || '').length < 50 && (n.content || '').length > 0).length;
  const emptyNotes = notes.filter(n => !n.content || n.content.trim() === '').length;

  // 4. 提取关键词和主题
  const allText = notes.map(n => n.title + ' ' + (n.content || '')).join(' ');
  const keywords = extractKeywordsSmart(allText, 15);

  // 5. 考研科目覆盖度检查
  const kaoyanSubjects = ['政治', '英语', '数学', '专业课', '马原', '毛概', '史纲', '思修', '高数', '线代', '概率论', '阅读', '写作', '翻译', '完形', '新题型', '作文'];
  const coveredKaoyan = kaoyanSubjects.filter(ks =>
    notes.some(n => (n.subject || '').includes(ks) || (n.title || '').includes(ks) || (n.content || '').includes(ks))
  );

  // 6. 笔记类型分析（概念型 vs 应用型 vs 总结型）
  const conceptNotes = notes.filter(n => /定义|概念|含义|是指|指的是|所谓|本质/.test((n.title||'') + (n.content||'')));
  const applyNotes = notes.filter(n => /例题|习题|题目|解题|方法|步骤|技巧|公式|计算/.test((n.title||'') + (n.content||'')));
  const summaryNotes = notes.filter(n => /总结|归纳|梳理|框架|思维导图|大纲|复习|回顾/.test((n.title||'') + (n.content||'')));

  // 7. 时间间隔分析
  const sortedDates = notes.map(n => new Date(n.date)).sort((a,b) => a-b);
  const intervals = [];
  for (let i = 1; i < sortedDates.length; i++) {
    intervals.push(Math.round((sortedDates[i] - sortedDates[i-1]) / (1000*60*60*24)));
  }
  const avgInterval = intervals.length > 0 ? Math.round(intervals.reduce((s,v) => s+v, 0) / intervals.length) : 0;
  const maxGap = intervals.length > 0 ? Math.max(...intervals) : 0;

  // 8. 学习时间段偏好
  const hourCounts = {};
  notes.forEach(n => {
    const h = new Date(n.date).getHours();
    hourCounts[h] = (hourCounts[h] || 0) + 1;
  });
  let peakHour = 0, peakCount = 0;
  Object.entries(hourCounts).forEach(([h, c]) => {
    if (c > peakCount) { peakCount = c; peakHour = parseInt(h); }
  });
  const timeSlot = peakHour < 8 ? '清晨' : peakHour < 12 ? '上午' : peakHour < 14 ? '中午' : peakHour < 18 ? '下午' : peakHour < 22 ? '晚上' : '深夜';

  // 9. 学习效率评分 (0-100)
  let score = 50;
  score += Math.min(20, notes.length * 3);           // 笔记数量加分
  score += Math.min(15, totalSubjects * 5);           // 科目覆盖加分
  score += Math.min(10, streak * 2);                  // 连续打卡加分
  score += Math.min(10, Math.round(recent7Count / 7 * 10)); // 近7天活跃加分
  score += Math.min(10, deepNotes * 2);               // 深度笔记加分
  score += Math.min(5, conceptNotes.length + applyNotes.length + summaryNotes.length); // 类型多样加分
  score -= Math.min(15, emptyNotes * 3);              // 空笔记扣分
  score -= Math.min(10, shallowNotes * 2);            // 浅笔记扣分
  if (maxGap > 14) score -= Math.min(10, Math.round(maxGap / 7)); // 长时间间断扣分
  score = Math.max(5, Math.min(95, score));

  // 10. 生成个性化建议
  const suggestions = generateSmartSuggestions({
    notes, totalChars, avgLen, subjectList, totalSubjects, topSubject, bottomSubject,
    streak, recent7Count, recent30Count, deepNotes, shallowNotes, emptyNotes,
    conceptNotes, applyNotes, summaryNotes, avgInterval, maxGap, timeSlot, peakHour,
    coveredKaoyan, score, keywords
  });

  return {
    notes, totalChars, avgLen, subjectList, totalSubjects, topSubject, bottomSubject,
    streak, recent7Count, recent30Count, deepNotes, shallowNotes, emptyNotes,
    conceptNotes, applyNotes, summaryNotes, avgInterval, maxGap, timeSlot, peakHour,
    coveredKaoyan, score, keywords, heatmap, suggestions
  };
}

// 智能关键词提取（按词组）
function extractKeywordsSmart(text, n) {
  const stopWords = new Set(['的','了','在','是','我','有','和','就','不','人','都','一','一个','上','也','很','到','说','要','去','你','会','着','没有','看','好','自己','这','那','他','她','它','们','什么','怎么','哪','为什么','因为','所以','如果','但是','可以','已经','还','又','再','才','刚','更','最','比较','非常','可能','应该','需要','能','会','让','把','被','从','对','与','或','而','且','虽然','然而','不过','然后','之后','之前','时候','时间','现在','今天','昨天','明天','这里','那里','这个','那个','这些','那些','做','进行','使用','通过','问题','情况','方面','方法','方式','过程','结果','发展','关系','作用','影响','基本','主要','重要','一定','必须','一种','一些','很多','其他','不同','相同','部分','全部','所有','整个','对于','关于','根据','按照','以及','及其','其中','其他','此外','另外','最后','第一','第二','第三','首先','其次','再次','然后','最后','总之','因此','所以','不过','就是','只是','the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','can','shall','to','of','in','for','on','with','at','by','from','as','into','through','during','before','after','and','or','it','its','that','this','these','those','which','what','when','where','who','how','all','not','but','if','so','no','we','he','she','they','their','his','her','them','then','now','just','also','very','only','some','any','each','every','both','few','more','most','other','such','than','too','very','well','one','two','new','like','make','use','get','see','know','think','say','come','take','look','go','find','give','tell','work','call','try','ask','need','feel','become','leave','put','mean','keep','let','begin','seem','help','turn','show','hear','play','run','move','live','believe','bring','happen','write','provide','sit','stand','lose','pay','meet','include','continue','set','learn','change','lead','understand','watch','follow','stop','create','speak','read','allow','add','spend','grow','open','walk','win','offer','remember','consider','appear','buy','serve','die','send','build','stay','fall','cut','reach','kill','raise','pass','sell','decide','return','explain','hope','develop','carry','break','receive','agree','support','hit','produce','eat','cover','catch','draw','choose']);
  const freq = {};

  // 中文词组提取：2-6字连续词组
  const chinese = text.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
  chinese.forEach(w => { if (!stopWords.has(w) && w.length >= 2) freq[w] = (freq[w]||0) + 1; });

  // 英文单词提取
  const english = text.match(/[a-zA-Z]{3,}/g) || [];
  english.forEach(w => { const l = w.toLowerCase(); if (!stopWords.has(l)) freq[l] = (freq[l]||0) + 1; });

  // 按频率排序，取前N个
  return Object.entries(freq)
    .filter(([,c]) => c >= 2)
    .sort((a,b) => b[1]-a[1])
    .slice(0, n)
    .map(([w]) => w);
}

// 生成个性化学习建议
function generateSmartSuggestions(a) {
  const tips = [];

  // 基于连续打卡
  if (a.streak >= 7) {
    tips.push({ icon: '🔥', text: '太厉害了！你已经连续 <strong>' + a.streak + '天</strong> 保持学习记录，这种坚持本身就是考研路上最宝贵的品质。继续保持这个节奏！' });
  } else if (a.streak >= 3) {
    tips.push({ icon: '💪', text: '连续 <strong>' + a.streak + '天</strong> 打卡学习，节奏不错。试着挑战连续7天，形成稳定的学习习惯。' });
  } else if (a.streak > 0) {
    tips.push({ icon: '🎯', text: '刚起步就有连续打卡，好的开始！考研是场马拉松，每天进步一点点就是胜利。' });
  } else {
    tips.push({ icon: '🚀', text: '今天就开始做笔记吧！哪怕只写一句话，让记录成为一种习惯。' });
  }

  // 基于长时间间隔
  if (a.maxGap > 14) {
    tips.push({ icon: '⚠️', text: '你有过 <strong>' + a.maxGap + '天</strong> 的学习空档期。建议每天至少花15分钟浏览旧笔记，保持知识不遗忘。' });
  }

  // 基于笔记深度
  if (a.emptyNotes > 0) {
    tips.push({ icon: '📝', text: '你有 <strong>' + a.emptyNotes + '篇</strong> 笔记没有填写内容。标题只是引子，把学到的知识点写下来才能真正内化。' });
  }
  if (a.shallowNotes > 3) {
    tips.push({ icon: '✍️', text: '有 <strong>' + a.shallowNotes + '篇</strong> 笔记内容较短。尝试对每个知识点写3-5句自己的理解，用自己的话复述才是真正的掌握。' });
  }

  // 基于笔记类型
  if (a.conceptNotes.length === 0 && a.notes.length >= 3) {
    tips.push({ icon: '📖', text: '你的笔记中缺少概念定义类的记录。建议为重要概念单独建笔记，用自己的话解释定义，这是考研答题的基础。' });
  }
  if (a.applyNotes.length === 0 && a.notes.length >= 3) {
    tips.push({ icon: '🧮', text: '还没看到解题方法类的笔记。把做错的题、经典的解题思路记录下来，形成自己的"解题秘籍"。' });
  }
  if (a.summaryNotes.length === 0 && a.notes.length >= 5) {
    tips.push({ icon: '🗺️', text: '笔记积累到一定程度后，建议做一次知识框架总结，用思维导图把所有知识点串起来。' });
  }

  // 基于科目覆盖
  if (a.totalSubjects <= 1 && a.notes.length >= 3) {
    tips.push({ icon: '📚', text: '笔记集中在单一科目。考研需要多科并进，建议为英语、政治、数学、专业课分别建立笔记体系。' });
  }
  if (a.bottomSubject && a.topSubject && a.bottomSubject[0] !== a.topSubject[0] && a.bottomSubject[1] <= 2) {
    tips.push({ icon: '⚖️', text: '「' + a.bottomSubject[0] + '」只有 <strong>' + a.bottomSubject[1] + '篇</strong> 笔记，明显偏少。接下来几天可以重点攻克这个科目。' });
  }

  // 基于学习时段
  if (a.timeSlot === '深夜') {
    tips.push({ icon: '😴', text: '你经常在深夜学习。考研是持久战，保证充足睡眠才能高效记忆。试着把学习时间调整到白天。' });
  } else if (a.timeSlot === '清晨') {
    tips.push({ icon: '🌅', text: '早起学习是个非常好的习惯！清晨大脑清醒，适合背诵英语单词和政治知识点。' });
  }

  // 基于平均间隔
  if (a.avgInterval >= 4) {
    tips.push({ icon: '📅', text: '平均每 <strong>' + a.avgInterval + '天</strong> 才写一篇笔记，频率偏低。建议每天至少写一篇，积少成多。' });
  } else if (a.avgInterval <= 1 && a.notes.length >= 5) {
    tips.push({ icon: '⭐', text: '几乎每天都有笔记记录，学习节奏非常棒！坚持下去，考研必胜！' });
  }

  // 基于综合评分
  if (a.score >= 80) {
    tips.push({ icon: '🏆', text: '综合学习评分 <strong>' + a.score + '/100</strong>，你的学习状态非常好！继续保持，重点关注薄弱科目即可。' });
  } else if (a.score >= 50) {
    tips.push({ icon: '📈', text: '综合学习评分 <strong>' + a.score + '/100</strong>，还有很大提升空间。增加笔记频率和深度是快速提分的关键。' });
  } else {
    tips.push({ icon: '🎯', text: '综合学习评分 <strong>' + a.score + '/100</strong>，现在是奋起直追的最佳时机。每天多写一篇笔记，一个月后你会感谢今天的自己。' });
  }

  return tips;
}

// ========== 渲染分析报告 ==========
function renderAnalysisHTML(a) {
  const scoreColor = a.score >= 80 ? '#22c55e' : a.score >= 50 ? '#f59e0b' : '#ef4444';
  const scoreEmoji = a.score >= 80 ? '🏆' : a.score >= 50 ? '📈' : '🎯';
  const scoreLabel = a.score >= 80 ? '优秀' : a.score >= 50 ? '良好' : '待提升';

  // 科目标签颜色
  const subColors = ['#6366f1','#ec4899','#14b8a6','#f97316','#8b5cf6','#06b6d4','#e11d48'];
  const subjectTags = a.subjectList.map(([name, count], i) =>
    '<span style="display:inline-block;background:' + subColors[i % subColors.length] + ';color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;margin:3px;font-weight:600">' + name + ' ×' + count + '</span>'
  ).join('');

  // 学习日历热力图
  const heatmapHTML = buildHeatmapHTML(a.heatmap);

  // 建议列表
  const suggestionItems = a.suggestions.map(t =>
    '<div style="padding:10px 14px;margin:6px 0;background:var(--bg-secondary, #f8fafc);border-radius:10px;border-left:3px solid var(--primary, #6366f1);font-size:13px;line-height:1.7">' +
    '<span style="font-size:16px;margin-right:6px">' + t.icon + '</span>' + t.text +
    '</div>'
  ).join('');

  // 关键词云
  const maxKw = Math.max(...a.keywords.map(([,c]) => c), 1);
  const keywordTags = a.keywords.map(([w, c]) => {
    const size = 11 + Math.round((c / maxKw) * 10);
    const opacity = 0.6 + (c / maxKw) * 0.4;
    return '<span style="display:inline-block;font-size:' + size + 'px;color:var(--primary, #6366f1);opacity:' + opacity + ';margin:4px 6px;font-weight:600;cursor:default" title="出现' + c + '次">' + w + '</span>';
  }).join('');

  return '' +
  // 评分大卡片
  '<div style="text-align:center;padding:24px 0 16px">' +
    '<div style="display:inline-block;position:relative">' +
      '<svg width="120" height="120" viewBox="0 0 120 120">' +
        '<circle cx="60" cy="60" r="52" fill="none" stroke="var(--border, #e2e8f0)" stroke-width="8"/>' +
        '<circle cx="60" cy="60" r="52" fill="none" stroke="' + scoreColor + '" stroke-width="8" stroke-dasharray="' + (a.score / 100 * 327) + ' 327" stroke-linecap="round" transform="rotate(-90 60 60)" style="transition:stroke-dasharray 1s ease"/>' +
      '</svg>' +
      '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">' +
        '<div style="font-size:32px;font-weight:800;color:' + scoreColor + '">' + a.score + '</div>' +
        '<div style="font-size:11px;color:var(--text-muted)">/ 100</div>' +
      '</div>' +
    '</div>' +
    '<div style="margin-top:8px;font-size:18px;font-weight:700">' + scoreEmoji + ' 学习状态：<span style="color:' + scoreColor + '">' + scoreLabel + '</span></div>' +
    '<div style="font-size:12px;color:var(--text-muted);margin-top:4px">基于笔记数量、深度、频率、连续性等维度综合评估</div>' +
  '</div>' +

  // 关键指标卡片
  '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0">' +
    '<div style="background:var(--bg-secondary, #f8fafc);border-radius:10px;padding:12px 8px;text-align:center"><div style="font-size:22px;font-weight:700;color:var(--primary)">' + a.notes.length + '</div><div style="font-size:10px;color:var(--text-muted)">📒 笔记数</div></div>' +
    '<div style="background:var(--bg-secondary, #f8fafc);border-radius:10px;padding:12px 8px;text-align:center"><div style="font-size:22px;font-weight:700;color:#22c55e">' + a.streak + '</div><div style="font-size:10px;color:var(--text-muted)">🔥 连续天</div></div>' +
    '<div style="background:var(--bg-secondary, #f8fafc);border-radius:10px;padding:12px 8px;text-align:center"><div style="font-size:22px;font-weight:700;color:#f59e0b">' + a.recent7Count + '/7</div><div style="font-size:10px;color:var(--text-muted)">📅 近7天</div></div>' +
    '<div style="background:var(--bg-secondary, #f8fafc);border-radius:10px;padding:12px 8px;text-align:center"><div style="font-size:22px;font-weight:700;color:#6366f1">' + a.totalSubjects + '</div><div style="font-size:10px;color:var(--text-muted)">📂 科目数</div></div>' +
  '</div>' +

  // 学习日历
  '<h3 style="margin:20px 0 8px;font-size:15px;color:var(--text-primary)">📅 近30天学习热力图</h3>' +
  '<div style="margin-bottom:16px">' + heatmapHTML + '</div>' +

  // 科目分布
  '<h3 style="margin:20px 0 8px;font-size:15px;color:var(--text-primary)">📊 科目分布</h3>' +
  '<div style="margin-bottom:12px">' + subjectTags + '</div>' +
  (a.subjectList.length > 1 ? '<div style="margin-bottom:16px">' + buildSubjectBars(a) + '</div>' : '') +

  // 内容分析
  '<h3 style="margin:20px 0 8px;font-size:15px;color:var(--text-primary)">📝 笔记质量分析</h3>' +
  '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">' +
    '<div style="background:#f0fdf4;border-radius:10px;padding:12px 8px;text-align:center"><div style="font-size:18px;font-weight:700;color:#16a34a">' + a.deepNotes + '篇</div><div style="font-size:10px;color:#15803d">📖 深度笔记</div><div style="font-size:9px;color:#86efac">≥200字</div></div>' +
    '<div style="background:#fefce8;border-radius:10px;padding:12px 8px;text-align:center"><div style="font-size:18px;font-weight:700;color:#ca8a04">' + a.shallowNotes + '篇</div><div style="font-size:10px;color:#a16207">✏️ 简略笔记</div><div style="font-size:9px;color:#fde047">＜50字</div></div>' +
    '<div style="background:#fef2f2;border-radius:10px;padding:12px 8px;text-align:center"><div style="font-size:18px;font-weight:700;color:#dc2626">' + a.emptyNotes + '篇</div><div style="font-size:10px;color:#b91c1c">⚠️ 空白笔记</div><div style="font-size:9px;color:#fca5a5">无内容</div></div>' +
  '</div>' +

  // 笔记类型
  '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">' +
    '<div style="background:var(--bg-secondary, #f8fafc);border-radius:10px;padding:10px 8px;text-align:center"><div style="font-size:11px;color:var(--text-muted)">📖 概念型</div><div style="font-size:18px;font-weight:700">' + a.conceptNotes.length + '</div></div>' +
    '<div style="background:var(--bg-secondary, #f8fafc);border-radius:10px;padding:10px 8px;text-align:center"><div style="font-size:11px;color:var(--text-muted)">🧮 解题型</div><div style="font-size:18px;font-weight:700">' + a.applyNotes.length + '</div></div>' +
    '<div style="background:var(--bg-secondary, #f8fafc);border-radius:10px;padding:10px 8px;text-align:center"><div style="font-size:11px;color:var(--text-muted)">🗺️ 总结型</div><div style="font-size:18px;font-weight:700">' + a.summaryNotes.length + '</div></div>' +
  '</div>' +

  // 关键词云
  (a.keywords.length > 0 ? '<h3 style="margin:20px 0 8px;font-size:15px;color:var(--text-primary)">☁️ 高频知识点</h3><div style="padding:12px;background:var(--bg-secondary, #f8fafc);border-radius:12px;text-align:center;line-height:2;margin-bottom:16px">' + keywordTags + '</div>' : '') +

  // 考研覆盖度
  (a.coveredKaoyan.length > 0 ? '<h3 style="margin:20px 0 8px;font-size:15px;color:var(--text-primary)">🎓 考研知识点覆盖</h3><div style="margin-bottom:16px;font-size:13px;color:var(--text-secondary);line-height:1.8">已覆盖：' + a.coveredKaoyan.map(k => '<span style="display:inline-block;background:#ede9fe;color:#7c3aed;padding:2px 10px;border-radius:12px;margin:2px;font-size:12px">' + k + '</span>').join(' ') + '<br><span style="font-size:11px;color:var(--text-muted)">提示：考研需要全面覆盖政治、英语、数学、专业课等核心科目</span></div>' : '') +

  // 学习习惯洞察
  '<h3 style="margin:20px 0 8px;font-size:15px;color:var(--text-primary)">🔍 学习习惯洞察</h3>' +
  '<div style="font-size:13px;color:var(--text-secondary);line-height:1.9;margin-bottom:16px;background:var(--bg-secondary, #f8fafc);border-radius:12px;padding:14px">' +
    '<div>📝 共 <strong>' + a.notes.length + '</strong> 篇笔记，总计 <strong>' + a.totalChars.toLocaleString() + '</strong> 字，平均每篇 <strong>' + a.avgLen + '</strong> 字</div>' +
    '<div>⏰ 你最喜欢在 <strong>' + a.timeSlot + '</strong> 学习（' + a.peakHour + ':00左右）</div>' +
    '<div>📅 平均每 <strong>' + (a.avgInterval || '--') + '</strong> 天写一篇笔记' + (a.maxGap > 7 ? '，最长间隔 <strong>' + a.maxGap + '</strong> 天' : '') + '</div>' +
    '<div>🔥 连续打卡 <strong>' + a.streak + '</strong> 天，近30天活跃 <strong>' + a.recent30Count + '</strong> 天</div>' +
    '<div>📂 覆盖 <strong>' + a.totalSubjects + '</strong> 个科目' + (a.topSubject ? '，最多的是「' + a.topSubject[0] + '」(' + a.topSubject[1] + '篇)' : '') + '</div>' +
  '</div>' +

  // 个性化建议
  '<h3 style="margin:20px 0 8px;font-size:15px;color:var(--text-primary)">💡 个性化学习建议</h3>' +
  '<div style="margin-bottom:16px">' + suggestionItems + '</div>' +

  // 复习提醒
  '<h3 style="margin:20px 0 8px;font-size:15px;color:var(--text-primary)">🔔 近期复习提醒</h3>' +
  '<div style="font-size:13px;color:var(--text-secondary);line-height:1.9;margin-bottom:8px;background:#fff7ed;border-radius:12px;padding:14px;border:1px solid #fed7aa">' +
    buildReviewReminders(a) +
  '</div>' +

  // 底部提示
  '<div style="text-align:center;font-size:11px;color:var(--text-muted);padding:16px 0 4px;border-top:1px solid var(--border);margin-top:16px">📊 以上分析基于你的笔记内容自动生成 · 每次新增笔记后重新分析可获得最新洞察</div>';
}

// 学习热力图
function buildHeatmapHTML(heatmap) {
  const weeks = [];
  for (let i = 0; i < heatmap.length; i += 7) {
    weeks.push(heatmap.slice(i, i + 7));
  }

  const dayLabels = ['日','一','二','三','四','五','六'];

  let html = '<div style="overflow-x:auto;padding:4px 0"><div style="display:flex;gap:3px;font-size:10px">';

  weeks.forEach((week, wi) => {
    html += '<div style="display:flex;flex-direction:column;gap:3px">';
    week.forEach((day, di) => {
      let bg;
      if (day.count === 0) bg = '#f1f5f9';
      else if (day.count === 1) bg = '#bbf7d0';
      else if (day.count === 2) bg = '#4ade80';
      else bg = '#16a34a';
      html += '<div title="' + day.date + '：' + day.count + '篇笔记" style="width:14px;height:14px;border-radius:3px;background:' + bg + ';cursor:pointer"></div>';
    });
    html += '</div>';
  });

  html += '</div>' +
    '<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:9px;color:var(--text-muted)">' +
      '<span>少</span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#f1f5f9"></span>' +
      '<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#bbf7d0"></span>' +
      '<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#4ade80"></span>' +
      '<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#16a34a"></span>' +
      '<span>多</span>' +
    '</div></div>';

  return html;
}

// 科目柱状图
function buildSubjectBars(a) {
  const maxCount = Math.max(...a.subjectList.map(([,c]) => c), 1);
  return a.subjectList.map(([name, count], i) => {
    const colors = ['#6366f1','#ec4899','#14b8a6','#f97316','#8b5cf6','#06b6d4'];
    const color = colors[i % colors.length];
    const width = Math.round(count / maxCount * 100);
    return '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
      '<div style="width:60px;font-size:12px;text-align:right;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + name + '</div>' +
      '<div style="flex:1;height:20px;background:var(--bg-secondary);border-radius:10px;overflow:hidden">' +
        '<div style="height:100%;width:' + width + '%;background:' + color + ';border-radius:10px;transition:width 0.5s ease;display:flex;align-items:center;justify-content:flex-end;padding-right:8px">' +
          '<span style="font-size:10px;color:#fff;font-weight:600">' + count + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// 复习提醒
function buildReviewReminders(a) {
  const now = new Date();
  let reminders = '';

  // 超过7天未复习的笔记
  const oldNotes = a.notes.filter(n => (now - new Date(n.date)) / (1000*60*60*24) > 7);
  if (oldNotes.length > 0) {
    const oldest = oldNotes.sort((x,y) => new Date(x.date) - new Date(y.date));
    reminders += '<div>⚠️ 有 <strong>' + oldNotes.length + '篇</strong> 笔记超过7天未复习，建议优先回顾：</div>';
    oldest.slice(0, 3).forEach(n => {
      reminders += '<div style="padding-left:16px;font-size:12px">📌 ' + n.title + '（' + formatDate(n.date) + '）</div>';
    });
    if (oldNotes.length > 3) reminders += '<div style="padding-left:16px;font-size:12px;color:var(--text-muted)">...还有 ' + (oldNotes.length - 3) + ' 篇</div>';
  }

  // 薄弱科目提醒
  if (a.bottomSubject && a.topSubject && a.bottomSubject[0] !== a.topSubject[0]) {
    reminders += '<div style="margin-top:8px">🎯 薄弱科目「<strong>' + a.bottomSubject[0] + '</strong>」仅 <strong>' + a.bottomSubject[1] + '篇</strong>笔记，今天可以花30分钟专门学习这个科目。</div>';
  }

  // 艾宾浩斯复习提醒（1天、2天、4天、7天、15天后应复习）
  const ebbinghaus = [1, 2, 4, 7, 15];
  const dueReview = [];
  a.notes.forEach(n => {
    const daysAgo = Math.floor((now - new Date(n.date)) / (1000*60*60*24));
    if (ebbinghaus.includes(daysAgo)) {
      dueReview.push({ title: n.title, daysAgo: daysAgo });
    }
  });
  if (dueReview.length > 0) {
    reminders += '<div style="margin-top:8px">🧠 根据艾宾浩斯遗忘曲线，以下笔记现在复习效果最佳：</div>';
    dueReview.slice(0, 3).forEach(r => {
      reminders += '<div style="padding-left:16px;font-size:12px">📌 ' + r.title + '（' + r.daysAgo + '天前记录，现在是第' + r.daysAgo + '天复习黄金期）</div>';
    });
  }

  if (!reminders) {
    reminders = '<div>✅ 目前没有需要紧急复习的笔记，继续保持！</div>';
  }

  return reminders;
}

function toggleAiDetail() {
  const area = document.getElementById('aiDetailArea');
  const icon = document.getElementById('aiToggleIcon');
  const text = document.getElementById('aiToggleText');
  if (!area) return;
  if (area.style.display === 'none') {
    area.style.display = 'block';
    if (icon) icon.textContent = '📉';
    if (text) text.textContent = '收起分析';
  } else {
    area.style.display = 'none';
    if (icon) icon.textContent = '📊';
    if (text) text.textContent = '展开详情';
  }
}
function addNote() {
  showModal('新建笔记',
    '<div class="form-group"><label>标题</label><input id="noteTitle"></div>' +
    '<div class="form-group"><label>科目/标签</label><input id="noteSubject"></div>' +
    '<div class="form-group"><label>📷 添加图片</label><button type="button" class="btn btn-small btn-primary" onclick="openImagePicker(\'noteImageInput\', this)">📷 选择图片</button><input type="file" id="noteImageInput" accept="image/*" onchange="previewNoteImage(this)" style="display:none"></div><div id="noteImagePreview" style="margin-top:8px"></div>' +
    '<div class="form-group"><label>内容</label><textarea id="noteContent" style="min-height:150px"></textarea></div>',
    () => {
      const title = document.getElementById('noteTitle').value.trim(), subject = document.getElementById('noteSubject').value.trim(), content = document.getElementById('noteContent').value.trim();
      const imgEl = document.querySelector('#noteImagePreview img');
      const image = imgEl ? imgEl.src : '';
      if (!title) return showToast('请输入标题');
      const notes = Storage.get('notes', []); notes.push({ id: Date.now().toString(), title, subject, content, image, date: new Date().toISOString() });
      Storage.set('notes', notes); renderNotes(document.getElementById('contentArea')); showToast('笔记已保存 📒');
    });
}
function previewNoteImage(input) {
  const preview = document.getElementById('noteImagePreview');
  if (!input.files || !input.files[0]) { preview.innerHTML = ''; return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    preview.innerHTML = '<img src="' + e.target.result + '" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid var(--border)">';
  };
  reader.readAsDataURL(input.files[0]);
}
function viewNote(id) {
  const notes = Storage.get('notes', []), note = notes.find(n => n.id === id); if (!note) return;
  const imgHtml = note.image ? '<div style="margin-bottom:8px"><img src="' + note.image + '" style="max-width:100%;max-height:300px;border-radius:8px"></div>' : '';
  showModal(note.title,
    '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">' + (note.subject ? '📂 ' + escapeHtml(note.subject) + ' · ' : '') + formatDate(note.date) + '</div>' +
    imgHtml +
    '<div id="noteDisplay" style="white-space:pre-wrap;line-height:1.8">' + escapeHtml(note.content) + '</div>' +
    '<textarea id="editNoteContent" style="display:none;width:100%;min-height:150px;margin-top:8px">' + escapeHtml(note.content) + '</textarea>' +
    '<div id="editNoteImageArea" style="display:none;margin-top:8px"><label>📷 更换图片</label><button type="button" class="btn btn-small btn-primary" onclick="openImagePicker(\'editNoteImageInput\', this)">📷 选择图片</button><input type="file" id="editNoteImageInput" accept="image/*" onchange="previewEditNoteImage(this)" style="display:none"><div id="editNoteImagePreview" style="margin-top:8px">' + (note.image ? '<img src="' + note.image + '" style="max-width:100%;max-height:200px;border-radius:8px">' : '') + '</div></div>' +
    '<button id="toggleEditBtn" class="btn btn-small btn-cancel" style="margin-top:8px">✏️ 编辑</button>',
    () => {
      const editArea = document.getElementById('editNoteContent');
      if (editArea && editArea.style.display !== 'none') {
        note.content = editArea.value.trim();
        const editImgEl = document.querySelector('#editNoteImagePreview img');
        note.image = editImgEl ? editImgEl.src : '';
        Storage.set('notes', notes); renderNotes(document.getElementById('contentArea')); showToast('笔记已更新 📒');
      } else closeModal();
    });
  setTimeout(() => {
    const btn = document.getElementById('toggleEditBtn'), editArea = document.getElementById('editNoteContent'), display = document.getElementById('noteDisplay'), editImgArea = document.getElementById('editNoteImageArea');
    if (btn && editArea) btn.onclick = () => {
      if (editArea.style.display === 'none') { editArea.style.display = 'block'; display.style.display = 'none'; editImgArea.style.display = 'block'; btn.textContent = '📖 预览'; document.getElementById('modalSaveBtn').textContent = '保存修改'; }
      else { editArea.style.display = 'none'; display.style.display = 'block'; editImgArea.style.display = 'none'; btn.textContent = '✏️ 编辑'; document.getElementById('modalSaveBtn').textContent = '关闭'; }
    };
  }, 100);
}
function previewEditNoteImage(input) {
  const preview = document.getElementById('editNoteImagePreview');
  if (!input.files || !input.files[0]) { return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    preview.innerHTML = '<img src="' + e.target.result + '" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid var(--border)">';
  };
  reader.readAsDataURL(input.files[0]);
}
function deleteNote(id) { let notes = Storage.get('notes', []); notes = notes.filter(n => n.id !== id); Storage.set('notes', notes); renderNotes(document.getElementById('contentArea')); showToast('笔记已删除'); }

// ==================== 刷题练习 ====================
function renderQuiz(container) {
  if (!quizState.subject || quizState.questions.length === 0) { renderQuizSetup(container); return; }
  renderQuizQuestion(container);
}
function renderQuizSetup(container) {
  const bank = getQuizBank();
  const quizTotal = Storage.get('quizTotal', 0), quizCorrect = Storage.get('quizCorrect', 0);

  // 收集所有分类
  const categories = {};
  Object.entries(bank).forEach(([key, subj]) => {
    const cat = subj.category || '其他';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({ key, ...subj });
  });

  // 统计各分类题目总数
  const catStats = {};
  Object.entries(categories).forEach(([cat, subjects]) => {
    catStats[cat] = subjects.reduce((sum, s) => sum + s.questions.length, 0);
  });
  const totalQuestions = Object.values(catStats).reduce((a, b) => a + b, 0);

  let html = '<div class="card"><div class="card-title">📝 刷题练习</div>';

  // 分类筛选标签
  html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px" id="quizFilterTags">';
  html += '<span class="quiz-filter-tag active" onclick="filterQuizCategory(\'all\', this)" data-cat="all">全部 (' + totalQuestions + '题)</span>';
  Object.entries(catStats).forEach(([cat, count]) => {
    html += '<span class="quiz-filter-tag" onclick="filterQuizCategory(\'' + cat.replace(/'/g, "\\'") + '\', this)">' + cat + ' (' + count + '题)</span>';
  });
  html += '</div>';

  // 科目列表
  html += '<div id="quizSubjectList">';
  Object.entries(categories).forEach(([cat, subjects]) => {
    html += '<div class="quiz-category-group" data-category="' + cat + '">';
    html += '<div style="font-size:13px;color:var(--text-muted);font-weight:600;margin-bottom:8px;margin-top:8px">' + cat + '</div>';
    subjects.forEach(s => {
      const doneMap = Storage.get('quizDone_' + s.key, {});
      const doneCount = Object.keys(doneMap).length;
      const totalQ = s.questions.length;
      const pct = totalQ > 0 ? Math.round(doneCount / totalQ * 100) : 0;
      const progressBar = totalQ > 0 ? '<div style="margin-top:4px;background:var(--border);border-radius:4px;height:4px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:var(--primary);border-radius:4px;transition:width 0.3s"></div></div>' : '';
      const progressText = doneCount > 0 ? '<div style="font-size:11px;color:var(--text-muted)">已完成 ' + doneCount + '/' + totalQ + ' 题 (' + pct + '%)</div>' : '<div style="font-size:11px;color:var(--text-muted)">' + totalQ + ' 道题目 · 未开始</div>';
      html += '<div class="quiz-subject-card" data-category="' + cat + '" data-subject="' + s.key + '" data-name="' + s.name + '" data-icon="' + (s.icon || '📝') + '" onclick="startQuiz(\'' + s.key + '\')"><span style="font-size:28px">' + (s.icon || '📝') + '</span><div style="flex:1"><div style="font-weight:600">' + s.name + '</div>' + progressText + progressBar + '</div></div>';
    });
    html += '</div>';
  });
  html += '</div>';

  html += '<div class="form-group" style="margin-top:16px"><label>每轮题目数量</label><select id="quizCount" onchange="quizState.questionCount=parseInt(this.value)"><option value="5">5 道</option><option value="10" selected>10 道</option><option value="15">15 道</option><option value="20">20 道</option></select></div>';
  html += '<div class="stats-grid"><div class="stat-card"><div class="stat-value">' + quizTotal + '</div><div class="stat-label">累计刷题</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + quizCorrect + '</div><div class="stat-label">正确数</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + (quizTotal > 0 ? Math.round(quizCorrect / quizTotal * 100) : 0) + '%</div><div class="stat-label">正确率</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + (quizTotal - quizCorrect) + '</div><div class="stat-label">错误数</div></div></div></div>';
  container.innerHTML = html;
}

// 刷题分类筛选
function filterQuizCategory(cat, el) {
  document.querySelectorAll('.quiz-filter-tag').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  document.querySelectorAll('.quiz-category-group').forEach(group => {
    group.style.display = (cat === 'all' || group.getAttribute('data-category') === cat) ? 'block' : 'none';
  });
  document.querySelectorAll('.quiz-subject-card').forEach(card => {
    card.style.display = 'flex';
  });
}
// 智能抽题：优先出没做过的题
function startQuiz(subject) {
  const bank = getQuizBank()[subject]; if (!bank) return;
  const cnt = Math.min(quizState.questionCount, bank.questions.length);
  const doneMap = Storage.get('quizDone_' + subject, {});
  const questionsWithIndex = bank.questions.map((q, i) => ({ ...q, _idx: i }));

  // 按做过次数排序：没做过的排前面
  questionsWithIndex.sort((a, b) => {
    const ca = doneMap[a._idx] || 0;
    const cb = doneMap[b._idx] || 0;
    return ca - cb;
  });

  // 如果前面的题全是没做过的，但数量不足 cnt，则补齐
  let picked;
  if (questionsWithIndex.filter(q => (doneMap[q._idx] || 0) === 0).length >= cnt) {
    // 没做过的足够多，从中随机选 cnt 道
    const fresh = questionsWithIndex.filter(q => (doneMap[q._idx] || 0) === 0);
    picked = fresh.sort(() => Math.random() - 0.5).slice(0, cnt);
  } else {
    // 没做过的不够，先取所有没做过的，再从做过的中随机补足
    const fresh = questionsWithIndex.filter(q => (doneMap[q._idx] || 0) === 0);
    const done = questionsWithIndex.filter(q => (doneMap[q._idx] || 0) > 0).sort(() => Math.random() - 0.5);
    picked = [...fresh, ...done].slice(0, cnt);
  }

  const shuffled = picked.sort(() => Math.random() - 0.5);
  quizState = { subject, questions: shuffled, currentIndex: 0, answers: [], selectedOption: -1, answered: false, questionCount: cnt };
  renderQuizQuestion(document.getElementById('contentArea')); playSound('start');
}
function renderQuizQuestion(container) {
  const q = quizState.questions[quizState.currentIndex];
  container.innerHTML =
    '<div class="card"><div class="card-title">' + (getQuizBank()[quizState.subject]?.icon || '📝') + ' ' + (getQuizBank()[quizState.subject]?.name || '') +
    ' <button class="btn btn-small btn-cancel" onclick="quitQuiz()" style="margin-left:auto">退出</button></div>' +
    '<div style="margin-bottom:12px;font-size:13px;color:var(--text-muted)">' + (quizState.currentIndex + 1) + ' / ' + quizState.questions.length + '</div>' +
    '<div style="font-size:15px;font-weight:600;margin-bottom:16px">' + (quizState.currentIndex + 1) + '. ' + escapeHtml(q.q) + '</div>' +
    q.opts.map((opt, i) => {
      let cls = 'quiz-answer';
      if (quizState.answered) { if (i === q.ans) cls += ' correct'; else if (i === quizState.selectedOption) cls += ' wrong'; }
      else if (i === quizState.selectedOption) cls += ' selected';
      const marker = quizState.answered ? (i === q.ans ? '✓ ' : (i === quizState.selectedOption ? '✗ ' : '')) : (i === quizState.selectedOption ? '● ' : '');
      return '<div class="' + cls + '" onclick="selectQuizAnswer(' + i + ')">' + marker + ['A','B','C','D'][i] + '. ' + escapeHtml(opt) + '</div>';
    }).join('') +
    (quizState.answered ? '<div style="margin-top:12px;text-align:center;font-weight:600;color:' + (quizState.selectedOption === q.ans ? '#27ae60' : '#e74c3c') + '">' +
      (quizState.selectedOption === q.ans ? '✅ 回答正确！' : '❌ 回答错误！正确答案是 ' + ['A','B','C','D'][q.ans]) + '</div>' +
      '<div style="text-align:center;margin-top:12px"><button class="btn btn-primary" onclick="' + (quizState.currentIndex < quizState.questions.length - 1 ? 'nextQuizQuestion()' : 'showQuizResult(document.getElementById(\'contentArea\'))') + '">' +
      (quizState.currentIndex < quizState.questions.length - 1 ? '下一题 →' : '查看成绩 🎯') + '</button></div>' : '') +
    '</div>';
}
function selectQuizAnswer(index) {
  if (quizState.answered) return;
  quizState.selectedOption = index; quizState.answered = true;
  const q = quizState.questions[quizState.currentIndex]; const isCorrect = index === q.ans;
  quizState.answers.push({ questionIndex: quizState.currentIndex, selected: index, correct: isCorrect });
  const quizTotal = Storage.get('quizTotal', 0) + 1, quizCorrect = Storage.get('quizCorrect', 0) + (isCorrect ? 1 : 0);
  Storage.set('quizTotal', quizTotal); Storage.set('quizCorrect', quizCorrect);

  // 记录题目被做过的次数（用于智能抽题）
  if (q._idx !== undefined) {
    const doneMap = Storage.get('quizDone_' + quizState.subject, {});
    doneMap[q._idx] = (doneMap[q._idx] || 0) + 1;
    Storage.set('quizDone_' + quizState.subject, doneMap);
  }

  if (isCorrect) playSound('correct'); else playSound('wrong');
  renderQuizQuestion(document.getElementById('contentArea'));
}
function nextQuizQuestion() { quizState.currentIndex++; quizState.selectedOption = -1; quizState.answered = false; renderQuizQuestion(document.getElementById('contentArea')); }
function showQuizResult(container) {
  const total = quizState.answers.length; const correct = quizState.answers.filter(a => a.correct).length; const wrong = total - correct; const pct = total > 0 ? Math.round(correct / total * 100) : 0;
  if (correct === total && total > 0) Storage.set('quizPerfect', true);
  let emoji, comment;
  if (pct === 100) { emoji = '🏆'; comment = '全部正确，太厉害了！'; }
  else if (pct >= 80) { emoji = '🌟'; comment = '表现优秀！'; }
  else if (pct >= 60) { emoji = '💪'; comment = '还不错，继续加油！'; }
  else { emoji = '📚'; comment = '需要加强练习。'; }

  // 计算当前科目整体完成情况
  const bank = getQuizBank()[quizState.subject];
  const doneMap = Storage.get('quizDone_' + quizState.subject, {});
  const totalQ = bank ? bank.questions.length : 0;
  const doneQ = Object.keys(doneMap).length;
  const allDone = doneQ >= totalQ && totalQ > 0;
  let progressHtml = '';
  if (bank) {
    progressHtml = '<div style="margin-top:12px;padding:12px;background:var(--primary-light);border-radius:8px;font-size:13px">' +
      '<div style="font-weight:600;margin-bottom:4px">📊 ' + (bank.icon || '') + ' ' + bank.name + ' 整体进度</div>' +
      '<div style="display:flex;align-items:center;gap:8px">' +
      '<div style="flex:1;background:var(--border);border-radius:4px;height:8px;overflow:hidden"><div style="height:100%;width:' + Math.round(doneQ/totalQ*100) + '%;background:var(--primary);border-radius:4px"></div></div>' +
      '<span style="white-space:nowrap;font-weight:600">' + doneQ + '/' + totalQ + '</span></div>' +
      (allDone ? '<div style="margin-top:6px;color:#27ae60;font-weight:600">✅ 本课程所有题目均已刷过！继续练习可巩固记忆</div>' : '<div style="margin-top:4px;color:var(--text-muted)">还有 ' + (totalQ - doneQ) + ' 道新题等你挑战</div>') +
      '</div>';
  }

  container.innerHTML =
    '<div class="card" style="text-align:center"><div style="font-size:48px;margin-bottom:12px">' + emoji + '</div>' +
    '<div style="font-size:24px;font-weight:700">' + correct + '/' + total + '</div>' +
    '<div style="color:var(--text-muted);margin-bottom:16px">' + comment + '</div>' +
    '<div class="stats-grid"><div class="stat-card"><div class="stat-value" style="color:#27ae60">' + correct + '</div><div class="stat-label">✅ 正确</div></div>' +
    '<div class="stat-card"><div class="stat-value" style="color:#e74c3c">' + wrong + '</div><div class="stat-label">❌ 错误</div></div></div>' +
    '<div style="margin:16px 0;font-size:28px;font-weight:700;color:var(--primary)">' + pct + '%</div>' +
    progressHtml +
    '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:16px">' +
    '<button class="btn btn-primary" onclick="retryQuiz()">🔄 再来一次</button>' +
    '<button class="btn btn-cancel" onclick="backToQuizMenu()">📋 换科目</button>' +
    (wrong > 0 ? '<button class="btn btn-cancel" onclick="reviewWrongAnswers()">🔍 查看错题</button>' : '') +
    '</div></div>';
}
function retryQuiz() { startQuiz(quizState.subject); }
function backToQuizMenu() { quizState = { subject: '', questions: [], currentIndex: 0, answers: [], selectedOption: -1, answered: false, questionCount: 10 }; renderQuiz(document.getElementById('contentArea')); }
function quitQuiz() { backToQuizMenu(); }
function reviewWrongAnswers() {
  const wrongQs = quizState.answers.filter(a => !a.correct).map(a => quizState.questions[a.questionIndex]);
  let html = ''; wrongQs.forEach((q, i) => { html += '<div style="margin-bottom:12px"><strong>' + (i + 1) + '. ' + escapeHtml(q.q) + '</strong><div style="color:#27ae60">✅ ' + ['A','B','C','D'][q.ans] + '. ' + escapeHtml(q.opts[q.ans]) + '</div></div>'; });
  showModal('错题回顾', html, () => closeModal());
  setTimeout(() => { const btn = document.getElementById('modalSaveBtn'); if (btn) btn.textContent = '关闭'; }, 50);
}

// ==================== 每日外刊 ====================
// 外刊阅读当前索引（用于历史浏览）
let readingHistoryIdx = 0;

// 判断一个字符是否是中文字符
function isChineseChar(ch) {
  return /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/.test(ch);
}

// 判断一段文本是否主要是中文
function isChineseParagraph(text) {
  if (!text || !text.trim()) return false;
  const trimmed = text.trim();
  let chineseCount = 0;
  let totalCount = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (char === ' ' || char === '\n' || char === '\r' || char === '\t') continue;
    totalCount++;
    if (isChineseChar(char)) chineseCount++;
  }
  return totalCount > 0 && (chineseCount / totalCount) > 0.5;
}

// 过滤掉文本中的中文内容，只保留英文
// China Daily 双语文章数据格式：英文句子紧跟中文翻译，混合在同一段落中
// 策略：逐字符扫描，将文本分为"英文段"和"中文段"，只保留英文段
function filterEnglishOnly(content) {
  if (!content) return '';
  const paragraphs = content.split(/\n\n+/);
  const result = [];

  for (const para of paragraphs) {
    if (!para.trim()) continue;
    // 纯中文段落直接跳过（中文占比 > 55%）
    if (isChineseParagraph(para)) continue;

    // 将段落拆分为交替的英文段/中文段
    // 规则：遇到连续的中文字符或中文标点 → 切换到中文段；否则为英文段
    const segments = [];
    let current = '';
    let isCurrentCn = null;

    for (let i = 0; i < para.length; i++) {
      const ch = para[i];
      // 空白符归入当前段
      if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
        current += ch;
        continue;
      }
      const chIsCn = isChineseChar(ch);

      if (isCurrentCn === null) {
        isCurrentCn = chIsCn;
        current += ch;
      } else if (chIsCn === isCurrentCn) {
        current += ch;
      } else {
        // 类型切换，保存当前段
        segments.push({ text: current, isCn: isCurrentCn });
        current = ch;
        isCurrentCn = chIsCn;
      }
    }
    if (current) segments.push({ text: current, isCn: isCurrentCn });

    // 只保留非中文段（且长度 >= 3，避免零散标点）
    const englishParts = segments
      .filter(s => !s.isCn && s.text.trim().length >= 3)
      .map(s => s.text.trim());

    if (englishParts.length > 0) {
      result.push(englishParts.join(' '));
    }
  }

  return result.join('\n\n');
}

function renderReading(container) {
  const readings = getDailyReadings();
  if (readings.length === 0) { container.innerHTML = '<div class="card"><div class="card-title">📰 每日外刊阅读</div><div style="text-align:center;color:var(--text-muted);padding:20px">暂无外刊文章</div></div>'; return; }

  // 按日期排序（最新的排前面）
  const sortedReadings = [...readings].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // 始终显示最新一篇（索引0），用户可以通过按钮看历史
  if (readingHistoryIdx >= sortedReadings.length) readingHistoryIdx = 0;
  const reading = sortedReadings[readingHistoryIdx];
  const isLatest = readingHistoryIdx === 0;

  // 过滤掉中文内容，只保留英文正文
  const englishOnlyContent = filterEnglishOnly(reading.content || '');

  let vocabHtml = '';
  if (reading.vocab && reading.vocab.length > 0) {
    vocabHtml = '<div style="margin-top:12px"><strong>📝 重点词汇</strong><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">' +
      reading.vocab.map(v => '<span style="background:var(--primary-light);padding:4px 10px;border-radius:6px;font-size:13px"><strong>' + escapeHtml(v.word) + '</strong> ' + escapeHtml(v.meaning) + '</span>').join('') +
      '</div></div>';
  }

  const sourceHtml = reading.url
    ? '<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">📌 ' + escapeHtml(reading.source) + ' · <a href="' + reading.url + '" target="_blank" style="color:var(--primary);text-decoration:underline">查看原文 →</a></div>'
    : '<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">📌 ' + escapeHtml(reading.source) + '</div>';

  const newBadge = isLatest ? '<span style="display:inline-block;background:#27ae60;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:8px;vertical-align:middle">NEW</span>' : '';
  const latestLabel = isLatest
    ? '<div style="font-size:12px;color:#27ae60;font-weight:600;margin-bottom:4px">🆕 今日最新文章 · 每日自动更新</div>'
    : '<div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">📖 历史文章</div>';

  container.innerHTML =
    '<div class="card"><div class="card-title">📰 每日外刊阅读' + newBadge + '</div>' +
    latestLabel +
    '<div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">📅 ' + reading.date + '</div>' +
    '<h3 style="margin-bottom:4px">' + escapeHtml(reading.title) + '</h3>' + sourceHtml +
    '<div style="line-height:1.9;white-space:pre-wrap;font-size:15px">' + englishOnlyContent + '</div>' +
    (reading.translation
      ? '<div style="margin-top:16px"><button class="btn btn-small btn-primary" onclick="toggleReadingTranslation()" id="toggleTransBtn" style="width:100%;padding:12px;font-size:15px;border-radius:10px;font-weight:600">📖 显示中文翻译</button>' +
        '<div id="readingTranslation" style="display:none;margin-top:12px;padding:16px;background:var(--primary-light);border-radius:10px;line-height:2;white-space:pre-wrap;font-size:15px;color:var(--text-secondary);border-left:4px solid var(--primary)">' + reading.translation + '</div></div>'
      : '') +
    vocabHtml +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">' +
    '<button class="btn btn-small btn-cancel" onclick="nextReadingArticle()"' + (readingHistoryIdx <= 0 ? ' disabled' : '') + '>← 更新的文章</button>' +
    '<span style="font-size:12px;color:var(--text-muted)">' + (readingHistoryIdx + 1) + ' / ' + sortedReadings.length + ' 篇</span>' +
    '<button class="btn btn-small btn-cancel" onclick="prevReadingArticle()"' + (readingHistoryIdx >= sortedReadings.length - 1 ? ' disabled' : '') + '>更早的文章 →</button></div>' +
    (!isLatest ? '<div style="text-align:center;margin-top:8px"><button class="btn btn-small btn-primary" onclick="gotoLatestReading()">🆕 回到最新文章</button></div>' : '') +
    '<div style="margin-top:12px;padding:12px;background:var(--primary-light);border-radius:8px;font-size:13px">' +
    '<div style="font-weight:600;margin-bottom:4px">📡 文章来源：中国日报英语点津</div>' +
    '<div style="color:var(--text-muted)">每日自动抓取 China Daily Language Tips 双语新闻，涵盖科技、经济、文化、生活等领域。目前共 <strong>' + sortedReadings.length + '</strong> 篇，每天 6:00 自动更新。</div>' +
    '<a href="https://language.chinadaily.com.cn/news_bilingual" target="_blank" style="display:inline-block;margin-top:8px;color:var(--primary);font-weight:600;text-decoration:underline">🔗 访问中国日报英语点津，看更多双语新闻 →</a></div></div>';
}

function prevReadingArticle() {
  const readings = getDailyReadings().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (readingHistoryIdx < readings.length - 1) {
    readingHistoryIdx++;
    renderReading(document.getElementById('contentArea'));
  }
}
function nextReadingArticle() {
  if (readingHistoryIdx > 0) {
    readingHistoryIdx--;
    renderReading(document.getElementById('contentArea'));
  }
}
function gotoLatestReading() {
  readingHistoryIdx = 0;
  renderReading(document.getElementById('contentArea'));
}
function toggleReadingTranslation() {
  const el = document.getElementById('readingTranslation');
  const btn = document.getElementById('toggleTransBtn');
  if (!el || !btn) return;
  if (el.style.display === 'none') {
    el.style.display = 'block';
    btn.textContent = '📕 隐藏中文翻译';
  } else {
    el.style.display = 'none';
    btn.textContent = '📖 显示中文翻译';
  }
}

// ==================== 学习周报 ====================
function getWeekRange(offset) {
  const now = new Date(); const dayOfWeek = now.getDay();
  const monday = new Date(now); monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + offset * 7); monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}
function getWeekData(offset) {
  const range = getWeekRange(offset);
  const tasks = Storage.get('tasks', []); const errors = Storage.get('errors', []); const notes = Storage.get('notes', []); const memos = Storage.get('memos', []);
  const inRange = item => { const d = new Date(item.date); return d >= range.start && d <= range.end; };
  const weekTasks = tasks.filter(inRange); const weekErrors = errors.filter(inRange); const weekNotes = notes.filter(inRange); const weekMemos = memos.filter(inRange);
  const completedTasks = weekTasks.filter(t => t.done).length;
  const dailyData = [];
  for (let i = 0; i < 7; i++) { const d = new Date(range.start); d.setDate(d.getDate() + i); const dateStr = d.toDateString(); const dayTasks = tasks.filter(t => new Date(t.date).toDateString() === dateStr); dailyData.push({ date: d, label: ['一','二','三','四','五','六','日'][i], tasks: dayTasks.length, completed: dayTasks.filter(t=>t.done).length }); }
  return { range, totalTasks: weekTasks.length, completedTasks, errorCount: weekErrors.length, noteCount: weekNotes.length, memoCount: weekMemos.length, dailyData };
}
function renderWeekly(container) {
  const curr = getWeekData(weeklyOffset);
  const prev = getWeekData(weeklyOffset - 1);
  const maxVal = Math.max(...curr.dailyData.map(d => d.tasks), 1);
  const taskChange = prev.totalTasks > 0 ? Math.round((curr.totalTasks - prev.totalTasks) / prev.totalTasks * 100) : (curr.totalTasks > 0 ? 100 : 0);
  const fmt = d => (d.getMonth() + 1) + '/' + d.getDate();
  const label = weeklyOffset === 0 ? '本周 (' + fmt(curr.range.start) + ' - ' + fmt(curr.range.end) + ')' : (weeklyOffset === -1 ? '上周' : fmt(curr.range.start) + ' - ' + fmt(curr.range.end));
  container.innerHTML =
    '<div class="card"><div class="card-title">📊 学习周报</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
    '<button class="btn btn-small btn-cancel" onclick="weeklyOffset--;renderWeekly(document.getElementById(\'contentArea\'))">◀ 上周</button>' +
    '<span style="font-weight:600">' + label + '</span>' +
    '<button class="btn btn-small btn-cancel" onclick="weeklyOffset++;renderWeekly(document.getElementById(\'contentArea\'))">下周 ▶</button></div>' +
    (weeklyOffset !== 0 ? '<div style="text-align:center;margin-bottom:8px"><button class="btn btn-small btn-primary" onclick="weeklyOffset=0;renderWeekly(document.getElementById(\'contentArea\'))">回到本周</button></div>' : '') +
    '<div class="stats-grid"><div class="stat-card"><div class="stat-value">' + curr.completedTasks + '/' + curr.totalTasks + '</div><div class="stat-label">任务完成</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + curr.errorCount + '</div><div class="stat-label">错题记录</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + curr.noteCount + '</div><div class="stat-label">学习笔记</div></div>' +
    '<div class="stat-card"><div class="stat-value">' + curr.memoCount + '</div><div class="stat-label">备忘录</div></div></div>' +
    '<div style="margin-top:12px"><strong>📈 每日任务趋势</strong></div>' +
    '<div class="weekly-bar-chart">' + curr.dailyData.map(d => { const h = d.tasks > 0 ? Math.max((d.tasks / maxVal) * 150, 10) : 4; return '<div class="weekly-bar" style="height:' + h + 'px"><span class="bar-value">' + (d.tasks > 0 ? d.tasks : '') + '</span><span class="bar-label">' + d.label + '</span></div>'; }).join('') + '</div>' +
    '</div>';
}

// ==================== 研友圈（Supabase 云端同步）====================
async function supabaseFetch(path, options = {}) {
  const url = SUPABASE_URL + '/rest/v1/' + path;
  const headers = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', ...options.headers };
  const res = await fetch(url, { ...options, headers }); if (!res.ok) { const errText = await res.text(); throw new Error(res.status + ' ' + errText); } return res.json();
}
async function loadCloudPosts() {
  try {
    const [posts, replies, likes] = await Promise.all([supabaseFetch('buddies_posts?select=*&order=created_at.desc'), supabaseFetch('buddies_replies?select=*&order=created_at.asc'), supabaseFetch('buddies_likes?select=*')]);
    const likeCountMap = {}; (likes || []).forEach(l => { likeCountMap[l.post_id] = (likeCountMap[l.post_id] || 0) + 1; });
    const postsWithReplies = (posts || []).map(p => ({ id: p.id, nickname: p.nickname, avatar: p.avatar, content: p.content, tags: p.tags || [], likes: likeCountMap[p.id] || 0, replies: (replies || []).filter(r => r.post_id === p.id).map(r => ({ id: r.id, nickname: r.nickname, content: r.content, date: r.created_at })), date: p.created_at }));
    const localPosts = Storage.get('buddies_posts', []); const cloudIds = new Set(postsWithReplies.map(p => p.id));
    buddiesLocalPosts = [...postsWithReplies, ...localPosts.filter(p => !cloudIds.has(p.id))];
    Storage.set('buddies_posts', buddiesLocalPosts); Storage.set('buddies_last_sync', Date.now()); return buddiesLocalPosts;
  } catch (e) { console.log('云端加载失败:', e.message); if (buddiesLocalPosts.length === 0) buddiesLocalPosts = Storage.get('buddies_posts', []); return buddiesLocalPosts; }
}
function getBuddiesPosts() { return buddiesLocalPosts.length > 0 ? buddiesLocalPosts : Storage.get('buddies_posts', []); }

async function renderBuddies(container) {
  const cachedPosts = Storage.get('buddies_posts', []); if (buddiesLocalPosts.length === 0 && cachedPosts.length > 0) buddiesLocalPosts = cachedPosts;
  renderBuddiesContent(container);
  try { await loadCloudPosts(); } catch (e) { console.log('云端同步出错:', e.message); }
  if (currentTab === 'buddies') renderBuddiesContent(container);
}
function renderBuddiesContent(container) {
  const posts = getBuddiesPosts(); const nickname = Storage.get('buddies_nickname', '');
  let sortedPosts = [...posts];
  if (buddiesSort === 'newest') sortedPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
  else sortedPosts.sort((a, b) => (b.likes || 0) - (a.likes || 0) + (b.replies ? b.replies.length : 0) - (a.replies ? a.replies.length : 0));
  const postCount = posts.length, replyCount = posts.reduce((sum, p) => sum + (p.replies ? p.replies.length : 0), 0);

  // 检查登录状态 - 使用本地昵称
  const currentNickname = (typeof Auth !== 'undefined' && Auth.isLoggedIn()) 
    ? Auth.nickname() 
    : Storage.get('buddies_nickname', '');
  const isLoggedIn = typeof Auth !== 'undefined' && Auth.isLoggedIn();

  container.innerHTML =
    '<div class="card"><div class="card-title">💬 研友圈 ☁️</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
    '<button class="btn btn-small btn-primary" onclick="showNewPostModal()">+ 发布新帖</button>' +
    '<button class="btn btn-small btn-cancel" onclick="refreshBuddies()">🔄 刷新</button></div>' +
    '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">📝 ' + postCount + ' 个帖子 · 💬 ' + replyCount + ' 条回复</div>' +
    (isLoggedIn
      ? '<div style="margin-bottom:8px;font-size:13px">👤 ' + escapeHtml(currentNickname) + ' <span style="cursor:pointer;color:var(--primary);font-size:12px" onclick="setNickname()">修改</span></div>'
      : (!currentNickname 
        ? '<div style="margin-bottom:8px">⚠️ <span style="cursor:pointer;color:var(--primary)" onclick="setNickname()">设置昵称</span> 后即可发言</div>'
        : '<div style="margin-bottom:8px;font-size:13px">👤 ' + escapeHtml(currentNickname) + ' <span style="cursor:pointer;color:var(--primary);font-size:12px" onclick="setNickname()">修改</span></div>')) +
    '<div style="margin-bottom:12px"><span style="cursor:pointer;margin-right:12px;font-weight:' + (buddiesSort==='newest'?'600':'400') + '" onclick="buddiesSort=\'newest\';renderBuddiesContent(document.getElementById(\'contentArea\'))">🕐 最新</span>' +
    '<span style="cursor:pointer;font-weight:' + (buddiesSort==='hottest'?'600':'400') + '" onclick="buddiesSort=\'hottest\';renderBuddiesContent(document.getElementById(\'contentArea\'))">🔥 最热</span></div>' +
    (sortedPosts.length === 0 ? '<div style="text-align:center;color:var(--text-muted);padding:20px">💬 还没有帖子，快来发布第一条吧！</div>' : sortedPosts.map(p => renderPostCard(p)).join('')) +
    '</div>';
}
function renderPostCard(post) {
  const replyCount = post.replies ? post.replies.length : 0;
  const tagsHtml = post.tags && post.tags.length > 0 ? '<div class="post-tags">' + post.tags.map(t => '<span class="post-tag">' + escapeHtml(t) + '</span>').join('') + '</div>' : '';
  const currentNick = Storage.get('buddies_nickname', '');
  return '<div class="post-card" id="post-' + post.id + '">' +
    '<div class="post-header"><span class="post-avatar">' + (post.avatar || '👤') + '</span><span class="post-nickname">' + escapeHtml(post.nickname || '匿名') + '</span><span class="post-date">' + formatDate(post.date) + '</span></div>' +
    tagsHtml +
    '<div class="post-content">' + escapeHtml(post.content).replace(/\n/g, '<br>') + '</div>' +
    '<div class="post-actions">' +
    '<span class="post-action" onclick="likePost(\'' + post.id + '\')">👍 ' + (post.likes || 0) + '</span>' +
    '<span class="post-action" onclick="toggleReplyBox(\'' + post.id + '\')">💬 ' + replyCount + ' 回复</span>' +
    '<span class="post-action" onclick="sharePost(\'' + post.id + '\')">🔗 分享</span>' +
    (post.nickname === currentNick ? '<span class="post-action" style="color:#e74c3c" onclick="deletePost(\'' + post.id + '\')">🗑️ 删除</span>' : '') +
    '</div>' +
    (replyCount > 0 ? '<div>' + post.replies.map(r =>
      '<div class="reply-item"><strong>' + escapeHtml(r.nickname || '匿名') + '</strong> <span style="font-size:11px;color:var(--text-muted)">' + formatDate(r.date) + '</span>' +
      (r.nickname === currentNick ? '<span style="float:right;color:#e74c3c;cursor:pointer;font-size:12px" onclick="deleteReply(\'' + post.id + '\',\'' + r.id + '\')">🗑️</span>' : '') +
      '<div style="font-size:13px">' + escapeHtml(r.content).replace(/\n/g, '<br>') + '</div></div>').join('') + '</div>' : '') +
    '<div id="reply-box-' + post.id + '" style="display:none;margin-top:8px"><textarea id="replyText-' + post.id + '" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);min-height:60px;font-size:13px" placeholder="写下你的回复..."></textarea><div style="margin-top:6px;display:flex;gap:8px"><button class="btn btn-small btn-primary" onclick="submitReply(\'' + post.id + '\')">发送</button><button class="btn btn-small btn-cancel" onclick="toggleReplyBox(\'' + post.id + '\')">取消</button></div></div>' +
    '</div>';
}

async function showNewPostModal() {
  // 优先使用登录昵称，否则用研友圈昵称
  let nickname = (typeof Auth !== 'undefined' && Auth.isLoggedIn()) 
    ? Auth.nickname() 
    : Storage.get('buddies_nickname', '');
  if (!nickname) { setNickname(); return; }
  showModal('发布新帖',
    '<div class="form-group"><label>昵称</label><input value="' + escapeHtml(nickname) + '" disabled></div>' +
    '<div class="form-group"><label>内容</label><textarea id="postContent" style="min-height:100px"></textarea></div>' +
    '<div class="form-group"><label>标签（逗号分隔）</label><input id="postTags" placeholder="考研, 数学, 打卡"></div>',
    async () => {
      const content = document.getElementById('postContent').value.trim(), tagsRaw = document.getElementById('postTags').value.trim();
      if (!content) return showToast('请输入内容');
      const tags = tagsRaw ? tagsRaw.split(/[,，]/).map(t => t.trim()).filter(t => t) : [];
      const avatar = Storage.get('buddies_avatar', '👤');
      const postId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
      const newPost = { id: postId, nickname, avatar, content, tags, likes: 0, replies: [], date: new Date().toISOString() };
      const posts = getBuddiesPosts(); posts.unshift(newPost); Storage.set('buddies_posts', posts); buddiesLocalPosts = posts;
      renderBuddies(document.getElementById('contentArea')); showToast('帖子发布成功！📢');
      try { await supabaseFetch('buddies_posts', { method: 'POST', body: JSON.stringify({ id: postId, nickname, avatar: avatar || '👤', content, tags: tags || [], likes: 0, created_at: newPost.date }), headers: { 'Prefer': 'return=minimal' } }); } catch (e) { console.log('保存到云端失败:', e.message); }
    });
}
function setNickname() {
  const currentNickname = (typeof Auth !== 'undefined' && Auth.isLoggedIn()) 
    ? Auth.nickname() 
    : Storage.get('buddies_nickname', '');
  const currentAvatar = Storage.get('buddies_avatar', '👤');
  const avatars = ['👤', '😊', '💪', '📚', '🎓', '🌟', '🔥', '💡', '🎯', '🌈', '🦸', '🧑‍🎓', '👩‍🎓', '👨‍🎓', '🤓', '😎', '🦄', '🐱', '🐶', '🌻'];
  showModal('设置个人信息',
    '<div class="form-group"><label>选择头像</label><div style="display:flex;flex-wrap:wrap;gap:8px">' + avatars.map(a => '<span style="cursor:pointer;font-size:24px;padding:4px;border-radius:8px' + (a === currentAvatar ? ';border:2px solid var(--primary)' : '') + '" onclick="document.getElementById(\'buddyAvatar\').value=\'' + a + '\'">' + a + '</span>').join('') + '</div></div>' +
    '<div class="form-group"><label>昵称</label><input id="buddyNickname" value="' + escapeHtml(currentNickname) + '"></div>' +
    '<input type="hidden" id="buddyAvatar" value="' + currentAvatar + '">',
    () => {
      const nickname = document.getElementById('buddyNickname').value.trim(), avatar = document.getElementById('buddyAvatar').value.trim() || '👤';
      if (!nickname) return showToast('请输入昵称');
      Storage.set('buddies_nickname', nickname); Storage.set('buddies_avatar', avatar);
      // 如果已登录，更新登录用户的昵称
      if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
        const user = Auth.get();
        if (user) {
          user.nickname = nickname;
          localStorage.setItem('study_current_user', JSON.stringify(user));
          updateUserInfo();
        }
      }
      renderBuddies(document.getElementById('contentArea')); showToast('已保存 ✅');
    });
}
function toggleReplyBox(postId) { const box = document.getElementById('reply-box-' + postId); if (!box) return; box.style.display = box.style.display === 'none' ? 'block' : 'none'; if (box.style.display === 'block') { const ta = document.getElementById('replyText-' + postId); if (ta) ta.focus(); } }
async function submitReply(postId) {
  const textarea = document.getElementById('replyText-' + postId); const content = textarea ? textarea.value.trim() : ''; if (!content) return showToast('请输入回复');
  const nickname = (typeof Auth !== 'undefined' && Auth.isLoggedIn()) 
    ? Auth.nickname() 
    : Storage.get('buddies_nickname', '');
  if (!nickname) { setNickname(); return; }
  const replyId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
  const newReply = { id: replyId, nickname, content, date: new Date().toISOString() };
  const posts = getBuddiesPosts(); const post = posts.find(p => p.id === postId); if (!post) return;
  if (!post.replies) post.replies = []; post.replies.push(newReply);
  Storage.set('buddies_posts', posts); buddiesLocalPosts = posts; textarea.value = '';
  renderBuddies(document.getElementById('contentArea')); showToast('回复成功 💬');
  try { await supabaseFetch('buddies_replies', { method: 'POST', body: JSON.stringify({ id: replyId, post_id: postId, nickname, content, created_at: newReply.date }), headers: { 'Prefer': 'return=minimal' } }); } catch (e) { console.log('回复同步失败:', e.message); }
}
async function refreshBuddies() {
  Storage.set('buddies_last_sync', 0); showToast('正在刷新... ☁️');
  try { const fresh = await loadCloudPosts(); if (fresh && fresh.length > 0) buddiesLocalPosts = fresh; } catch (e) { console.log('刷新失败:', e.message); }
  if (currentTab === 'buddies') renderBuddiesContent(document.getElementById('contentArea')); showToast('已刷新 ☁️');
}
async function likePost(postId) {
  const posts = getBuddiesPosts(); const post = posts.find(p => p.id === postId); if (!post) return;
  const likedPosts = Storage.get('buddies_liked', []);
  if (likedPosts.includes(postId)) { post.likes = Math.max(0, (post.likes || 0) - 1); Storage.set('buddies_liked', likedPosts.filter(id => id !== postId)); }
  else { post.likes = (post.likes || 0) + 1; likedPosts.push(postId); Storage.set('buddies_liked', likedPosts); playSound('correct'); }
  Storage.set('buddies_posts', posts); buddiesLocalPosts = posts; renderBuddies(document.getElementById('contentArea'));
  try { if (likedPosts.includes(postId)) await supabaseFetch('buddies_likes', { method: 'POST', body: JSON.stringify({ post_id: postId, user_id: 'anon' }), headers: { 'Prefer': 'return=minimal' } }); } catch (e) {}
}
async function deletePost(postId) {
  if (!confirm('确定删除？')) return;
  let posts = getBuddiesPosts(); posts = posts.filter(p => p.id !== postId); Storage.set('buddies_posts', posts); buddiesLocalPosts = posts;
  renderBuddies(document.getElementById('contentArea')); showToast('已删除');
  try { await fetch(SUPABASE_URL + '/rest/v1/buddies_posts?id=eq.' + postId, { method: 'DELETE', headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Prefer': 'return=minimal' } }); } catch (e) {}
}
async function deleteReply(postId, replyId) {
  if (!confirm('确定删除？')) return;
  const posts = getBuddiesPosts(); const post = posts.find(p => p.id === postId); if (post && post.replies) { post.replies = post.replies.filter(r => r.id !== replyId); Storage.set('buddies_posts', posts); buddiesLocalPosts = posts; }
  renderBuddies(document.getElementById('contentArea')); showToast('已删除');
  try { await fetch(SUPABASE_URL + '/rest/v1/buddies_replies?id=eq.' + replyId, { method: 'DELETE', headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Prefer': 'return=minimal' } }); } catch (e) {}
}
function sharePost(postId) {
  const posts = getBuddiesPosts(); const post = posts.find(p => p.id === postId); if (!post) return;
  const text = '【不摆烂研习社】' + post.nickname + '：' + post.content.substring(0, 100);
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => showToast('已复制 📋')).catch(() => showToast(text, 3000));
  else showToast(text, 3000);
}

// ==================== 图片上传辅助 ====================
function openImagePicker(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;

  // 手机端：弹出拍照/相册选择菜单
  if (/Mobi|Android|iPhone/i.test(navigator.userAgent)) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:10000;background:var(--card-bg);border-radius:16px 16px 0 0;padding:20px 16px 32px;box-shadow:0 -4px 24px rgba(0,0,0,.2);animation:slideUp .2s ease';
    modal.innerHTML = `
      <div style="text-align:center;margin-bottom:16px;font-weight:600;font-size:15px">选择图片</div>
      <button class="btn btn-primary" style="width:100%;margin-bottom:10px;padding:12px;font-size:15px" id="picker_camera">📷 拍照</button>
      <button class="btn btn-cancel" style="width:100%;margin-bottom:16px;padding:12px;font-size:15px" id="picker_album">🖼️ 从相册选择</button>
      <button class="btn" style="width:100%;padding:12px;font-size:14px;color:var(--text-secondary)" id="picker_cancel">取消</button>
    `;
    document.body.appendChild(modal);
    // 遮罩
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.4)';
    document.body.appendChild(overlay);

    const close = () => { modal.remove(); overlay.remove(); };
    overlay.onclick = close;
    modal.querySelector('#picker_cancel').onclick = close;

    modal.querySelector('#picker_camera').onclick = () => {
      close();
      input.setAttribute('capture', 'environment');
      input.click();
      // 选择后移除 capture，下次可以重新选
      setTimeout(() => input.removeAttribute('capture'), 300);
    };
    modal.querySelector('#picker_album').onclick = () => {
      close();
      input.removeAttribute('capture');
      input.click();
    };
  } else {
    // 电脑端：直接打开文件选择器
    input.removeAttribute('capture');
    input.click();
  }
}

// ==================== 工具函数 ====================
function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
function formatDate(dateStr) {
  if (!dateStr) return ''; const d = new Date(dateStr), now = new Date(), diff = now - d;
  if (diff < 60000) return '刚刚'; if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'; if (diff < 172800000) return '昨天';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ==================== 事件绑定 ====================
document.addEventListener('click', function(e) {
  if (e.target.id === 'modalOverlay') closeModal();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeModal();
});

// ==================== 初始化 ====================
async function init() {
  // 认证检查（云端同步 + 本地账号系统）
  if (typeof checkAuthAndInit === 'function') {
    const authed = await checkAuthAndInit();
    if (!authed) return;
  }

  try { if (typeof SharedData !== 'undefined') await SharedData.load(); } catch (e) { console.error('数据加载失败:', e); }

  try { initTheme(); } catch (e) { console.error('主题初始化失败:', e); }
  try { initNavigation(); } catch (e) { console.error('导航初始化失败:', e); }
  try { updateMottos(); } catch (e) { console.error('激励语更新失败:', e); }
  try { await updateUserInfo(); } catch (e) { console.error('用户信息更新失败:', e); }

  focusSeconds = focusPresetMinutes * 60;
  try {
    const todayDate = new Date().toDateString();
    if (Storage.get('focusDate', '') !== todayDate) { Storage.set('todayFocus', 0); Storage.set('focusDate', todayDate); }
  } catch (e) { console.error('专注数据初始化失败:', e); }

  try { renderTab(currentTab); } catch (e) {
    console.error('渲染失败:', e);
    const c = document.getElementById('contentArea');
    if (c) c.innerHTML = '<div class="card"><div style="text-align:center;padding:40px;color:var(--text-muted)">⚠️ 页面加载出错，请刷新重试<br><small>' + e.message + '</small></div></div>';
  }

  // 启动定期同步
  if (typeof startAutoSync === 'function') startAutoSync();
}

document.addEventListener('DOMContentLoaded', init);
