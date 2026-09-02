(function (global) {
  'use strict';
  var STORAGE_KEY = 'edulive_lite_data_v1';

  function iso(d) {
    return d.toISOString();
  }

  function hoursFromNow(h) {
    return iso(new Date(Date.now() + h * 3600000));
  }

  function seed() {
    var teachers = [
      { id: 't1', name: '张雨晴', subject: '英语口语', bio: '资深英语口语讲师，8 年在线教学经验，擅长用趣味互动教学法帮学员开口说英语。' },
      { id: 't2', name: '陈昊', subject: '数学思维', bio: '数学教育硕士，专注中小学数学思维训练，讲解逻辑清晰、节奏明快。' },
      { id: 't3', name: '林晓', subject: '少儿编程', bio: '前互联网大厂工程师，转型少儿编程教育，带孩子从零动手搭建第一个小游戏。' },
      { id: 't4', name: '王芳', subject: '美术素描', bio: '中央美院毕业，10 年少儿美术教学经验，注重激发孩子的观察力与创造力。' },
    ];

    var sessions = [
      { id: 's1', teacherId: 't1', title: '英语口语晨读营：地道表达日常对话', subject: '英语口语', startTime: hoursFromNow(72), durationMinutes: 60, capacity: 30, price: 99 },
      { id: 's2', teacherId: 't2', title: '数学思维公开课：图形规律与拆解', subject: '数学思维', startTime: hoursFromNow(2), durationMinutes: 45, capacity: 20, price: 0 },
      { id: 's3', teacherId: 't3', title: '少儿编程直播课：用 Scratch 做一个跳跃游戏', subject: '少儿编程', startTime: hoursFromNow(24), durationMinutes: 90, capacity: 5, price: 199 },
      { id: 's4', teacherId: 't1', title: '英语口语：旅行英语实战演练', subject: '英语口语', startTime: hoursFromNow(-24), durationMinutes: 60, capacity: 25, price: 149 },
      { id: 's5', teacherId: 't4', title: '美术素描公开课：静物结构入门', subject: '美术素描', startTime: hoursFromNow(-72), durationMinutes: 60, capacity: 15, price: 0 },
      { id: 's6', teacherId: 't2', title: '数学思维：应用题拆解训练营', subject: '数学思维', startTime: hoursFromNow(120), durationMinutes: 60, capacity: 40, price: 299 },
      { id: 's7', teacherId: 't3', title: '少儿编程：Python turtle 绘图入门', subject: '少儿编程', startTime: hoursFromNow(12), durationMinutes: 75, capacity: 10, price: 59 },
      { id: 's8', teacherId: 't4', title: '美术素描：动物速写技巧', subject: '美术素描', startTime: hoursFromNow(-2), durationMinutes: 60, capacity: 20, price: 129 },
    ];

    var enrollments = [
      // s3 is seeded to be exactly at capacity (5/5) -> status 'full'
      { id: 'e1', sessionId: 's3', studentName: '刘子萱', phone: '13800000001', enrolledAt: hoursFromNow(-40), attended: false },
      { id: 'e2', sessionId: 's3', studentName: '赵天宇', phone: '13800000002', enrolledAt: hoursFromNow(-39), attended: false },
      { id: 'e3', sessionId: 's3', studentName: '孙悦', phone: '13800000003', enrolledAt: hoursFromNow(-38), attended: false },
      { id: 'e4', sessionId: 's3', studentName: '周子墨', phone: '13800000004', enrolledAt: hoursFromNow(-30), attended: false },
      { id: 'e5', sessionId: 's3', studentName: '吴一诺', phone: '13800000005', enrolledAt: hoursFromNow(-20), attended: false },
      { id: 'e6', sessionId: 's1', studentName: '郑思远', phone: '13800000006', enrolledAt: hoursFromNow(-10), attended: false },
      { id: 'e7', sessionId: 's1', studentName: '钱佳怡', phone: '13800000007', enrolledAt: hoursFromNow(-8), attended: false },
      { id: 'e8', sessionId: 's2', studentName: '孔繁星', phone: '13800000008', enrolledAt: hoursFromNow(-5), attended: false },
      { id: 'e9', sessionId: 's4', studentName: '徐梓瑞', phone: '13800000009', enrolledAt: hoursFromNow(-50), attended: true },
      { id: 'e10', sessionId: 's5', studentName: '朱婉婷', phone: '13800000010', enrolledAt: hoursFromNow(-90), attended: true },
    ];

    return { teachers: teachers, sessions: sessions, enrollments: enrollments };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        var s = seed();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        return s;
      }
      return JSON.parse(raw);
    } catch (e) {
      return seed();
    }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function enrolledCount(data, sessionId) {
    return data.enrollments.filter(function (e) { return e.sessionId === sessionId; }).length;
  }

  function sessionEndTime(session) {
    return new Date(new Date(session.startTime).getTime() + session.durationMinutes * 60000);
  }

  function isEnded(session) {
    return sessionEndTime(session).getTime() <= Date.now();
  }

  // Computes 'upcoming' | 'full' | 'ended'. Always recomputed from live enrollment
  // counts rather than trusting a stored counter.
  function sessionStatus(data, session) {
    if (isEnded(session)) return 'ended';
    var count = enrolledCount(data, session.id);
    if (count >= session.capacity) return 'full';
    return 'upcoming';
  }

  global.EduLiveData = {
    load: load,
    save: save,
    uid: uid,
    enrolledCount: enrolledCount,
    sessionEndTime: sessionEndTime,
    isEnded: isEnded,
    sessionStatus: sessionStatus,
    reset: function () { var s = seed(); save(s); return s; },
  };
})(window);
