(function () {
  'use strict';

  function pad(n) { return String(n).padStart(2, '0'); }

  function fmtDateTime(isoStr) {
    var d = new Date(isoStr);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function toLocalInputValue(isoStr) {
    var d = new Date(isoStr);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function statusLabel(s) {
    return { upcoming: '可报名', full: '已满员', ended: '已结束' }[s] || s;
  }

  function teacherName(data, teacherId) {
    var t = data.teachers.find(function (x) { return x.id === teacherId; });
    return t ? t.name : '（讲师已删除）';
  }

  var sideLinks = document.querySelectorAll('.side-link[data-view]');
  var views = document.querySelectorAll('.admin-view');

  function switchView(name) {
    sideLinks.forEach(function (l) { l.classList.toggle('active', l.dataset.view === name); });
    views.forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + name); });
    if (name === 'dashboard') renderDashboard();
    if (name === 'sessions') renderSessions();
    if (name === 'enrollments') renderEnrollmentSelect();
  }

  sideLinks.forEach(function (l) {
    l.addEventListener('click', function () { switchView(l.dataset.view); });
  });

  document.getElementById('btnResetData').addEventListener('click', function () {
    if (!confirm('确定要重置成示例数据吗？这会清空你新增/修改的所有内容。')) return;
    EduLiveData.reset();
    switchView('dashboard');
  });

  // ---------- Dashboard ----------
  function renderDashboard() {
    var data = EduLiveData.load();
    var now = new Date();

    var upcomingSessions = data.sessions.filter(function (s) { return EduLiveData.sessionStatus(data, s) === 'upcoming'; });

    var monthRevenue = data.enrollments.reduce(function (sum, e) {
      var s = data.sessions.find(function (x) { return x.id === e.sessionId; });
      if (!s || !(s.price > 0)) return sum;
      var st = new Date(s.startTime);
      if (st.getFullYear() === now.getFullYear() && st.getMonth() === now.getMonth()) return sum + s.price;
      return sum;
    }, 0);

    var stats = [
      { label: '场次总数', value: data.sessions.length },
      { label: '待开课场次', value: upcomingSessions.length },
      { label: '累计报名人次', value: data.enrollments.length },
      { label: '本月报名收入', value: '¥' + monthRevenue },
    ];
    document.getElementById('statGrid').innerHTML = stats.map(function (s) {
      return '<div class="stat-card"><div class="num">' + s.value + '</div><div class="label">' + s.label + '</div></div>';
    }).join('');

    var upcomingSorted = upcomingSessions.slice().sort(function (a, b) { return new Date(a.startTime) - new Date(b.startTime); }).slice(0, 6);
    document.getElementById('upcomingSessionsBody').innerHTML = upcomingSorted.map(function (s) {
      var count = EduLiveData.enrolledCount(data, s.id);
      return '<tr><td>' + s.title + '</td><td>' + teacherName(data, s.teacherId) + '</td><td>' + fmtDateTime(s.startTime) + '</td><td>' + count + ' / ' + s.capacity + '</td></tr>';
    }).join('') || '<tr><td colspan="4" style="color:var(--muted)">暂无待开课场次</td></tr>';
  }

  // ---------- Sessions (课程表管理) ----------
  var sessionModalBackdrop = document.getElementById('sessionModalBackdrop');
  var sessionModalTitle = document.getElementById('sessionModalTitle');
  var sessionModalMsg = document.getElementById('sessionModalMsg');
  var sessionForm = document.getElementById('sessionForm');
  var sessionIdInput = document.getElementById('sessionIdInput');
  var sessionTitleInput = document.getElementById('sessionTitleInput');
  var sessionTeacherInput = document.getElementById('sessionTeacherInput');
  var sessionSubjectInput = document.getElementById('sessionSubjectInput');
  var sessionStartInput = document.getElementById('sessionStartInput');
  var sessionDurationInput = document.getElementById('sessionDurationInput');
  var sessionCapacityInput = document.getElementById('sessionCapacityInput');
  var sessionPriceInput = document.getElementById('sessionPriceInput');

  function renderSessions() {
    var data = EduLiveData.load();
    var list = data.sessions.slice().sort(function (a, b) { return new Date(a.startTime) - new Date(b.startTime); });
    document.getElementById('sessionsBody').innerHTML = list.map(function (s) {
      var status = EduLiveData.sessionStatus(data, s);
      var count = EduLiveData.enrolledCount(data, s.id);
      var priceText = s.price > 0 ? ('¥' + s.price) : '免费';
      return '<tr><td>' + s.title + '</td><td>' + teacherName(data, s.teacherId) + '</td><td>' + s.subject + '</td><td>' + fmtDateTime(s.startTime) + '</td><td>' + s.durationMinutes + ' 分钟</td>' +
        '<td>' + count + ' / ' + s.capacity + '</td><td>' + priceText + '</td>' +
        '<td><span class="badge ' + status + '">' + statusLabel(status) + '</span></td>' +
        '<td class="table-actions">' +
        '<button class="btn btn-sm" data-edit="' + s.id + '">编辑</button>' +
        '<button class="btn btn-sm btn-danger" data-delete="' + s.id + '">删除</button>' +
        '</td></tr>';
    }).join('') || '<tr><td colspan="9" style="color:var(--muted)">暂无场次</td></tr>';

    document.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () { openSessionModal(btn.dataset.edit); });
    });
    document.querySelectorAll('[data-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () { deleteSession(btn.dataset.delete); });
    });
  }

  function populateTeacherSelect(data, selectedId) {
    sessionTeacherInput.innerHTML = data.teachers.map(function (t) {
      return '<option value="' + t.id + '"' + (t.id === selectedId ? ' selected' : '') + '>' + t.name + '（' + t.subject + '）</option>';
    }).join('');
  }

  function openSessionModal(id) {
    var data = EduLiveData.load();
    sessionModalMsg.innerHTML = '';
    sessionForm.reset();
    populateTeacherSelect(data, null);
    if (id) {
      var s = data.sessions.find(function (x) { return x.id === id; });
      sessionModalTitle.textContent = '编辑场次';
      sessionIdInput.value = s.id;
      sessionTitleInput.value = s.title;
      populateTeacherSelect(data, s.teacherId);
      sessionSubjectInput.value = s.subject;
      sessionStartInput.value = toLocalInputValue(s.startTime);
      sessionDurationInput.value = s.durationMinutes;
      sessionCapacityInput.value = s.capacity;
      sessionPriceInput.value = s.price;
    } else {
      sessionModalTitle.textContent = '新增场次';
      sessionIdInput.value = '';
    }
    sessionModalBackdrop.classList.add('show');
  }

  document.getElementById('btnAddSession').addEventListener('click', function () { openSessionModal(null); });
  document.getElementById('btnCloseSessionModal').addEventListener('click', function () { sessionModalBackdrop.classList.remove('show'); });
  sessionModalBackdrop.addEventListener('click', function (e) { if (e.target === sessionModalBackdrop) sessionModalBackdrop.classList.remove('show'); });

  sessionForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var title = sessionTitleInput.value.trim();
    var teacherId = sessionTeacherInput.value;
    var subject = sessionSubjectInput.value.trim();
    var startValue = sessionStartInput.value;
    var duration = parseInt(sessionDurationInput.value, 10);
    var capacity = parseInt(sessionCapacityInput.value, 10);
    var price = parseFloat(sessionPriceInput.value);

    if (!title || !teacherId || !subject || !startValue) {
      sessionModalMsg.innerHTML = '<div class="msg error">请完整填写所有必填项。</div>';
      return;
    }
    if (!(duration > 0) || !(capacity > 0) || !(price >= 0)) {
      sessionModalMsg.innerHTML = '<div class="msg error">时长、容量需大于 0，价格不能为负数。</div>';
      return;
    }
    var startIso = new Date(startValue).toISOString();
    if (isNaN(new Date(startValue).getTime())) {
      sessionModalMsg.innerHTML = '<div class="msg error">开始时间格式不正确。</div>';
      return;
    }

    var data = EduLiveData.load();
    var id = sessionIdInput.value;
    if (id) {
      var s = data.sessions.find(function (x) { return x.id === id; });
      s.title = title; s.teacherId = teacherId; s.subject = subject; s.startTime = startIso;
      s.durationMinutes = duration; s.capacity = capacity; s.price = price;
    } else {
      data.sessions.push({
        id: EduLiveData.uid('s'), title: title, teacherId: teacherId, subject: subject, startTime: startIso,
        durationMinutes: duration, capacity: capacity, price: price,
      });
    }
    EduLiveData.save(data);
    sessionModalBackdrop.classList.remove('show');
    renderSessions();
  });

  function deleteSession(id) {
    if (!confirm('确定删除这个场次吗？该场次下所有报名记录也会一并删除。')) return;
    var data = EduLiveData.load();
    data.sessions = data.sessions.filter(function (s) { return s.id !== id; });
    data.enrollments = data.enrollments.filter(function (e) { return e.sessionId !== id; });
    EduLiveData.save(data);
    renderSessions();
  }

  // ---------- Enrollments (报名管理) ----------
  var enrollmentSessionSelect = document.getElementById('enrollmentSessionSelect');
  var currentSessionId = null;

  function renderEnrollmentSelect() {
    var data = EduLiveData.load();
    var list = data.sessions.slice().sort(function (a, b) { return new Date(b.startTime) - new Date(a.startTime); });
    if (!currentSessionId || !list.some(function (s) { return s.id === currentSessionId; })) {
      currentSessionId = list.length ? list[0].id : null;
    }
    enrollmentSessionSelect.innerHTML = list.map(function (s) {
      var count = EduLiveData.enrolledCount(data, s.id);
      return '<option value="' + s.id + '"' + (s.id === currentSessionId ? ' selected' : '') + '>' +
        s.title + ' · ' + fmtDateTime(s.startTime) + ' · ' + count + '/' + s.capacity + '</option>';
    }).join('') || '<option value="">暂无场次</option>';
    renderEnrollmentsTable();
  }

  enrollmentSessionSelect.addEventListener('change', function () {
    currentSessionId = enrollmentSessionSelect.value;
    renderEnrollmentsTable();
  });

  function renderEnrollmentsTable() {
    var data = EduLiveData.load();
    var list = data.enrollments.filter(function (e) { return e.sessionId === currentSessionId; })
      .slice().sort(function (a, b) { return new Date(a.enrolledAt) - new Date(b.enrolledAt); });

    document.getElementById('enrollmentsBody').innerHTML = list.map(function (e) {
      return '<tr><td>' + e.studentName + '</td><td>' + e.phone + '</td><td>' + fmtDateTime(e.enrolledAt) + '</td>' +
        '<td><span class="badge ' + (e.attended ? 'upcoming' : 'ended') + '">' + (e.attended ? '已签到' : '未签到') + '</span></td>' +
        '<td class="table-actions"><button class="btn btn-sm" data-toggle-attend="' + e.id + '">' + (e.attended ? '标记未签到' : '标记已签到') + '</button></td></tr>';
    }).join('') || '<tr><td colspan="5" style="color:var(--muted)">该场次暂无报名学生</td></tr>';

    document.querySelectorAll('[data-toggle-attend]').forEach(function (btn) {
      btn.addEventListener('click', function () { toggleAttended(btn.dataset.toggleAttend); });
    });
  }

  function toggleAttended(enrollmentId) {
    var data = EduLiveData.load();
    var e = data.enrollments.find(function (x) { return x.id === enrollmentId; });
    if (!e) return;
    e.attended = !e.attended;
    EduLiveData.save(data);
    renderEnrollmentsTable();
  }

  switchView('dashboard');
})();
