/* SVP Match Engine v2.2 — зеркало compatibility_module (эталон: Python) */
(function (global) {
  'use strict';

  var VECTORS = [
    ['K','кожный','Ида'], ['A','анальный','Сушумна'], ['U','уретральный','Пингала'],
    ['M','мышечный','Ида'], ['Z','зрительный','Пингала'], ['S','звуковой','Сушумна'],
    ['O','оральный','Пингала'], ['Bn','обонятельный','Сушумна']
  ];
  var KEYS = VECTORS.map(function (v) { return v[0]; });
  var VNAME = {}; VECTORS.forEach(function (v) { VNAME[v[0]] = v[1]; });
  var AXES = { 'Сушумна': ['A','S','Bn'], 'Ида': ['K','M'], 'Пингала': ['U','Z','O'] };
  var DARK_NAMES = {
    K: 'контроль, скупость, манипуляции слабыми',
    A: 'упрямство, счёт обид и долгов',
    U: 'самодурство, властная истерия',
    M: 'апатия, лень, телесная спячка',
    Z: 'страхи, ревность, истерики',
    S: 'уныние, изоляция, внутренняя пустота',
    O: 'брань, пошлость, распущенность речи',
    Bn: 'тревожность, подозрительность, страх'
  };
  var LIGHT_NAMES = {
    K: 'дисциплина, логика, адаптация',
    A: 'верность, порядок, память рода',
    U: 'ответственность за всех, поток жизни',
    M: 'трудолюбие, выносливость, опора',
    Z: 'любовь, сострадание, эмоциональная глубина',
    S: 'сосредоточенность, глубина смысла',
    O: 'веселье, слово, снятие напряжения',
    Bn: 'чутьё, распознавание людей и ситуаций'
  };
  var TYPE_NAMES = {
    partner: 'Партнёр', friend: 'Друг', business: 'Бизнес',
    parent_child: 'Родитель → ребёнок', child_parent: 'Ребёнок → родитель'
  };

  /* Конфиги типов отношений (калибровка v2.1 — НЕ менять без перекалибровки корпуса) */
  var CFG = {
    partner:      { light: 27.0, doors: 49.0, axes: 5.0,  dl: -20.0, dark: null, neuro: null,  veto: true },
    friend:       { light: 60.0, doors: 10.0, axes: 30.0, dl: 10.0,  dark: -5.0, neuro: 0.0,   veto: false },
    business:     { light: 60.0, doors: 34.0, axes: 20.0, dl: -25.0, dark: 0.0,  neuro: 0.0,   veto: false },
    parent_child: { light: 50.0, doors: 30.0, axes: 20.0, dl: 0.0,   dark: -20.0, neuro: -30.0, veto: false },
    child_parent: { light: 30.0, doors: 30.0, axes: 20.0, dl: 0.0,   dark: -10.0, neuro: -20.0, veto: false }
  };
  var PEAK_FRICTION = 10.5;

  function shortDark(k) { return DARK_NAMES[k].split(',')[0]; }

  function lightMatch(A, B) {
    var inter = A.light.filter(function (k) { return B.light.indexOf(k) >= 0; });
    return Math.min(inter.length, 3) / 3.0;
  }

  function doorsMatch(A, B) {
    var covered = 0, total = 0, detail = [];
    KEYS.forEach(function (k) {
      var dA = A.dark[k] || 0, dB = B.dark[k] || 0;
      if (dA) total++;
      if (dB) total++;
      if (dA && B.levels[k] >= 3) { covered++; detail.push(['get', k]); }
      if (dB && A.levels[k] >= 3) { covered++; detail.push(['give', k]); }
    });
    return { value: total ? covered / total : 0.0, covered: covered, total: total, detail: detail };
  }

  function axesMatch(A, B) {
    var vals = [], names = [];
    Object.keys(AXES).forEach(function (ax) {
      var members = AXES[ax];
      var aOn = members.some(function (k) { return A.levels[k] >= 2; });
      var bOn = members.some(function (k) { return B.levels[k] >= 2; });
      vals.push(aOn && bOn ? 1.0 : (aOn || bOn ? 0.2 : 0.0));
      if (aOn && bOn) names.push(ax);
    });
    return { value: vals.reduce(function (s, v) { return s + v; }, 0) / 3.0, shared: names };
  }

  function darkFlags(A, B) {
    var same = [], neuro = [];
    KEYS.forEach(function (k) {
      var dA = A.dark[k] || 0, dB = B.dark[k] || 0;
      if (dA > 0 && dB > 0) { same.push(k); if (dA === 2 && dB === 2) neuro.push(k); }
    });
    return { same: same, neuro: neuro };
  }

  function friction(A, B) {
    return KEYS.filter(function (k) { return A.levels[k] === 4 && B.levels[k] === 4; });
  }

  function compute(A, B, rtype) {
    var cfg = CFG[rtype];
    var lm = lightMatch(A, B);
    var dm = doorsMatch(A, B);
    var am = axesMatch(A, B);
    var df = darkFlags(A, B);
    var fr = friction(A, B);
    var flags = [], veto = false;

    if (df.same.length && cfg.veto) {
      veto = true;
      flags.push(['red', 'Совпадение тьмы: у обоих повторяющаяся тьма в векторе(ах) «' +
        df.same.map(shortDark).join('», «') + '» — по закону 13 это не дополнение, а совместное падение. Вето.']);
    }
    var raw = cfg.light * lm + cfg.doors * dm.value + cfg.axes * am.value;
    if (A.leading && A.leading === B.leading) {
      raw += cfg.dl;
      var kind = cfg.dl < 0 ? 'красный флаг' : (cfg.dl > 0 ? 'бонус' : 'особенность');
      flags.push([cfg.dl < -10 ? 'red' : (cfg.dl > 0 ? 'green' : 'grey'),
        'Удвоение ведущего вектора (' + TYPE_NAMES[rtype] + '): ' + kind +
        ' ' + Math.abs(Math.round(cfg.dl)) + ' баллов.']);
    }
    if (df.same.length && !veto && cfg.dark) {
      raw += cfg.dark;
      flags.push([rtype === 'friend' ? 'yellow' : 'red',
        'Совпадение тьмы в: ' + df.same.map(shortDark).join(', ') + ' (' + cfg.dark + ' баллов).']);
    }
    if (df.neuro.length && cfg.neuro) {
      raw += cfg.neuro;
      flags.push(['red', 'Невроз × невроз в: ' + df.neuro.map(shortDark).join(', ') +
        ' (' + cfg.neuro + ' баллов).']);
    }
    if (fr.length) {
      raw -= PEAK_FRICTION * fr.length;
      flags.push(['grey', 'Трение встречных пиков: у обоих вершина в «' +
        fr.map(function (k) { return VNAME[k]; }).join('», «') +
        '» — реализация двух вершин одного рода стоит энергии (−' + Math.round(PEAK_FRICTION * fr.length) + ').']);
    }
    var score = veto ? 0 : Math.max(0, Math.min(100, Math.round(raw)));
    return {
      score: score, veto: veto,
      layers: { light: lm, doors: dm, axes: am },
      flags: flags, friction: fr,
      sameDark: df.same, neuroDark: df.neuro
    };
  }

  /* ---- Кодек профиля в URL (base64url от JSON) ---- */
  function b64urlEncode(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function encodeProfile(p) {
    var o = { v: {}, d: {}, l: p.light.slice().sort(), e: p.leading || '' };
    KEYS.forEach(function (k) {
      o.v[k] = p.levels[k] || 0;
      if (p.dark[k]) o.d[k] = p.dark[k];
    });
    return b64urlEncode(JSON.stringify(o));
  }
  function decodeProfile(s) {
    var o = JSON.parse(b64urlDecode(s));
    var p = { levels: {}, dark: {}, light: o.l || [], leading: o.e || null };
    KEYS.forEach(function (k) {
      p.levels[k] = o.v[k] || 0;
      p.dark[k] = o.d[k] || 0;
    });
    return p;
  }

  function profileFromForm(levels, dark, light, leading) {
    return { levels: levels, dark: dark, light: light, leading: leading };
  }

  /* ---- Golden-корпус (встроен, выполняется при каждой загрузке) ---- */
  var GOLDEN = [
    ['USER×DOOR2 partner',  'user', 'door2', 'partner', 63],
    ['USER×DOOR2 friend',   'user', 'door2', 'friend', 60],
    ['USER×DOOR2 business', 'user', 'door2', 'business', 74],
    ['USER×CONSTRUCT partner', 'user', 'construct', 'partner', 60],
    ['USER×ANTI partner',   'user', 'anti', 'partner', 0],
    ['USER×USER partner',   'user', 'user', 'partner', 0],
    ['USER×USER friend',    'user', 'user', 'friend', 74],
    ['USER×USER business',  'user', 'user', 'business', 34],
    ['USER×EMPTY partner',  'user', 'empty', 'partner', 1]
  ];

  var CORPUS = {
    user:      { levels: {K:2,A:4,U:4,M:2,Z:1,S:1,O:1,Bn:3}, dark: {Z:2}, light: ['A','U','Bn'], leading: 'U' },
    door2:     { levels: {K:2,A:2,U:1,M:3,Z:3,S:1,O:3,Bn:1}, dark: {Bn:1}, light: ['Z','O','A'], leading: 'Z' },
    construct: { levels: {K:4,A:4,U:4,M:4,Z:4,S:4,O:4,Bn:4}, dark: {}, light: ['A','U','Bn'], leading: 'A' },
    anti:      { levels: {K:4,A:3,U:0,M:1,Z:1,S:2,O:0,Bn:0}, dark: {Z:2,K:2}, light: [], leading: 'K' },
    empty:     { levels: {K:0,A:0,U:0,M:0,Z:0,S:0,O:0,Bn:0}, dark: {}, light: [], leading: null }
  };

  function runGoldenTests() {
    var results = [];
    GOLDEN.forEach(function (c) {
      var got = compute(CORPUS[c[1]], CORPUS[c[2]], c[3]).score;
      results.push({ name: c[0], got: got, expected: c[4], ok: got === c[4] });
    });
    var passed = results.filter(function (r) { return r.ok; }).length;
    return { passed: passed, total: results.length, results: results, ok: passed === results.length };
  }

  global.SVP = {
    VECTORS: VECTORS, KEYS: KEYS, VNAME: VNAME, AXES: AXES,
    DARK_NAMES: DARK_NAMES, LIGHT_NAMES: LIGHT_NAMES, TYPE_NAMES: TYPE_NAMES,
    CFG: CFG, PEAK_FRICTION: PEAK_FRICTION,
    compute: compute, encodeProfile: encodeProfile, decodeProfile: decodeProfile,
    profileFromForm: profileFromForm, runGoldenTests: runGoldenTests, CORPUS: CORPUS
  };
})(window);
