(function () {
  'use strict';

  var subjectFilters = document.getElementById('subjectFilters');
  var sessionGrid = document.getElementById('sessionGrid');
  var currentFilter = 'all';

  function pad(n) { return String(n).padStart(2, '0'); }

  function fmtDateTime(isoStr) {
    var d = new Date(isoStr);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function teacherName(data, teacherId) {
    var t = data.teachers.find(function (x) { return x.id === teacherId; });
    return t ? t.name : '（讲师已删除）';
  }

  function statusLabel(s) {
    return { upcoming: '可报名', full: '已满员', ended: '已结束' }[s] || s;
  }

  function renderFilters(data) {
    var subjects = [];
    data.sessions.forEach(function (s) {
      if (subjects.indexOf(s.subject) === -1) subjects.push(s.subject);
    });
    var all = ['all'].concat(subjects);
    subjectFilters.innerHTML = all.map(function (subj) {
      var label = subj === 'all' ? '全部' : subj;
      return '<button class="filter-btn' + (subj === currentFilter ? ' active' : '') + '" data-subject="' + subj + '">' + label + '</button>';
    }).join('');
    subjectFilters.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentFilter = btn.dataset.subject;
        renderGrid();
      });
    });
  }

  function cardHtml(data, session, flash) {
    var status = EduLiveData.sessionStatus(data, session);
    var count = EduLiveData.enrolledCount(data, session.id);
    var remaining = Math.max(0, session.capacity - count);
    var seatsClass = (status === 'upcoming' && remaining > 0 && remaining <= 3) ? 'seats-badge low' : 'seats-badge';
    var priceHtml = session.price > 0
      ? '<span class="session-card__price">¥' + session.price + ' <span>/人</span></span>'
      : '<span class="session-card__price free">免费</span>';

    var flashHtml = '';
    if (flash && flash.sessionId === session.id) {
      flashHtml = '<div class="msg ' + (flash.isError ? 'error' : 'success') + '">' + flash.text + '</div>';
    }

    var enrollInner = '';
    if (status === 'upcoming') {
      enrollInner = flashHtml +
        '<form class="enroll-form" data-session-id="' + session.id + '" novalidate>' +
        '<input type="text" class="nameInput" placeholder="学生姓名" required>' +
        '<input type="tel" class="phoneInput" placeholder="手机号" required>' +
        '<button type="submit" class="btn btn-primary btn-block btn-sm">确认报名</button>' +
        '</form>';
    } else if (status === 'full') {
      enrollInner = flashHtml + '<div class="enroll-note">本场次名额已满（' + count + '/' + session.capacity + '），报名通道已关闭。</div>';
    } else {
      enrollInner = flashHtml + '<div class="enroll-note">本场次已结束，报名通道已关闭。</div>';
    }

    return '<div class="session-card" data-id="' + session.id + '">' +
      '<div class="session-card__top">' +
      '<div><div class="session-card__subject">' + session.subject + '</div><h3>' + session.title + '</h3></div>' +
      '<span class="badge ' + status + '">' + statusLabel(status) + '</span>' +
      '</div>' +
      '<div class="session-card__meta">' +
      '<span>👩‍🏫 ' + teacherName(data, session.teacherId) + '</span>' +
      '<span>🕒 ' + fmtDateTime(session.startTime) + ' · ' + session.durationMinutes + ' 分钟</span>' +
      '<span>💺 剩余 ' + remaining + ' / ' + session.capacity + ' 名额 <span class="' + seatsClass + '">' + count + '/' + session.capacity + ' 已报名</span></span>' +
      '</div>' +
      '<div class="session-card__footer">' + priceHtml + '</div>' +
      '<div class="enroll-box">' + enrollInner + '</div>' +
      '</div>';
  }

  function renderGrid(flash) {
    var data = EduLiveData.load();
    renderFilters(data);

    var list = data.sessions.filter(function (s) {
      return currentFilter === 'all' || s.subject === currentFilter;
    }).slice().sort(function (a, b) {
      return new Date(a.startTime) - new Date(b.startTime);
    });

    sessionGrid.innerHTML = list.map(function (s) { return cardHtml(data, s, flash); }).join('') ||
      '<p style="color:var(--muted)">暂无该类目下的场次。</p>';

    sessionGrid.querySelectorAll('.enroll-form').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        handleEnrollSubmit(form);
      });
    });
  }

  function handleEnrollSubmit(form) {
    var sessionId = form.dataset.sessionId;
    var nameInput = form.querySelector('.nameInput');
    var phoneInput = form.querySelector('.phoneInput');
    var name = nameInput.value.trim();
    var phone = phoneInput.value.trim();

    if (!name || !phone) {
      showInlineMsg(form, '请填写学生姓名和手机号。', true);
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      showInlineMsg(form, '请填写有效的 11 位手机号。', true);
      return;
    }

    // Re-check live seat count at submit time (not the count from initial page
    // load) so two near-simultaneous submissions can't both slip past a full session.
    var freshData = EduLiveData.load();
    var session = freshData.sessions.find(function (s) { return s.id === sessionId; });
    if (!session) {
      renderGrid({ sessionId: sessionId, text: '该场次不存在或已被删除。', isError: true });
      return;
    }
    var status = EduLiveData.sessionStatus(freshData, session);
    if (status === 'ended') {
      renderGrid({ sessionId: sessionId, text: '该场次已经结束，无法报名。', isError: true });
      return;
    }
    var liveCount = EduLiveData.enrolledCount(freshData, sessionId);
    if (liveCount >= session.capacity) {
      renderGrid({ sessionId: sessionId, text: '很抱歉，该场次名额刚刚被报满，请选择其他场次。', isError: true });
      return;
    }

    freshData.enrollments.push({
      id: EduLiveData.uid('e'),
      sessionId: sessionId,
      studentName: name,
      phone: phone,
      enrolledAt: new Date().toISOString(),
      attended: false,
    });
    EduLiveData.save(freshData);

    renderGrid({ sessionId: sessionId, text: '报名成功！已为你锁定 1 个名额，请准时上课。', isError: false });
  }

  function showInlineMsg(form, text, isError) {
    var existing = form.parentElement.querySelector('.msg');
    if (existing) existing.remove();
    var div = document.createElement('div');
    div.className = 'msg ' + (isError ? 'error' : 'success');
    div.textContent = text;
    form.parentElement.insertBefore(div, form);
  }

  renderGrid();
})();
