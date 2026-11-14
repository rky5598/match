/* ============================================================
   SVP Compatibility Engine v2.1 — откалиброванный движок
   Законы: 13 (двери), 24 (свет/тьма на одном атоме), 16 (цена пика),
   5 (суррогат), закон застывшего состояния (невроз×невроз).
   Детерминизм: одинаковые входы -> одинаковый выход. LLM не участвует.
   ============================================================ */

const VECTORS = ['мышечный','кожный','анальный','уретральный','звуковой','зрительный','оральный','обонятельный'];
const DOORS = [[0,1],[2,3],[4,5],[6,7]]; // мыш-кож, ан-ур, зв-зр, ор-обн
const NADIS = [
  ['Ида — время/ритм',[2,3]],
  ['Пингала — энергия/общение',[6,7]],
  ['Сушумна — информация/смыслы',[4,5]],
  ['Тело-среда',[0,1]]
];
const FRICTION_PER_PEAK = 10; // закон 16: вершина стоит энергии
const L3_PER_OVERLAP = 15;    // закон 24: общие света

const REL = {
  partner:  {l1:40,l2:40,l3:30, dark:-20, neuro:-45, double:-20, name:'Романтический партнёр'},
  friend:   {l1:30,l2:30,l3:40, dark:-5,  neuro:-10, double:+10, name:'Друг'},
  business: {l1:40,l2:40,l3:30, dark:-10, neuro:-20, double:-25, name:'Деловой партнёр'},
  parent:   {l1:30,l2:40,l3:30, dark:-20, neuro:-35, double:0,   name:'Родитель → ребёнок'},
  child:    {l1:30,l2:40,l3:30, dark:-5,  neuro:-10, double:0,   name:'Ребёнок → родитель'}
};

function layer1(A,B,cfg){
  const detail=[]; let pts=0;
  for(const [a,b] of DOORS){
    const ma=A.v[a],mb=A.v[b],na=B.v[a],nb=B.v[b];
    const comp = (ma>=2&&nb>=2)||(na>=2&&mb>=2);
    const single = (ma>=3&&mb>=3)||(na>=3&&nb>=3);
    let d=0, why='дверь не открыта';
    if(comp){d=8; why='истинное дополнение: каждая половина двери — от своего человека';}
    else if(single){d=3; why='функция есть, но закрыта одним человеком (нет обмена)';}
    const s=d*cfg.l1/40; pts+=s;
    detail.push([VECTORS[a]+' ↔ '+VECTORS[b], d, Math.round(s*10)/10, why]);
  }
  return [pts,detail];
}
function layer2(A,B,cfg){
  const detail=[]; let pts=0;
  for(const [name,idx] of NADIS){
    const ca=A.v.some((x,i)=>idx.includes(i)&&x>=2);
    const cb=B.v.some((x,i)=>idx.includes(i)&&x>=2);
    const d=(ca&&cb)?10:((ca||cb)?2:0);
    const why=(ca&&cb)?'ось поделена':((ca||cb)?'ось тянет один':'ось пуста');
    const s=d*cfg.l2/40; pts+=s;
    detail.push([name,ca,cb,Math.round(s*10)/10,why]);
  }
  return [pts,detail];
}
function layer3(A,B,cfg){
  const ov=(A.light||[]).filter(i=>(B.light||[]).includes(i));
  return [Math.min(ov.length*L3_PER_OVERLAP,cfg.l3), ov.map(i=>VECTORS[i])];
}
function friction(A,B){
  const n=A.v.filter(x=>x>=4).length + B.v.filter(x=>x>=4).length;
  return FRICTION_PER_PEAK*n;
}
function flags(A,B,relType){
  const cfg=REL[relType]; const out=[]; let pen=0;
  const da=new Set(Object.keys(A.dark||{})), db=new Set(Object.keys(B.dark||{}));
  [...da].sort().forEach(v=>{
    if(!db.has(v)) return;
    if((A.dark||{})[v]===2 && (B.dark||{})[v]===2){
      out.push('Невроз×невроз в доме «'+VECTORS[v]+'» — две черты закрепляют друг друга ('+cfg.neuro+')'); pen+=cfg.neuro;
    } else {
      out.push('Совпадение тьмы в доме «'+VECTORS[v]+'» — суррогатное использование чужой функции ('+cfg.dark+')'); pen+=cfg.dark;
    }
  });
  if(A.lead===B.lead && A.lead>=0){
    const d=cfg.double;
    if(d>0) out.push('Удвоение ведущего ('+VECTORS[A.lead]+') — для дружбы это плюс ('+(d>0?'+':'')+d+')');
    else if(d<0) out.push('Удвоение ведущего ('+VECTORS[A.lead]+') — две одинаковые функции ('+d+')');
    pen+=d;
  }
  return [out,pen];
}
function score(A,B,relType){
  const cfg=REL[relType];
  const [p1,d1]=layer1(A,B,cfg), [p2,d2]=layer2(A,B,cfg), [p3,ovl]=layer3(A,B,cfg);
  const fr=friction(A,B), [fl,fp]=flags(A,B,relType);
  const raw=p1+p2+p3+fp-fr;
  const ceiling=Math.max(50,100-fr);
  const percent=Math.max(0,Math.round(100*raw/ceiling));
  return {percent, raw:Math.round(raw), ceiling, l1:Math.round(p1), l2:Math.round(p2),
          l3:Math.round(p3), friction:fr, flags:fl, d1, d2, overlap:ovl.map(i=>VECTORS[i]), rel:relType};
}
function verdict(pct,flagsCount){
  if(flagsCount>=2 && pct<25) return 'Красная зона пары: флаги перекрывают всё';
  if(pct>=70) return 'Отличный потенциал';
  if(pct>=55) return 'Сильная пара';
  if(pct>=40) return 'Рабочий вариант';
  if(pct>=20) return 'Рискованная связка';
  return 'Флаги доминируют — осторожно';
}

/* ---- Кодек профиля в URL ---- */
function encodeProfile(p){
  const s=JSON.stringify(p);
  const b=btoa(unescape(encodeURIComponent(s)));
  return b.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decodeProfile(str){
  let b=str.replace(/-/g,'+').replace(/_/g,'/');
  while(b.length%4) b+='=';
  return JSON.parse(decodeURIComponent(escape(atob(b))));
}

/* ---- Golden-корпус: 9 зафиксированных случаев (калибровка v2.1) ---- */
const GOLDEN = [{"id": "construct_partner", "rel": "partner", "a": {"v": [2, 3, 4, 3, 2, 2, 3, 2], "lead": 2, "dark": {"2": 2, "5": 1}, "light": [3, 7]}, "b": {"v": [3, 3, 3, 4, 2, 4, 3, 3], "lead": 3, "dark": {}, "light": [4, 5, 2]}, "expect": 60, "raw": 42, "ceiling": 70, "nflags": 0}, {"id": "door2_partner", "rel": "partner", "a": {"v": [2, 3, 4, 3, 2, 2, 3, 2], "lead": 2, "dark": {"2": 2, "5": 1}, "light": [3, 7]}, "b": {"v": [1, 3, 1, 2, 2, 3, 3, 2], "lead": 1, "dark": {"2": 1}, "light": [3, 5, 6]}, "expect": 63, "raw": 57, "ceiling": 90, "nflags": 1}, {"id": "door2_friend", "rel": "friend", "a": {"v": [2, 3, 4, 3, 2, 2, 3, 2], "lead": 2, "dark": {"2": 2, "5": 1}, "light": [3, 7]}, "b": {"v": [1, 3, 1, 2, 2, 3, 3, 2], "lead": 1, "dark": {"2": 1}, "light": [3, 5, 6]}, "expect": 60, "raw": 54, "ceiling": 90, "nflags": 1}, {"id": "door2_business", "rel": "business", "a": {"v": [2, 3, 4, 3, 2, 2, 3, 2], "lead": 2, "dark": {"2": 2, "5": 1}, "light": [3, 7]}, "b": {"v": [1, 3, 1, 2, 2, 3, 3, 2], "lead": 1, "dark": {"2": 1}, "light": [3, 5, 6]}, "expect": 74, "raw": 67, "ceiling": 90, "nflags": 1}, {"id": "anti_partner", "rel": "partner", "a": {"v": [2, 3, 4, 3, 2, 2, 3, 2], "lead": 2, "dark": {"2": 2, "5": 1}, "light": [3, 7]}, "b": {"v": [2, 4, 3, 1, 2, 1, 1, 2], "lead": 1, "dark": {"2": 2, "5": 1}, "light": [0]}, "expect": 0, "raw": -13, "ceiling": 80, "nflags": 2}, {"id": "self_p_partner", "rel": "partner", "a": {"v": [2, 3, 4, 3, 2, 2, 3, 2], "lead": 2, "dark": {"2": 2, "5": 1}, "light": [3, 7]}, "b": {"v": [2, 3, 4, 3, 2, 2, 3, 2], "lead": 2, "dark": {"2": 2, "5": 1}, "light": [3, 7]}, "expect": 0, "raw": -3, "ceiling": 80, "nflags": 3}, {"id": "self_f_friend", "rel": "friend", "a": {"v": [2, 3, 4, 3, 2, 2, 3, 2], "lead": 2, "dark": {"2": 2, "5": 1}, "light": [3, 7]}, "b": {"v": [2, 3, 4, 3, 2, 2, 3, 2], "lead": 2, "dark": {"2": 2, "5": 1}, "light": [3, 7]}, "expect": 74, "raw": 59, "ceiling": 80, "nflags": 3}, {"id": "self_b_business", "rel": "business", "a": {"v": [2, 3, 4, 3, 2, 2, 3, 2], "lead": 2, "dark": {"2": 2, "5": 1}, "light": [3, 7]}, "b": {"v": [2, 3, 4, 3, 2, 2, 3, 2], "lead": 2, "dark": {"2": 2, "5": 1}, "light": [3, 7]}, "expect": 34, "raw": 27, "ceiling": 80, "nflags": 3}, {"id": "zero_partner", "rel": "partner", "a": {"v": [2, 3, 4, 3, 2, 2, 3, 2], "lead": 2, "dark": {"2": 2, "5": 1}, "light": [3, 7]}, "b": {"v": [0, 0, 0, 0, 0, 0, 0, 0], "lead": -1, "dark": {}, "light": []}, "expect": 1, "raw": 1, "ceiling": 90, "nflags": 0}];

function runGoldenTests(){
  const failures=[];
  for(const t of GOLDEN){
    const got=score(t.a,t.b,t.rel).percent;
    if(got!==t.expect) failures.push(t.id+': ожидалось '+t.expect+', получено '+got);
  }
  return {ok:failures.length===0, failures, total:GOLDEN.length};
}

if (typeof module!=='undefined') module.exports={score,runGoldenTests,encodeProfile,decodeProfile,VECTORS,REL};
