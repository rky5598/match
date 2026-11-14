/* ============================================================
   SVP Compatibility Engine v2.3
   Три слоя счёта, флаги, трение пиков, кодек профиля в URL,
   встроенный golden-корпус (9 случаев, калибровка v2.3).
   Классический скрипт, без внешних зависимостей.
   ============================================================ */
(function (global) {
  'use strict';

  var VECTORS = [
    { id: 'ur', name: 'Уретральный',  short: 'поток, бесстрашие, скорость' },
    { id: 'ko', name: 'Кожный',       short: 'логика, дисциплина, границы' },
    { id: 'an', name: 'Анальный',     short: 'порядок, память, верность' },
    { id: 'mu', name: 'Мышечный',     short: 'тело, движение, дом' },
    { id: 'zr', name: 'Зрительный',   short: 'эмоции, свет, сострадание' },
    { id: 'or', name: 'Оральный',     short: 'слово, юмор, ласка' },
    { id: 'ob', name: 'Обонятельный', short: 'нюх, опора, оценка людей' },
    { id: 'zv', name: 'Звуковой',     short: 'смысл, тишина, глубина' }
  ];

  var SUPPORT = {
    ur: ['an', 'ko'], ko: ['ur', 'an'], an: ['ur', 'ko'],
    mu: ['zr', 'zv'], zr: ['zv', 'or'], or: ['zv', 'zr'],
    ob: ['zv'], zv: ['zr']
  };

  var TYPES = { partner: 'Партнёр', friend: 'Друг', business: 'Бизнес' };

  var WEIGHTS = {
    partner:  { c1: 0.5,  c2: 0.4,  c3: 1.7, c4: 0.5, c5: 1.0, friction: 15, cap: 65 },
    friend:   { c1: 0.6,  c2: 0.84, c3: 1.5, c4: 2.2, c5: 0.5, friction: 0,  cap: 75 },
    business: { c1: 1.1,  c2: 0.94, c3: 1.2, c4: 1.0, c5: 1.0, friction: 0,  cap: 80, competition: 10 }
  };

  function vecName(id) {
    for (var i = 0; i < VECTORS.length; i++) if (VECTORS[i].id === id) return VECTORS[i].name;
    return id;
  }
  function vecShort(id) {
    for (var i = 0; i < VECTORS.length; i++) if (VECTORS[i].id === id) return VECTORS[i].short;
    return '';
  }

  function calcComponents(A, B) {
    var c1 = 0, c2 = 0, c3 = 0, c4 = 0, c5 = 0, i, x, av, bv;
    for (i = 0; i < VECTORS.length; i++) {
      x = VECTORS[i].id; av = A.v[x] || 0; bv = B.v[x] || 0;
      if (av <= 1 && bv >= 3) { c1 += 10; }
      else if (av <= 1 && bv === 2) { c1 += 5; }
      else if (av === 2 && bv >= 3) { c1 += 6; }
      if (bv <= 1 && av >= 3) { c2 += 5; }
      else if (bv === 2 && av >= 3) { c2 += 3; }
    }
    c1 = Math.min(c1, 40); c2 = Math.min(c2, 20);
    if (A.ld) {
      var sA = SUPPORT[A.ld] || [];
      for (i = 0; i < sA.length; i++) if ((B.v[sA[i]] || 0) >= 2) { c3 += 12; break; }
    }
    if (B.ld) {
      var sB = SUPPORT[B.ld] || [];
      for (i = 0; i < sB.length; i++) if ((A.v[sB[i]] || 0) >= 2) { c3 += 8; break; }
    }
    c3 = Math.min(c3, 20);
    var i2;
    for (i2 = 0; i2 < (A.l || []).length; i2++) {
      if ((B.l || []).indexOf(A.l[i2]) !== -1) c4 += 10;
    }
    c4 = Math.min(c4, 30);
    for (i2 = 0; i2 < VECTORS.length; i2++) {
      x = VECTORS[i2].id;
      if ((B.l || []).indexOf(x) !== -1 && A.d && A.d[x] >= 1) c5 += 6;
      if ((A.l || []).indexOf(x) !== -1 && B.d && B.d[x] >= 1) c5 += 6;
    }
    c5 = Math.min(c5, 20);
    return { c1: c1, c2: c2, c3: c3, c4: c4, c5: c5 };
  }

  function isEmptyProfile(P) {
    var i;
    for (i = 0; i < VECTORS.length; i++) if ((P.v[VECTORS[i].id] || 0) !== 0) return false;
    return !(P.l && P.l.length) && !(P.d && Object.keys(P.d).length);
  }

  function coverList(target, giver) {
    var out = [], i, x, tv, gv;
    for (i = 0; i < VECTORS.length; i++) {
      x = VECTORS[i].id; tv = target.v[x] || 0; gv = giver.v[x] || 0;
      if (tv <= 1 && gv >= 3) {
        out.push(vecName(x) + ' (' + gv + ' против ' + tv + '): ' + vecShort(x) + ' — закрывает дефицит');
      } else if (tv === 2 && gv >= 3) {
        out.push(vecName(x) + ' (' + gv + ' против ' + tv + '): усиливает среднюю зону');
      }
    }
    for (i = 0; i < VECTORS.length; i++) {
      x = VECTORS[i].id;
      if ((giver.l || []).indexOf(x) !== -1 && target.d && target.d[x] >= 1) {
        out.push(vecName(x) + ': живущий свет лечит повторяющуюся тьму');
      }
    }
    for (i = 0; i < VECTORS.length; i++) {
      x = VECTORS[i].id;
      if ((giver.l || []).indexOf(x) !== -1 && (target.l || []).indexOf(x) !== -1) {
        out.push(vecName(x) + ': общий свет — оба живут этим');
      }
    }
    return out.length ? out : ['Прямых дверей не найдено — счёт держится на других слоях'];
  }

  function calculate(A, B, type) {
    type = TYPES[type] ? type : 'partner';
    var w = WEIGHTS[type];
    var flags = [];

    if (isEmptyProfile(B)) {
      return { total: 1, ceiling: w.cap, layers: [], flags: ['пустой профиль — не партнёр'],
        verdict: 'Пустой профиль не может быть партнёром: нет обмена — нет пары', reports: null };
    }

    var overlap = [], i, x;
    for (i = 0; i < VECTORS.length; i++) {
      x = VECTORS[i].id;
      if (A.d && A.d[x] >= 1 && B.d && B.d[x] >= 1) overlap.push(x);
    }
    if (type === 'partner' && overlap.length) {
      var f = ['совпадение тьмы: ' + overlap.map(vecName).join(', ')];
      for (i = 0; i < overlap.length; i++) if (overlap[i] === A.ld) f.push('тьма в ведущем доме');
      return { total: 0, ceiling: w.cap, layers: [], flags: f,
        verdict: 'Не пара: совпала тьма. Закон 13 — не совпадать по тьме', reports: null };
    }

    var c = calcComponents(A, B);
    var total = w.c1 * c.c1 + w.c2 * c.c2 + w.c3 * c.c3 + w.c4 * c.c4 + w.c5 * c.c5;
    var layers = [
      { name: 'Функциональное дополнение',   got: w.c1 * c.c1, max: w.c1 * 40 },
      { name: 'Осевое покрытие',             got: w.c2 * c.c2, max: w.c2 * 20 },
      { name: 'Поддержка ведущего вектора',  got: w.c3 * c.c3, max: w.c3 * 20 },
      { name: 'Совпадение света',            got: w.c4 * c.c4, max: w.c4 * 30 },
      { name: 'Свет против тьмы',            got: w.c5 * c.c5, max: w.c5 * 20 }
    ];

    if (w.friction) {
      var l4 = {}, j;
      for (j = 0; j < VECTORS.length; j++) {
        x = VECTORS[j].id;
        if ((A.v[x] || 0) === 4 && x !== A.ld) l4[x] = 1;
        if ((B.v[x] || 0) === 4 && x !== B.ld) l4[x] = 1;
      }
      var l4keys = Object.keys(l4);
      if (l4keys.length) {
        total -= w.friction * l4keys.length;
        flags.push('трение пиков: ' + l4keys.map(vecName).join(', '));
      }
    }
    if (type === 'business' && A.ld && A.ld === B.ld) {
      total -= w.competition; flags.push('конкуренция за руль');
    }
    if (type === 'friend' && overlap.length) {
      flags.push('совпадение тьмы (в дружбе — мягкое примечание)');
    }

    total = Math.max(0, Math.min(Math.round(total), w.cap));

    var verdict;
    if (total <= 20) verdict = 'Красная зона: то, на чём ломаются';
    else if (total <= 45) verdict = 'Сложно, но осмысленно: работать руками';
    else if (total <= 55) verdict = 'Живая пара с зонами роста';
    else verdict = 'Сильная живая пара — вы у самого потолка шкалы';

    return {
      total: total, ceiling: w.cap, layers: layers, flags: flags, verdict: verdict,
      reports: { fromOther: coverList(A, B), toOther: coverList(B, A) }
    };
  }

  var P_USER = { v: { ur: 4, ko: 2, an: 3, mu: 2, zr: 1, or: 1, ob: 3, zv: 2 }, d: { an: 1, zr: 1 }, l: ['ur', 'ob'], ld: 'ur' };
  var P_DOOR2 = { v: { ur: 1, ko: 2, an: 3, mu: 3, zr: 3, or: 3, ob: 1, zv: 1 }, d: { ob: 1 }, l: ['zr', 'or'], ld: 'zr' };
  var P_CONSTRUCT = { v: { ur: 4, ko: 3, an: 3, mu: 3, zr: 4, or: 3, ob: 3, zv: 3 }, d: {}, l: ['ur','ko','an','mu','zr','or','ob','zv'], ld: 'ur' };
  var P_ANTI = { v: { ur: 1, ko: 4, an: 4, mu: 0, zr: 2, or: 0, ob: 1, zv: 1 }, d: { ur: 2, zv: 2, zr: 1 }, l: ['ko'], ld: 'ko' };
  var P_EMPTY = { v: { ur: 0, ko: 0, an: 0, mu: 0, zr: 0, or: 0, ob: 0, zv: 0 }, d: {}, l: [], ld: null };

  var GOLDEN = [
    { name: 'user × профиль-дверь 2.0 (партнёр)',  a: P_USER, b: P_DOOR2,     type: 'partner',  want: 63 },
    { name: 'user × профиль-дверь 2.0 (друг)',     a: P_USER, b: P_DOOR2,     type: 'friend',   want: 60 },
    { name: 'user × профиль-дверь 2.0 (бизнес)',   a: P_USER, b: P_DOOR2,     type: 'business', want: 74 },
    { name: 'user × конструкт-идеал (партнёр)',    a: P_USER, b: P_CONSTRUCT, type: 'partner',  want: 60 },
    { name: 'user × антипортрет (партнёр)',        a: P_USER, b: P_ANTI,      type: 'partner',  want: 0 },
    { name: 'user × user (партнёр)',               a: P_USER, b: P_USER,      type: 'partner',  want: 0 },
    { name: 'user × user (друг)',                  a: P_USER, b: P_USER,      type: 'friend',   want: 74 },
    { name: 'user × user (бизнес)',                a: P_USER, b: P_USER,      type: 'business', want: 34 },
    { name: 'user × пустой профиль (партнёр)',     a: P_USER, b: P_EMPTY,     type: 'partner',  want: 1 }
  ];

  function runGolden() {
    var out = [], i, r;
    for (i = 0; i < GOLDEN.length; i++) {
      r = calculate(GOLDEN[i].a, GOLDEN[i].b, GOLDEN[i].type);
      out.push({ name: GOLDEN[i].name, got: r.total, want: GOLDEN[i].want, ok: (r.total === GOLDEN[i].want) });
    }
    return out;
  }

  function encodeProfile(p) {
    var s = JSON.stringify(p);
    var b = global.btoa(unescape(encodeURIComponent(s)));
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeProfile(code) {
    var b = code.replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    return JSON.parse(decodeURIComponent(escape(global.atob(b))));
  }

  global.SVP = {
    VERSION: '2.3',
    VECTORS: VECTORS,
    TYPES: TYPES,
    calculate: calculate,
    runGolden: runGolden,
    encodeProfile: encodeProfile,
    decodeProfile: decodeProfile,
    vecName: vecName,
    vecShort: vecShort,
    coverList: coverList
  };
})(window);
