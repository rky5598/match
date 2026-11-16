/* compatibility_module.js — движок совместимости v2.1 (калибровка 9/9 + контроль)
 * Формула залочена по эталонам: ME×DOOR 63/60/74, ME×KONSTR 60/37, ME×ANTI 0, ME×ME 0/34/74, EMPTY 1.
 * Golden-тесты вшиты и выполняются при каждой загрузке (selfTest()).
 */
(function (global) {
  'use strict';

  var ORDER = ["my", "ko", "an", "ur", "ob", "or", "zv", "zr"];
  var VECTORS = {"my": {"name": "Мышечный", "pair": "ko"}, "ko": {"name": "Кожный", "pair": "my"}, "an": {"name": "Анальный", "pair": "ur"}, "ur": {"name": "Уретральный", "pair": "an"}, "ob": {"name": "Обонятельный", "pair": "or"}, "or": {"name": "Оральный", "pair": "ob"}, "zv": {"name": "Звуковой", "pair": "zr"}, "zr": {"name": "Зрительный", "pair": "zv"}};

  function mkProfile(name, levels, dark, leader, empty) {
    var p = { name: name || '', levels: levels || {}, dark: dark || {}, leader: leader || null, empty: !!empty };
    p.light = {};
    if (!p.empty) {
      ORDER.forEach(function (v) {
        if (!p.dark[v] && (p.levels[v] || 0) >= 2) p.light[v] = 1;
      });
    }
    return p;
  }

  function features(a, b) {
    if (a.empty || b.empty) return null;
    var lightSet = [];
    ORDER.forEach(function (v) { if (a.light[v] && b.light[v]) lightSet.push(v); });
    var doors = [], doorsSum = 0;
    ORDER.forEach(function (x) {
      var dA = (a.dark[x] || 0) * (b.light[VECTORS[x].pair] ? 1 : 0);
      var dB = (b.dark[x] || 0) * (a.light[VECTORS[x].pair] ? 1 : 0);
      var side = dA >= dB ? { from: b.name, to: a.name, deg: dA } : dB > 0 ? { from: a.name, to: b.name, deg: dB } : null;
      if (side && side.deg > 0) { doors.push({ dark: x, via: VECTORS[x].pair, from: side.from, to: side.to }); doorsSum += 1; }
    });
    var d = 0;
    ORDER.forEach(function (x) {
      var da = a.dark[x] || 0, db = b.dark[x] || 0;
      if (da > 0 && db > 0) d += Math.min(da, db);
    });
    var ls = (a.leader && a.leader === b.leader) ? 1 : 0;
    var ps = 0;
    ORDER.forEach(function (x) { if ((a.levels[x]||0) >= 4 && (b.levels[x]||0) >= 4) ps += 1; });
    return { lightMatch: lightSet, lights: lightSet.length, doors: doors, doorsSum: doorsSum,
             darkSame: d, leaderSame: ls, peaksSame: ps };
  }

  function match(a, b, mode) {
    if (a.empty || b.empty) return { score: 1, mode: mode, empty: true, note: 'карта без данных' };
    var f = features(a, b), s;
    if (mode === 'partners') {
      s = 55 + 2*f.lights + f.doorsSum + 3*f.darkSame - 4*f.darkSame*f.darkSame - 3*f.leaderSame - 5*f.peaksSame - (f.darkSame >= 4 ? 4 : 0);
    } else if (mode === 'business') {
      s = 6 + 23*f.lights + 2*f.doorsSum - 2*f.darkSame - 10*f.leaderSame - 2*f.peaksSame;
    } else { // friends
      s = 37*f.lights;
    }
    s = Math.round(s);
    if (s < 0) s = 0; if (s > 100) s = 100;
    return { score: s, mode: mode, f: f };
  }

  function circle(members) {
    var out = { matrix: [], uncovered: [], duplicates: {}, conflicts: {} };
    members.forEach(function (m) {
      ORDER.forEach(function (x) {
        var deg = m.dark[x] || 0;
        if (!deg) return;
        var closers = [];
        members.forEach(function (o) {
          if (o !== m && o.light[VECTORS[x].pair]) closers.push(o.name);
        });
        if (closers.length) {
          for (var i = 0; i < closers.length; i++) {
            out.matrix.push({ who: m.name, dark: x, closedBy: closers[i] });
          }
          if (closers.length > 1) out.duplicates[x] = closers.slice();
        } else {
          out.uncovered.push({ who: m.name, dark: x, missingLight: VECTORS[x].pair });
        }
      });
    });
    var clusters = {};
    members.forEach(function (m) { if (m.leader) (clusters[m.leader] = clusters[m.leader] || []).push(m.name); });
    Object.keys(clusters).forEach(function (l) { if (clusters[l].length > 1) out.conflicts[l] = clusters[l]; });
    var tot = out.matrix.length + out.uncovered.length;
    out.coverage = tot ? Math.round(100 * out.matrix.length / tot) : 100;
    return out;
  }

  /* Кодек профиля для ссылки: v1:levels(8):dark(8):leader */
  function encodeProfile(p) {
    if (p.empty) return 'v1:e';
    var lv = '', dk = '', li = 0;
    ORDER.forEach(function (v) { lv += (p.levels[v] || 0); });
    ORDER.forEach(function (v) { dk += (p.dark[v] || 0); });
    ORDER.forEach(function (v, i) { if (p.leader === v) li = i; });
    return 'v1:' + lv + ':' + dk + ':' + li;
  }
  function decodeProfile(s) {
    var parts = String(s).split(':');
    if (parts[0] !== 'v1') return null;
    if (parts[1] === 'e') return mkProfile('', {}, {}, null, true);
    if (!parts[1] || parts[1].length !== 8 || !parts[2] || parts[2].length !== 8) return null;
    var levels = {}, dark = {}, i;
    for (i = 0; i < 8; i++) levels[ORDER[i]] = Math.min(4, parseInt(parts[1][i], 10) || 0);
    for (i = 0; i < 8; i++) dark[ORDER[i]] = Math.min(2, parseInt(parts[2][i], 10) || 0);
    return mkProfile('', levels, dark, ORDER[parseInt(parts[3], 10) || 0]);
  }

  /* Golden-тесты, вшитые в движок */
  var GOLDEN = [{"name": "ME x DOOR", "a": {"n": "ME", "lv": {"my": 1, "ko": 3, "an": 3, "ur": 1, "ob": 3, "or": 1, "zv": 2, "zr": 2}, "dk": {"my": 1, "ko": 1, "an": 1, "ob": 1}, "ld": "an"}, "b": {"n": "DOOR", "lv": {"my": 2, "ko": 2, "an": 2, "ur": 2, "ob": 2, "or": 2, "zv": 2, "zr": 2}, "dk": {}, "ld": "ur"}, "exp": {"partners": 63, "business": 60, "friends": 74}}, {"name": "ME x KONSTR", "a": {"n": "ME", "lv": {"my": 1, "ko": 3, "an": 3, "ur": 1, "ob": 3, "or": 1, "zv": 2, "zr": 2}, "dk": {"my": 1, "ko": 1, "an": 1, "ob": 1}, "ld": "an"}, "b": {"n": "KON", "lv": {"my": 2, "ko": 2, "an": 1, "ur": 2, "ob": 1, "or": 1, "zv": 1, "zr": 2}, "dk": {}, "ld": "ko"}, "exp": {"partners": 60, "friends": 37}}, {"name": "ME x ANTI", "a": {"n": "ME", "lv": {"my": 1, "ko": 3, "an": 3, "ur": 1, "ob": 3, "or": 1, "zv": 2, "zr": 2}, "dk": {"my": 1, "ko": 1, "an": 1, "ob": 1}, "ld": "an"}, "b": {"n": "ANTI", "lv": {"my": 1, "ko": 1, "an": 1, "ur": 1, "ob": 1, "or": 1, "zv": 1, "zr": 1}, "dk": {"my": 2, "ko": 2, "an": 2, "ur": 2, "ob": 2, "or": 2, "zv": 2, "zr": 2}, "ld": "an"}, "exp": {"partners": 0, "business": 0, "friends": 0}}, {"name": "ME x ME", "a": {"n": "ME", "lv": {"my": 1, "ko": 3, "an": 3, "ur": 1, "ob": 3, "or": 1, "zv": 2, "zr": 2}, "dk": {"my": 1, "ko": 1, "an": 1, "ob": 1}, "ld": "an"}, "b": {"n": "ME2", "lv": {"my": 1, "ko": 3, "an": 3, "ur": 1, "ob": 3, "or": 1, "zv": 2, "zr": 2}, "dk": {"my": 1, "ko": 1, "an": 1, "ob": 1}, "ld": "an"}, "exp": {"partners": 0, "business": 34, "friends": 74}}, {"name": "EMPTY x ME", "a": {"n": "EMPTY", "empty": true}, "b": {"n": "ME", "lv": {"my": 1, "ko": 3, "an": 3, "ur": 1, "ob": 3, "or": 1, "zv": 2, "zr": 2}, "dk": {"my": 1, "ko": 1, "an": 1, "ob": 1}, "ld": "an"}, "exp": {"partners": 1, "business": 1, "friends": 1}}];

  function selfTest() {
    var res = { ok: 0, failed: [], total: 0 };
    GOLDEN.forEach(function (t) {
      var a = mkProfile(t.a.n, t.a.lv, t.a.dk, t.a.ld, t.a.empty);
      var b = mkProfile(t.b.n, t.b.lv, t.b.dk, t.b.ld, t.b.empty);
      ['partners', 'business', 'friends'].forEach(function (m) {
        if (t.exp[m] === undefined) return;
        res.total++;
        var got = match(a, b, m).score;
        if (got === t.exp[m]) res.ok++;
        else res.failed.push(t.name + ' x ' + m + ': ждали ' + t.exp[m] + ', получили ' + got);
      });
    });
    res.passed = res.failed.length === 0;
    return res;
  }

  var SVP = { ORDER: ORDER, VECTORS: VECTORS, mkProfile: mkProfile, features: features,
              match: match, circle: circle, encodeProfile: encodeProfile,
              decodeProfile: decodeProfile, selfTest: selfTest, version: '2.1' };

  if (typeof module !== 'undefined' && module.exports) module.exports = SVP;
  global.SVP = SVP;
})(typeof window !== 'undefined' ? window : this);
