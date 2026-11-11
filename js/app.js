/* =========================================================
   Study Skill Quest — 앱 로직
   ========================================================= */
(function () {
"use strict";
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pad = n => String(n).padStart(2, "0");
const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return ymd(d); };
const diffDays = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 864e5);
const fmtDate = s => { const d = new Date(s + "T00:00:00"); return (d.getMonth() + 1) + "/" + d.getDate() + "(" + "일월화수목금토"[d.getDay()] + ")"; };
const uid = () => Math.random().toString(36).slice(2, 9);
const app = $("#app");
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
if (NATIVE) document.documentElement.classList.add("native");
/* 파일 저장: 웹은 다운로드, 앱은 공유 시트 */
async function saveFile(name, blob) {
  const C = window.Capacitor;
  if (NATIVE && C) {
    const P = saveFile.p || (saveFile.p = { Filesystem: (C.Plugins && C.Plugins.Filesystem) || C.registerPlugin("Filesystem"), Share: (C.Plugins && C.Plugins.Share) || C.registerPlugin("Share") });
    try {
      const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });
      const w = await P.Filesystem.writeFile({ path: name, data: b64, directory: "CACHE" });
      await P.Share.share({ title: name, files: [w.uri] });
    } catch (e) { toast("저장을 취소했거나 실패했어요"); }
    return;
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
}

/* ---------------- 상태 ---------------- */
const KEY = "studyskill_quest_v1";
const DEF = () => ({ xp: 0, name: "", sound: true, done: {}, boss: {}, badges: {}, days: {}, mDate: "", mDone: {},
  pomo: { count: 0, log: [] }, decks: null, cardReviews: 0, cToday: { d: "", n: 0 }, qlog: [], qToday: { d: "", n: 0 },
  labs: {}, journal: [], goals: [], woops: [], week: {}, todos: [], examPlan: null, cornell: [], mindmap: null,
  mnemonics: [], pie: null, diag: null, pref: null, dumps: [], feynman: [], xpOnce: {} });
let S;
try { S = Object.assign(DEF(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { S = DEF(); }
if (S.ver !== 2) { S.done = {}; S.boss = {}; S.ver = 2; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 저장 불가 환경 */ } }

/* ---------------- 효과음 ---------------- */
let actx = null;
function beep(type) {
  if (!S.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = type === "win" ? [523, 659, 784, 1047] : type === "bad" ? [300, 220] : type === "bell" ? [880, 660, 880] : [660, 880];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = "sine"; o.frequency.value = f; o.connect(g); g.connect(actx.destination);
      const t = actx.currentTime + i * 0.11;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.start(t); o.stop(t + 0.2);
    });
  } catch (e) {}
}

/* ---------------- 토스트 & 꽃가루 ---------------- */
function toast(msg, cls) {
  const t = document.createElement("div"); t.className = "toast " + (cls || ""); t.innerHTML = msg;
  $("#toasts").appendChild(t); setTimeout(() => t.remove(), 2600);
}
function confetti() {
  const c = $("#confetti"), x = c.getContext("2d");
  c.width = innerWidth; c.height = innerHeight;
  const cols = ["#6C5CE7", "#FD79A8", "#00B894", "#FDCB6E", "#0984E3", "#FF7675"];
  const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight / 3, vx: (Math.random() - .5) * 14, vy: -Math.random() * 12 - 4, r: Math.random() * 6 + 3, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6 }));
  let f = 0;
  (function loop() {
    x.clearRect(0, 0, c.width, c.height);
    ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .35; p.a += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6); x.restore(); });
    if (++f < 110) requestAnimationFrame(loop); else x.clearRect(0, 0, c.width, c.height);
  })();
}

/* ---------------- 게임화: XP·레벨·배지·미션·연속 ---------------- */
const LV = [0, 100, 250, 450, 700, 1000, 1400];
function lvInfo(xp) {
  let i = 0; while (i < LV.length - 1 && xp >= LV[i + 1]) i++;
  const cur = LV[i], nxt = LV[i + 1] || (cur + 500);
  return { i, name: SS.levels[i], pct: Math.min(100, Math.round((xp - cur) / (nxt - cur) * 100)), toNext: nxt - xp };
}
function touchDay() { S.days[today()] = 1; }
function streak() {
  let d = today(), n = 0;
  if (!S.days[d]) d = addDays(d, -1);
  while (S.days[d]) { n++; d = addDays(d, -1); }
  return n;
}
function addXP(n, why) {
  const before = lvInfo(S.xp).i;
  S.xp += n; touchDay(); save();
  toast("✨ +" + n + " XP" + (why ? " · " + esc(why) : ""));
  const after = lvInfo(S.xp).i;
  if (after > before) { setTimeout(() => { toast("🎉 레벨 업! " + SS.levels[after], "badge-t"); confetti(); beep("win"); }, 500); }
  const st = streak(); if (st >= 3) badge("streak3"); if (st >= 7) badge("streak7");
  hud();
}
function xpOnce(key, n, why) { if (S.xpOnce[key]) return false; S.xpOnce[key] = 1; addXP(n, why); return true; }
function badge(id) {
  if (S.badges[id]) return;
  const b = SS.badges.find(x => x.id === id); if (!b) return;
  S.badges[id] = today(); save();
  setTimeout(() => { toast(b.emoji + " 배지 획득: " + b.name, "badge-t"); confetti(); beep("win"); }, 700);
}
function todaysMissions() {
  const d = today();
  if (S.mDate !== d) { S.mDate = d; S.mDone = {}; save(); }
  let seed = d.split("-").reduce((a, b) => a * 31 + +b, 7);
  const pool = SS.missions.slice(), out = [];
  while (out.length < 3) { seed = (seed * 9301 + 49297) % 233280; out.push(pool.splice(seed % pool.length, 1)[0]); }
  return out;
}
function mission(id) {
  const ms = todaysMissions(), m = ms.find(x => x.id === id);
  if (!m || S.mDone[id]) return;
  S.mDone[id] = 1; save();
  setTimeout(() => { addXP(m.xp, "오늘의 미션 완료"); if (ms.every(x => S.mDone[x.id])) { toast("🌟 오늘의 미션 올클리어!", "badge-t"); confetti(); } }, 900);
}
function hud() {
  const L = lvInfo(S.xp);
  $("#xpN").textContent = S.xp; $("#lvlEm").textContent = L.name.split(" ")[0];
  $("#xpBar").style.width = L.pct + "%"; $("#streakN").textContent = streak();
}
function logQuiz(conf, ok) {
  S.qlog.push([conf, ok ? 1 : 0]); if (S.qlog.length > 600) S.qlog.shift();
  if (S.qToday.d !== today()) S.qToday = { d: today(), n: 0 };
  if (ok) { S.qToday.n++; if (S.qToday.n >= 3) mission("quiz"); }
  const c = calib(); if (c && c.n >= 10 && c.score >= 80) badge("calib");
  save();
}
function calib() {
  if (S.qlog.length < 1) return null;
  const n = S.qlog.length; let err = 0, over = 0, under = 0, acc = 0, cf = 0;
  S.qlog.forEach(([c, o]) => { err += Math.abs(c / 100 - o); acc += o; cf += c; if (c === 100 && !o) over++; if (c === 50 && o) under++; });
  return { n, score: Math.round(100 - err / n * 100), acc: Math.round(acc / n * 100), conf: Math.round(cf / n), over, under };
}
function chProgress(ch) { const L = ch.lessons; return { done: L.filter(l => S.done[l.id]).length, total: L.length }; }

/* ---------------- 퀴즈 엔진 (한 문제씩) ---------------- */
function quiz(el, qs, opts) {
  opts = opts || {};
  let i = 0, right = 0, conf = 75;
  const res = [];
  function draw() {
    const q = qs[i];
    el.innerHTML = `<div class="q fade">
      <div class="row" style="justify-content:space-between;margin-bottom:6px"><span class="tag">${opts.label || "확인 퀴즈"} ${i + 1} / ${qs.length}</span>${qs.length > 3 ? `<div class="xpbar" style="display:block;width:120px"><i style="width:${i / qs.length * 100}%"></i></div>` : ""}</div>
      <div class="qt">${q.q}</div>
      ${opts.noConf ? "" : `<div class="conf">나의 확신도: <button data-c="50">🤔 반반</button><button data-c="75">🙂 꽤 알아</button><button data-c="100">😎 확실해</button></div>`}
      <div class="opts">${q.o.map((o, k) => `<button class="opt" data-k="${k}">${String.fromCharCode(9312 + k)} ${o}</button>`).join("")}</div>
      <div class="ans"></div></div>`;
    $$(".conf button", el).forEach(b => { if (+b.dataset.c === conf) b.classList.add("on"); b.onclick = () => { conf = +b.dataset.c; $$(".conf button", el).forEach(x => x.classList.toggle("on", x === b)); }; });
    $$(".opt", el).forEach(b => b.onclick = () => pick(+b.dataset.k));
  }
  function pick(k) {
    const q = qs[i], ok = k === q.a;
    $$(".opt", el).forEach(b => { b.disabled = true; const kk = +b.dataset.k; if (kk === q.a) b.classList.add("right"); else if (kk === k) b.classList.add("wrong"); });
    $$(".conf button", el).forEach(b => b.disabled = true);
    if (ok) { right++; beep("ok"); } else beep("bad");
    if (!opts.noConf) logQuiz(conf, ok);
    res.push({ ok, conf });
    let note = "";
    if (!opts.noConf) { if (ok && conf === 50) note = " <span class='chip r'>알고 있었는데 자신이 없었네요!</span>"; if (!ok && conf === 100) note = " <span class='chip t'>확신했지만 틀림 → 꼭 다시 보기</span>"; }
    $(".ans", el).innerHTML = `<div class="exp">${ok ? "⭕ 정답!" : "❌ 아쉬워요."} ${q.e || ""}${note}</div>
      <div class="row" style="margin-top:10px"><button class="btn sm nx">${i < qs.length - 1 ? "다음 문제 →" : "결과 보기"}</button></div>`;
    $(".nx", el).onclick = () => { i++; if (i < qs.length) draw(); else finish(); };
  }
  function finish() {
    if (opts.onDone) opts.onDone(right, qs.length, res, el);
    else el.innerHTML = `<div class="q fade" style="text-align:center"><div class="score-big">${right}/${qs.length}</div><p class="muted">맞힌 문제</p><button class="btn ghost sm again">다시 하기</button></div>`;
    const a = $(".again", el); if (a) a.onclick = () => { i = 0; right = 0; res.length = 0; draw(); };
  }
  draw();
}
function shuffleQ(q) { const idx = shuffle(q.o.map((_, i) => i)); return { q: q.q, o: idx.map(i => q.o[i]), a: idx.indexOf(q.a), e: q.e }; }

/* ---------------- 분류(정렬) 게임 엔진 ---------------- */
function sortGame(el, data, onDone) {
  const items = shuffle(data.items); let answered = 0, right = 0;
  el.innerHTML = `<h3>🎮 ${data.title}</h3><p class="small muted">각 문장에 알맞은 칸을 누르세요.</p>` +
    items.map((it, i) => `<div class="sort-item" data-i="${i}"><span>${it[0]}</span><div class="bs">${data.buckets.map((b, k) => `<button class="btn sm ghost" data-k="${k}">${b}</button>`).join("")}</div></div>`).join("") + `<div class="res"></div>`;
  $$(".sort-item", el).forEach(row => {
    $$("button", row).forEach(b => b.onclick = () => {
      const it = items[+row.dataset.i], ok = +b.dataset.k === it[1];
      row.classList.add(ok ? "ok" : "no"); answered++; if (ok) right++;
      $(".bs", row).innerHTML = `<span class="small"><b>${ok ? "⭕" : "❌"} ${data.buckets[it[1]]}</b></span>`;
      ok ? beep("ok") : beep("bad");
      if (answered === items.length) {
        $(".res", el).innerHTML = `<div class="exp"><b>${right} / ${items.length}</b> 정답! ${right === items.length ? "완벽해요 🎉" : "틀린 항목을 다시 읽어 보세요."}</div>`;
        if (onDone) onDone(right, items.length);
      }
    });
  });
}

/* ---------------- 시나리오형 미니게임 데이터 ---------------- */
SS.games = {
  mindset: { title: "마인드셋 바꾸기 게임", desc: "고정 마인드셋 문장을 성장 마인드셋으로 바꿔 보세요.", items: [
    { q: "“나는 원래 수학 머리가 없어.”", o: ["맞아, 포기하자", "이 유형은 아직 어렵지만, 풀이를 따라 써 보고 비슷한 문제를 더 풀어 볼래", "수학은 필요 없어"], a: 1, e: "‘아직’ + 구체적 전략!" },
    { q: "“친구는 한 번 보면 다 아는데 난 왜 이래.”", o: ["친구와 나는 다른 출발점이야. 나는 어제의 나보다 나아지고 있어", "난 바보야", "친구가 이상한 거야"], a: 0, e: "비교 대상은 어제의 나예요." },
    { q: "“이번 시험 망했어. 난 안 돼.”", o: ["다음 시험은 안 볼래", "어떤 문제를 왜 틀렸는지 분석해서 다음 계획에 반영하자", "운이 나빴을 뿐이야"], a: 1, e: "실패는 정보예요. 분석하면 다음 행동이 보여요." },
    { q: "“나는 똑똑하니까 공부 안 해도 돼.”", o: ["맞아, 재능이면 충분해", "재능이 있어도 연습하지 않으면 실력은 멈춰. 꾸준히 도전하자", "공부는 못하는 애들이나 하는 거야"], a: 1, e: "‘똑똑하다’는 믿음도 고정 마인드셋이 될 수 있어요." }
  ]},
  readmode: { title: "어떤 읽기를 쓸까?", desc: "상황에 맞는 읽기 방법을 고르세요.", items: [
    { q: "새 교과서 단원이 무슨 내용인지 5분 안에 감 잡고 싶다", o: ["훑어 읽기(Skim)", "찾아 읽기(Scan)", "정독"], a: 0, e: "제목·소제목·첫 문장으로 전체 흐름을 잡아요." },
    { q: "역사 자료에서 ‘1919’가 나오는 곳을 찾아야 한다", o: ["훑어 읽기(Skim)", "찾아 읽기(Scan)", "정독"], a: 1, e: "특정 숫자·단어 찾기는 Scan!" },
    { q: "시험에 나올 핵심 개념 설명을 이해하고 외워야 한다", o: ["훑어 읽기(Skim)", "찾아 읽기(Scan)", "정독 + 떠올리기"], a: 2, e: "핵심은 천천히, 질문하며, 덮고 떠올리기까지." },
    { q: "보고서용 자료 10개 중 쓸 만한 것을 골라야 한다", o: ["훑어 읽기(Skim)", "모두 정독", "아무거나 고르기"], a: 0, e: "먼저 훑어서 고르고, 고른 것만 정독해요." }
  ]},
  critical: { title: "비판적 사고 트레이닝", desc: "주장을 보고 가장 날카로운 질문을 고르세요.", items: [
    { q: "광고: “이 음료를 마신 학생 90%가 성적이 올랐습니다!”", o: ["와, 당장 사야지", "몇 명을 조사했고, 음료 말고 다른 이유는 없었을까?", "맛은 어떨까?"], a: 1, e: "표본 크기와 다른 원인(교란 변수)을 따져 봐야 해요." },
    { q: "“유명 연예인이 이 공부법을 추천했으니 최고다.”", o: ["연예인이 말했으니 맞다", "그 공부법이 효과 있다는 연구나 근거가 있을까?", "나도 연예인이 되고 싶다"], a: 1, e: "권위보다 근거를 확인해요." },
    { q: "“게임을 하는 학생들이 성적이 낮다. 그러니 게임이 성적을 떨어뜨린다.”", o: ["당연히 맞다", "함께 나타난다고 원인이라고 할 수 있을까? 다른 요인은?", "게임은 재밌다"], a: 1, e: "상관관계 ≠ 인과관계!" },
    { q: "인터넷 글: “출처는 없지만 모두가 아는 사실임”", o: ["모두가 안다니 믿는다", "출처와 작성자, 날짜를 확인하고 다른 자료와 비교한다", "공유한다"], a: 1, e: "출처 없는 ‘상식’은 확인이 필요해요." }
  ]},
  verbs: { title: "요구 행동 해독 게임", desc: "과제 질문의 핵심 동사가 무엇을 하라는지 고르세요.", items: [
    { q: "‘비교하시오(Compare)’", o: ["공통점과 차이점을 함께 제시", "하나만 자세히 설명", "개인 감상 쓰기"], a: 0, e: "비교는 공통점+차이점, 대조는 차이점 중심이에요." },
    { q: "‘평가하시오(Evaluate)’", o: ["사실만 나열", "장단점·근거를 따져 가치나 결론을 판단", "줄거리 요약"], a: 1, e: "평가는 근거를 바탕으로 판단까지 내려야 해요." },
    { q: "‘분석하시오(Analyse)’", o: ["요소로 나누어 관계와 원인을 살펴보기", "그림 그리기", "찬성만 하기"], a: 0, e: "분석 = 쪼개서 관계를 보기." },
    { q: "‘서술하시오/기술하시오(Describe)’", o: ["무엇이 어떤지 특징을 자세히 보여 주기", "반드시 반대 의견 쓰기", "한 단어로 답하기"], a: 0, e: "서술은 ‘무엇이 어떠한가’를 보여 주는 것." },
    { q: "‘논하시오(Discuss)’", o: ["한쪽 입장만 쓰기", "여러 관점을 살펴보고 자신의 결론 제시", "정의만 쓰기"], a: 1, e: "논의는 다양한 관점 + 나의 결론." }
  ]},
  search: { title: "검색어 고수 게임", desc: "목적에 가장 맞는 검색어를 고르세요.", items: [
    { q: "‘기후 변화’라는 정확한 문구가 들어간 자료만", o: ["기후 변화", "\"기후 변화\"", "기후 -변화"], a: 1, e: "큰따옴표 = 정확히 그 문구." },
    { q: "PDF 형식의 공부법 보고서만", o: ["공부법 보고서 filetype:pdf", "공부법 pdf 사이트", "공부법 -pdf"], a: 0, e: "filetype:pdf로 파일 형식을 지정해요." },
    { q: "‘재규어’ 검색에서 자동차 말고 동물 정보만", o: ["재규어 동물 -자동차", "재규어 자동차", "\"재규어\""], a: 0, e: "빼고 싶은 단어 앞에 - 를 붙여요." },
    { q: "교육부 사이트 안에서 ‘고교학점제’ 자료", o: ["고교학점제 교육부", "고교학점제 site:moe.go.kr", "site 고교학점제"], a: 1, e: "site:도메인 으로 특정 사이트 안에서만 검색!" }
  ]},
  errors: { title: "오답 원인 탐정", desc: "틀린 이유를 진단하고 처방을 떠올려 보세요.", items: [
    { q: "공식은 아는데 7×8을 54로 계산했다", o: ["개념 부족", "실수", "문제 오독", "시간 부족"], a: 1, e: "처방: 검산 습관, 마지막 5분 검토." },
    { q: "‘광합성’이 무엇인지 설명을 못 해서 틀렸다", o: ["개념 부족", "실수", "문제 오독", "시간 부족"], a: 0, e: "처방: 다시 이해하고 인출 연습!" },
    { q: "‘두 가지 쓰시오’인데 한 가지만 썼다", o: ["개념 부족", "실수", "문제 오독", "시간 부족"], a: 2, e: "처방: 조건에 밑줄·동그라미 치기." },
    { q: "마지막 서술형 두 문제를 못 쓰고 시간이 끝났다", o: ["개념 부족", "실수", "문제 오독", "시간 부족"], a: 3, e: "처방: 배점 비율 시간 배분, 쉬운 문제부터, 기출로 시간 연습." }
  ]},
  interleave: { title: "섞어서 풀기: 이 문제엔 어떤 공식?", desc: "넓이 문제가 섞여 나와요. 각 문제에 맞는 공식을 먼저 골라 보세요.", items: [
    { q: "밑변 6cm, 높이 4cm인 삼각형의 넓이", o: ["가로×세로", "밑변×높이÷2", "반지름×반지름×3.14", "(윗변+아랫변)×높이÷2"], a: 1, e: "6×4÷2 = 12㎠" },
    { q: "반지름 3cm인 원의 넓이", o: ["가로×세로", "밑변×높이÷2", "반지름×반지름×3.14", "(윗변+아랫변)×높이÷2"], a: 2, e: "3×3×3.14 = 28.26㎠" },
    { q: "윗변 4cm, 아랫변 8cm, 높이 5cm인 사다리꼴", o: ["가로×세로", "밑변×높이÷2", "반지름×반지름×3.14", "(윗변+아랫변)×높이÷2"], a: 3, e: "(4+8)×5÷2 = 30㎠" },
    { q: "가로 7cm, 세로 3cm인 직사각형", o: ["가로×세로", "밑변×높이÷2", "반지름×반지름×3.14", "(윗변+아랫변)×높이÷2"], a: 0, e: "7×3 = 21㎠" },
    { q: "지름 10cm인 원의 넓이", o: ["가로×세로", "밑변×높이÷2", "반지름×반지름×3.14", "(윗변+아랫변)×높이÷2"], a: 2, e: "지름이 10이면 반지름은 5! 5×5×3.14 = 78.5㎠" }
  ]},
  example: { title: "개념 ↔ 구체적 예시 연결", desc: "개념에 딱 맞는 예시를 고르세요.", items: [
    { q: "관성: 물체가 원래 운동 상태를 유지하려는 성질", o: ["버스가 급정거하면 몸이 앞으로 쏠린다", "얼음이 녹는다", "식물이 햇빛 쪽으로 자란다"], a: 0, e: "움직이던 몸이 계속 움직이려 해서 앞으로 쏠려요." },
    { q: "기회비용: 무언가를 선택해서 포기한 것 중 가장 큰 가치", o: ["용돈으로 게임을 사서 못 산 운동화", "물건값이 오르는 것", "은행에 저금하는 것"], a: 0, e: "선택하느라 포기한 것이 기회비용이에요." },
    { q: "은유: ‘A는 B이다’ 꼴로 빗대어 표현", o: ["내 마음은 호수요", "바람이 분다", "그는 키가 크다"], a: 0, e: "‘~처럼/같이’ 없이 직접 빗대면 은유예요." },
    { q: "증발: 액체 표면에서 기체로 변하는 현상", o: ["젖은 빨래가 마른다", "물이 얼음이 된다", "유리창에 물방울이 맺힌다"], a: 0, e: "물방울 맺힘은 응결, 얼음은 응고예요." }
  ]}
};
function scenarioGame(el, key) {
  const g = SS.games[key];
  el.innerHTML = `<h3>🎮 ${g.title}</h3><p class="small muted">${g.desc}</p><div class="sg"></div>`;
  quiz($(".sg", el), g.items, { noConf: true, label: "게임", onDone: (r, n, _, box) => {
    box.innerHTML = `<div class="q" style="text-align:center"><div class="score-big">${r}/${n}</div><p>${r === n ? "완벽해요! 🎉" : "좋아요! 틀린 문제의 해설을 기억해 두세요."}</p><button class="btn ghost sm again">다시 하기</button></div>`;
    $(".again", box).onclick = () => scenarioGame(el, key);
    if (r === n) beep("win");
  }});
}

/* ---------------- 특수 미니게임 ---------------- */
const games = {
  digitspan(el) {
    let n = 4, fails = 0, best = 0;
    el.innerHTML = `<h3>🎮 작업기억 측정: 숫자 기억 게임</h3><p class="small muted">숫자가 잠깐 나타났다 사라져요. 순서대로 입력하세요. 몇 자리까지 기억할 수 있을까요?</p>
      <div class="digits">준비!</div><div class="row in" style="justify-content:center"><button class="btn st">시작하기</button></div><div class="res"></div>`;
    const D = $(".digits", el), IN = $(".in", el);
    function round() {
      const num = Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
      D.textContent = num; IN.innerHTML = `<span class="muted small">${n}자리 외우는 중…</span>`;
      setTimeout(() => {
        D.textContent = "❓".repeat(Math.min(n, 9));
        IN.innerHTML = `<input class="ans" inputmode="numeric" style="max-width:220px;text-align:center;font-size:20px" placeholder="숫자 입력"><button class="btn ok">확인</button>`;
        const inp = $(".ans", IN); inp.focus();
        const go = () => {
          if (inp.value.replace(/\D/g, "") === num) { best = n; beep("ok"); D.textContent = "⭕ " + num; n++; fails = 0; IN.innerHTML = `<button class="btn st">다음 (${n}자리)</button>`; $(".st", IN).onclick = round; }
          else { beep("bad"); fails++; D.textContent = "❌ 정답: " + num; if (fails >= 2) end(); else { IN.innerHTML = `<button class="btn st">한 번 더 (${n}자리)</button>`; $(".st", IN).onclick = round; } }
        };
        $(".ok", IN).onclick = go; inp.onkeydown = e => { if (e.key === "Enter") go(); };
      }, 900 + n * 550);
    }
    function end() {
      IN.innerHTML = `<button class="btn ghost st">다시 도전</button>`; $(".st", IN).onclick = () => { n = 4; fails = 0; best = 0; $(".res", el).innerHTML = ""; round(); };
      $(".res", el).innerHTML = `<div class="exp">🧠 나의 기록: <b>${best}자리</b>. 대부분의 사람은 7자리 안팎에서 막혀요. 작업기억은 이렇게 작답니다!<br>💡 <b>청킹 비법</b>: 01012345678을 010-1234-5678처럼 묶으면 3덩어리만 기억하면 돼요. 공부할 때도 정보를 의미 있는 덩어리로 묶어 보세요.</div>`;
    }
    $(".st", el).onclick = round;
  },
  styles(el) {
    el.innerHTML = `<h3>🎨 나의 학습 선호 탐색</h3><p class="small">‘유형 판정’이 아니라 내가 즐기는 방식과 더 섞어 볼 방식을 찾는 12문항 탐색이에요.</p><a class="btn" href="#/diag/pref">선호 탐색하러 가기 →</a>`;
  },
  loci(el) {
    const spots = [["🚪", "현관"], ["🛋️", "소파"], ["📺", "TV"], ["🍳", "부엌"], ["🛏️", "침대"]];
    const pool = [["🍌", "바나나"], ["🎸", "기타"], ["🐘", "코끼리"], ["⏰", "시계"], ["🌂", "우산"], ["🚲", "자전거"], ["🍕", "피자"], ["🧦", "양말"], ["🦆", "오리"], ["🎈", "풍선"]];
    let items = shuffle(pool).slice(0, 5);
    el.innerHTML = `<h3>🎮 기억의 궁전 체험</h3><p class="small muted">우리 집 다섯 장소에 물건을 하나씩 놓아둘게요. 각 장소에서 물건이 벌이는 <b>엉뚱한 장면</b>을 상상하세요. (예: 현관에서 바나나가 신발을 신고 있다!)</p>
      <div class="loci-room">${spots.map((s, i) => `<div><b>${s[0]}</b>${s[1]}<em>${items[i][0]}</em><small>${items[i][1]}</small></div>`).join("")}</div>
      <div class="row"><button class="btn go">다 상상했어요! 테스트 시작</button></div><div class="res"></div>`;
    $(".go", el).onclick = () => {
      const opts = shuffle(pool);
      $(".loci-room", el).innerHTML = spots.map((s, i) => `<div><b>${s[0]}</b>${s[1]}<select data-i="${i}" style="margin-top:6px;padding:4px;font-size:13px"><option value="">?</option>${opts.map(o => `<option>${o[1]}</option>`).join("")}</select></div>`).join("");
      $(".go", el).outerHTML = `<button class="btn mint chk">채점하기</button>`;
      $(".chk", el).onclick = () => {
        let r = 0; $$("select", el).forEach(s => { const ok = s.value === items[+s.dataset.i][1]; if (ok) r++; s.parentElement.style.background = ok ? "#D5F5EC" : "#FFE5E5"; });
        $(".res", el).innerHTML = `<div class="exp"><b>${r} / 5</b> 기억! ${r >= 4 ? "기억의 궁전이 작동했어요 🏰" : "장면을 더 엉뚱하고 생생하게 상상할수록 잘 기억돼요."} 실제 공부에선 외울 목록(예: 역사 사건 순서)을 집 안 장소에 배치해 보세요.</div>`;
        beep(r >= 4 ? "win" : "ok");
      };
    };
  },
  timecalc(el) {
    el.innerHTML = `<h3>🧮 시험 시간 배분 계산기</h3>
      <div class="grid g3"><label>전체 시간(분)<input class="tt" type="number" value="50"></label><label>검토 시간(분)<input class="rv" type="number" value="5"></label><label>문항 배점(쉼표로)<input class="pts" value="10,10,20,30,30"></label></div>
      <div class="out" style="margin-top:12px"></div>`;
    const calc = () => {
      const T = +$(".tt", el).value || 0, R = +$(".rv", el).value || 0, P = $(".pts", el).value.split(/[,\s]+/).map(Number).filter(x => x > 0);
      const sum = P.reduce((a, b) => a + b, 0), avail = Math.max(0, T - R);
      if (!sum) { $(".out", el).innerHTML = ""; return; }
      $(".out", el).innerHTML = `<table class="plan"><tr><th>문항</th><th>배점</th><th>권장 시간</th></tr>${P.map((p, i) => `<tr><td>${i + 1}번</td><td>${p}점</td><td><b>${(avail * p / sum).toFixed(1)}분</b></td></tr>`).join("")}<tr><td>검토</td><td>—</td><td><b>${R}분</b></td></tr></table>`;
    };
    $$("input", el).forEach(i => i.oninput = calc); calc();
  },
  password(el) {
    el.innerHTML = `<h3>🔐 비밀번호 강도 체험</h3><p class="small muted">연습용이에요. 실제 비밀번호는 입력하지 마세요! (저장되지 않음)</p>
      <input class="pw" placeholder="예: sunny2010 / 파란-고래가-3번-점프!" autocomplete="off"><div class="xpbar" style="display:block;width:100%;height:12px;margin:10px 0"><i class="m"></i></div><div class="o small"></div>`;
    $(".pw", el).oninput = e => {
      const v = e.target.value; let s = 0; const tips = [];
      if (v.length >= 8) s += 20; if (v.length >= 12) s += 25; else tips.push("12자 이상으로 길게");
      if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s += 10; if (/\d/.test(v)) s += 10; else tips.push("숫자 섞기");
      if (/[^A-Za-z0-9가-힣]/.test(v)) s += 15; else tips.push("특수문자 섞기");
      if (/[가-힣\-\s]/.test(v) && v.length >= 14) s += 20;
      if (/(1234|password|qwer|abcd|0000|1111|iloveyou)/i.test(v)) { s -= 40; tips.push("흔한 패턴 피하기"); }
      if (/(19|20)\d{2}/.test(v)) { s -= 10; tips.push("생년 같은 개인정보 빼기"); }
      s = Math.max(0, Math.min(100, s));
      $(".m", el).style.width = s + "%"; $(".m", el).style.background = s < 40 ? "#FF7675" : s < 70 ? "#FDCB6E" : "#00B894";
      $(".o", el).innerHTML = v ? `강도 <b>${s < 40 ? "약함" : s < 70 ? "보통" : "강함"}</b> ${tips.length ? "· 개선: " + tips.join(", ") : "· 훌륭해요! 사이트마다 다르게 + 2단계 인증까지!"}` : "";
    };
  }
};

/* ---------------- 라우터 ---------------- */
const routes = {};
function go() {
  const h = location.hash.replace(/^#\/?/, "") || "home";
  const [r, a, b] = h.split("/");
  $$("[data-r]").forEach(x => x.classList.toggle("on", x.dataset.r === r || (r === "ch" && x.dataset.r === "quest") || (r === "ls" && x.dataset.r === "quest") || (r === "boss" && x.dataset.r === "quest") || (r === "tool" && x.dataset.r === "tools")));
  (routes[r] || routes.home)(a, b);
  window.scrollTo(0, 0);
  timerHud();
}
window.addEventListener("hashchange", go);

function sideChapters() {
  $("#sideCh").innerHTML = SS.chapters.map(c => { const p = chProgress(c); return `<a class="chlink" href="#/ch/${c.id}">${c.emoji} ${c.id}. ${c.title} <span class="small muted" style="margin-left:auto">${S.boss[c.id] ? "👑" : p.done + "/" + p.total}</span></a>`; }).join("");
}

/* ---------------- 홈 ---------------- */
const TIPS = [
  "형광펜을 칠했다면, 여백에 ‘왜 중요한지’ 질문 하나를 써 보세요.",
  "책을 덮고 1분 동안 떠올려 보는 것이, 한 번 더 읽는 것보다 효과적이에요.",
  "같은 단원을 1일·3일·7일 뒤에 다시 만나면 기억이 훨씬 오래가요.",
  "휴대폰은 무음보다 ‘다른 방’이 집중에 더 좋아요.",
  "잠은 기억의 저장 버튼! 시험 전날 밤샘은 손해예요.",
  "친구에게 설명하다 막히는 곳 = 내가 다시 공부할 곳.",
  "‘만약 ~하면, ~한다’ 계획은 결심보다 실행률이 높아요.",
  "공부할 때는 한 번에 한 가지! 멀티태스킹은 효율을 떨어뜨려요.",
  "문제 유형을 섞어서 풀면 처음엔 어렵지만 시험에서 더 강해져요.",
  "시험 직전 10분, 걱정을 종이에 쏟아내면 머릿속 공간이 생겨요."
];
function nextLesson() {
  for (const c of SS.chapters) for (const l of c.lessons) if (!S.done[l.id]) return { c, l };
  return null;
}
function worldsHTML() {
  return `<div class="worlds">${SS.chapters.map(c => { const p = chProgress(c); return `<a class="world" href="#/ch/${c.id}" style="background:linear-gradient(140deg,${c.color},${c.color}cc)">${S.boss[c.id] ? '<span class="crown">👑</span>' : ""}<span class="em">${c.emoji}</span><div><small>${c.id}장 · ${c.sub}</small><b>${c.title}</b><div class="bar"><i style="width:${p.done / p.total * 100}%"></i></div><small>${p.done}/${p.total} 레슨</small></div></a>`; }).join("")}</div>`;
}
routes.home = function () {
  const L = lvInfo(S.xp), ms = todaysMissions(), nx = nextLesson();
  const tip = TIPS[new Date().getDate() % TIPS.length];
  app.innerHTML = `<div class="fade">
  <section class="hero">
    <div class="deco">📚</div>
    <div class="lvl"><div class="ring" style="--v:${L.pct}"><b>${L.name.split(" ")[0]}</b></div>
      <div><div style="font-weight:800;font-size:18px">${S.name ? esc(S.name) + "님, " : ""}${L.name.split(" ").slice(1).join(" ")}</div><div class="small" style="opacity:.9">${S.xp} XP · 다음 레벨까지 ${L.toNext} XP · 🔥 ${streak()}일 연속</div></div></div>
    <h1>공부도 기술이다! 🚀</h1>
    <p>뇌가 배우는 원리부터 집중·시간 관리, 노트·암기법, 시험 전략, 마음 관리까지. 레슨을 깨고, 과학적으로 검증된 공부법을 실험하고, 도구로 바로 실천하며 <b>스스로 공부하는 힘</b>을 키워요.</p>
    ${S.name ? "" : `<div class="namebox" style="margin-bottom:12px"><input id="nm" placeholder="닉네임을 정해 주세요"><button class="btn" id="nmOk">저장</button></div>`}
    <div class="row">${nx ? `<a class="btn" href="#/ls/${nx.l.id}">▶ 이어서 하기: ${nx.l.title}</a>` : `<a class="btn" href="#/me">👑 모든 레슨 완료! 기록 보기</a>`}<a class="btn ghost" href="#/diag">🩺 공부 습관 진단</a></div>
  </section>
  <div class="grid g2" style="margin-top:18px">
    <div class="card"><h3>🎯 오늘의 미션</h3>${ms.map(m => `<div class="mission ${S.mDone[m.id] ? "done" : ""}"><span class="ck">${S.mDone[m.id] ? "✔" : ""}</span><span>${m.text}</span><span class="xp">+${m.xp} XP</span></div>`).join("")}<p class="small muted" style="margin:6px 0 0">미션은 매일 바뀌어요. 레슨·도구를 쓰면 자동으로 체크됩니다.</p></div>
    <div class="card"><h3>💡 오늘의 과학 공부 팁</h3><div class="tipbox">${tip}</div>
      <h3 style="margin-top:16px">⚡ 바로 실천</h3><div class="grid g3">
      <a class="quick" href="#/tool/timer"><b>🍅</b>집중 타이머</a><a class="quick" href="#/tool/cards"><b>🃏</b>플래시카드</a><a class="quick" href="#/lab/retrieval"><b>🧲</b>백지 복습</a></div></div>
  </div>
  <h2 style="margin-top:26px">🗺️ 7개의 공부 월드</h2><p class="muted" style="margin-top:-4px">각 월드의 레슨을 모두 깨고 보스 퀴즈에 도전하면 👑 배지를 얻어요.</p>
  ${worldsHTML()}
  <h2 style="margin-top:26px">🔬 과학이 인정한 공부법 TOP 3</h2>
  <div class="grid g3">${SS.labs.slice(0, 3).map(l => labCard(l)).join("")}</div>
  </div>`;
  const nb = $("#nmOk"); if (nb) nb.onclick = () => { const v = $("#nm").value.trim(); if (v) { S.name = v.slice(0, 12); save(); routes.home(); toast("반가워요, " + esc(S.name) + "님! 👋"); } };
};

/* ---------------- 퀘스트 / 챕터 / 레슨 / 보스 ---------------- */
routes.quest = function () {
  const all = SS.chapters.reduce((a, c) => a + c.lessons.length, 0), dn = Object.keys(S.done).length;
  app.innerHTML = `<div class="fade"><div class="page-head"><h1>🗺️ 퀘스트: 7개의 공부 월드</h1><p class="muted">뇌의 원리 → 마음 → 시간·집중 → <b>입력</b>(읽기·노트) → <b>기억</b>(복습) → <b>출력</b>(글·시험) → 회복으로 이어지는 7개 월드예요. 레슨 → 미니게임 → 확인 퀴즈 → 보스 퀴즈 순서로 진행해요. 전체 진행률 <b>${dn}/${all}</b></p></div>${worldsHTML()}
  <div class="card" style="margin-top:20px"><h3>🧭 추천 순서</h3><p class="small" style="margin:0">처음이라면 <b>1 → 2 → 3번 월드</b>로 기초를 다지고, 시험이 다가오면 <b>5번(기억) → 6번(출력·시험) → 7번(회복)</b>을 먼저 봐도 좋아요. 자신에게 필요한 장을 고르는 것도 자기주도 학습이에요!</p></div></div>`;
};
routes.ch = function (id) {
  const c = SS.chapters.find(x => x.id === +id); if (!c) return routes.quest();
  const p = chProgress(c);
  app.innerHTML = `<div class="fade">
    <div class="hero" style="background:linear-gradient(135deg,${c.color},${c.color}aa)"><div class="deco">${c.emoji}</div>
      <div class="small" style="opacity:.9"><a href="#/quest" style="color:#fff">퀘스트</a> › ${c.id}장</div>
      <h1>${c.emoji} ${c.title}</h1><p>${c.intro}</p>
      <div class="row"><span class="pill" style="color:var(--ink)">📘 ${p.done}/${p.total} 레슨</span>${S.boss[c.id] ? `<span class="pill" style="color:var(--ink)">👑 보스 최고 ${S.boss[c.id]}%</span>` : ""}</div></div>
    <div class="lesson-list" style="margin-top:18px">${c.lessons.map((l, i) => `<a href="#/ls/${l.id}"><span style="font-size:22px">${l.emoji}</span><span>${c.id}-${i + 1}. ${l.title}</span><span class="st ${S.done[l.id] ? "ok" : ""}">${S.done[l.id] ? "✔ 완료" : "시작 →"}</span></a>`).join("")}</div>
    <div class="card" style="margin-top:12px;display:flex;align-items:center;gap:14px;flex-wrap:wrap"><span style="font-size:40px">🐉</span><div style="flex:1;min-width:200px"><h3 style="margin:0">보스 퀴즈: ${c.title}</h3><p class="small muted" style="margin:0">이 장의 모든 문제가 섞여 나와요. 60% 이상이면 클리어! ${p.done < p.total ? "(레슨을 먼저 마치면 더 쉬워요)" : ""}</p></div><a class="btn coral" href="#/boss/${c.id}">⚔️ 도전하기</a></div>
  </div>`;
};
routes.ls = function (lid) {
  let c, l, idx; SS.chapters.forEach(ch => ch.lessons.forEach((x, i) => { if (x.id === lid) { c = ch; l = x; idx = i; } }));
  if (!l) return routes.quest();
  const flat = []; SS.chapters.forEach(ch => ch.lessons.forEach(x => flat.push(x.id)));
  const fi = flat.indexOf(lid), prev = flat[fi - 1], next = flat[fi + 1];
  const tl = l.toolLink ? TOOLS.find(t => t.id === l.toolLink) : null;
  app.innerHTML = `<div class="fade" style="--cc:${c.color}">
    <div class="page-head"><div class="crumb"><a href="#/quest">퀘스트</a> › <a href="#/ch/${c.id}">${c.id}장 ${c.title}</a> › 레슨 ${idx + 1}/${c.lessons.length}</div>
    <h1>${l.emoji} ${l.title} ${S.done[l.id] ? '<span class="tag hi">완료</span>' : ""}</h1></div>
    <ol class="pts">${l.points.map((p, i) => `<li style="animation-delay:${i * .08}s">${p}</li>`).join("")}</ol>
    ${l.fact ? `<div class="fact"><h4>🔬 ${l.fact.title}</h4>${l.fact.text}</div>` : ""}
    ${l.tip ? `<div class="tip">✏️ <b>지금 해 보기</b> — ${l.tip}</div>` : ""}
    ${tl ? `<a class="btn ghost" href="#/tool/${tl.id}">${tl.emoji} ${tl.name} 열기</a>` : ""}
    ${l.sort ? `<div class="act" id="actSort"></div>` : ""}
    ${l.game ? `<div class="act" id="actGame"></div>` : ""}
    ${l.checklist ? `<div class="act"><h3>✅ 체크리스트</h3>${l.checklist.map((x, i) => `<label class="row" style="padding:5px 0"><input type="checkbox" style="width:auto"> ${x}</label>`).join("")}</div>` : ""}
    <h2 style="margin-top:22px">🧩 확인 퀴즈</h2><p class="small muted" style="margin-top:-6px">답을 고르기 전에 <b>확신도</b>를 선택해 보세요. 내가 아는 것과 모르는 것을 구별하는 힘(메타인지)이 자라요.</p>
    <div id="lq"></div>
    <div class="row" style="justify-content:space-between;margin-top:20px">${prev ? `<a class="btn line" href="#/ls/${prev}">← 이전 레슨</a>` : "<span></span>"}${next ? `<a class="btn" href="#/ls/${next}">다음 레슨 →</a>` : `<a class="btn" href="#/boss/${c.id}">⚔️ 보스 퀴즈</a>`}</div>
  </div>`;
  if (l.sort) sortGame($("#actSort"), l.sort, r => { if (r) xpOnce("sort" + l.id, 5, "분류 게임"); });
  if (l.game) { if (SS.games[l.game]) scenarioGame($("#actGame"), l.game); else games[l.game]($("#actGame")); }
  quiz($("#lq"), l.quiz.map(shuffleQ), { onDone: (r, n, res, box) => {
    const first = !S.done[l.id];
    S.done[l.id] = 1; save(); sideChapters();
    box.innerHTML = `<div class="q fade" style="text-align:center"><div style="font-size:44px">${r === n ? "🎉" : "👍"}</div><h3>레슨 완료! ${r}/${n} 정답</h3><p class="small muted">${r === n ? "완벽해요!" : "틀린 문제는 위의 내용을 다시 읽어 보세요."}</p>${next ? `<a class="btn" href="#/ls/${next}">다음 레슨 →</a>` : `<a class="btn coral" href="#/boss/${c.id}">⚔️ 보스 퀴즈 도전</a>`}</div>`;
    if (first) { addXP(10 + r * 5, "레슨 완료"); badge("first"); mission("lesson"); if (r === n) confetti(); }
  }});
};
routes.boss = function (id) {
  const c = SS.chapters.find(x => x.id === +id); if (!c) return routes.quest();
  const qs = shuffle([].concat(...c.lessons.map(l => l.quiz))).map(shuffleQ);
  app.innerHTML = `<div class="fade"><div class="page-head"><div class="crumb"><a href="#/quest">퀘스트</a> › <a href="#/ch/${c.id}">${c.id}장 ${c.title}</a> › 보스</div><h1>🐉 보스 퀴즈: ${c.title}</h1><p class="muted">${qs.length}문제 · 60% 이상이면 클리어 · 확신도도 함께 기록돼요.</p></div><div id="bq"></div></div>`;
  quiz($("#bq"), qs, { label: "보스", onDone: (r, n, res, box) => {
    const pct = Math.round(r / n * 100), clear = pct >= 60, best = S.boss[c.id] || 0;
    if (clear && pct > best) S.boss[c.id] = pct;
    save(); sideChapters();
    const over = res.filter(x => !x.ok && x.conf === 100).length;
    box.innerHTML = `<div class="card fade" style="text-align:center"><div style="font-size:60px">${clear ? "👑" : "💪"}</div><div class="score-big">${pct}%</div><p>${r}/${n} 정답 · ${clear ? "보스 클리어!" : "아쉬워요! 60% 이상이면 클리어예요."}</p>
      ${over ? `<p class="small"><span class="chip t">확신했는데 틀린 문제 ${over}개</span> → 가장 위험한 착각! 해당 레슨을 다시 보세요.</p>` : ""}
      <div class="row" style="justify-content:center"><a class="btn ghost" href="#/ch/${c.id}">챕터로</a><button class="btn re">다시 도전</button>${c.id < 7 ? `<a class="btn" href="#/ch/${c.id + 1}">다음 장 →</a>` : `<a class="btn" href="#/me">내 기록 보기</a>`}</div></div>`;
    $(".re", box).onclick = () => routes.boss(id);
    if (clear) {
      confetti(); beep("win");
      if (xpOnce("boss" + c.id, 50, "보스 클리어")) {} else addXP(r * 2, "보스 재도전");
      badge("ch" + c.id); if (pct === 100) badge("perfect");
      if (SS.chapters.every(x => S.boss[x.id])) badge("all");
    }
  }});
};

/* ---------------- 과학 공부법 랩 ---------------- */
function lvTag(lv) { return `<span class="tag ${lv === "높음" ? "hi" : lv === "낮음" ? "lo" : "mid"}">효과 ${lv}</span>`; }
function labCard(l) { return `<a class="lab-card" href="#/lab/${l.id}"><span class="em">${l.emoji}</span><b>${l.name}</b><span class="en">${l.en}</span>${lvTag(l.level)}<span class="small muted">${l.what.slice(0, 54)}…</span></a>`; }
routes.lab = function (id) {
  if (!id) {
    app.innerHTML = `<div class="fade"><div class="page-head"><h1>🔬 과학 공부법 랩</h1><p class="muted">인지심리학·교육 연구에서 효과가 확인된 공부법을 직접 실험해 보는 곳이에요. 교재 내용에 더해, Dunlosky 등(2013)의 10가지 공부법 평가, The Learning Scientists의 6가지 전략, 영국 교육기금재단(EEF)의 메타인지 연구 등을 바탕으로 만들었어요.</p></div>
      <div class="grid g3">${SS.labs.map(labCard).join("")}</div>
      <div class="fact" style="margin-top:20px"><h4>📊 한눈에 보는 연구 결과 (Dunlosky 외, 2013)</h4><b>효과 높음</b>: 스스로 시험 보기(인출), 간격 두고 나눠 공부하기 · <b>중간</b>: 교차 학습, 정교화 질문, 자기 설명 · <b>낮음</b>: 다시 읽기, 형광펜, 요약, 키워드 암기법, 이미지 떠올리기(글 학습용)<br><span class="small muted">※ ‘낮음’은 쓸모없다는 뜻이 아니라, 연구 근거가 약하거나 효과가 조건에 따라 들쭉날쭉하다는 뜻이에요.</span></div></div>`;
    return;
  }
  const l = SS.labs.find(x => x.id === id); if (!l) return routes.lab();
  if (!S.labs[id]) { S.labs[id] = 1; save(); xpOnce("lab" + id, 5, "공부법 탐험"); mission("lab"); if (Object.keys(S.labs).length >= 5) badge("labs"); }
  app.innerHTML = `<div class="fade"><div class="page-head"><div class="crumb"><a href="#/lab">공부법 랩</a> › ${l.name}</div><h1>${l.emoji} ${l.name} <span class="muted" style="font-size:16px">${l.en}</span></h1>${lvTag(l.level)}</div>
    <div class="grid g2"><div class="card"><h3>🤔 무엇인가요?</h3><p style="margin:0">${l.what}</p></div><div class="card"><h3>🧪 왜 효과가 있을까?</h3><p style="margin:0">${l.why}</p></div></div>
    <div class="card" style="margin-top:16px"><h3>🪜 이렇게 해 보세요</h3><ol class="steps">${l.how.map(h => `<li>${h}</li>`).join("")}</ol></div>
    <div class="act" id="demo"></div>
    <div class="row" style="margin-top:14px"><a class="btn line" href="#/lab">← 랩 목록</a></div></div>`;
  demos[l.demo]($("#demo"));
};
const demos = {
  braindump(el) {
    let left = 180, iv = null;
    el.innerHTML = `<h3>🧲 브레인 덤프 (백지 복습)</h3><p class="small muted">방금 공부한 주제를 쓰고, 3분 동안 기억나는 모든 것을 적어요. 그다음 책을 펴서 빠진 것을 확인해요.</p>
      <div class="grid g2"><input class="tp" placeholder="주제 (예: 세포의 구조)"><div class="row"><button class="btn st">⏱️ 3분 시작</button><b class="tm" style="font-size:22px;font-variant-numeric:tabular-nums">3:00</b></div></div>
      <textarea class="w1" placeholder="책을 덮고, 기억나는 것을 모두 적으세요. 단어, 그림, 화살표 모두 OK!" style="margin-top:10px;min-height:150px"></textarea>
      <div class="p2" style="display:none"><h4>📖 이제 책을 펴고, 빠뜨린 것·틀린 것을 적어 보세요</h4><textarea class="w2" placeholder="빠뜨린 것 = 다음 복습 1순위!"></textarea><button class="btn mint sv" style="margin-top:8px">저장하고 완료</button></div><div class="res"></div>`;
    const tm = $(".tm", el);
    $(".st", el).onclick = () => {
      if (iv) return; $(".w1", el).focus();
      iv = setInterval(() => { left--; tm.textContent = Math.floor(left / 60) + ":" + pad(left % 60); if (left <= 0) { clearInterval(iv); beep("bell"); tm.textContent = "끝!"; $(".p2", el).style.display = "block"; } }, 1000);
      $(".st", el).textContent = "진행 중…";
      setTimeout(() => { $(".p2", el).style.display = "block"; }, 3000);
    };
    $(".sv", el).onclick = () => {
      const w1 = $(".w1", el).value.trim(); if (!w1) { toast("먼저 기억나는 것을 적어 주세요"); return; }
      S.dumps.unshift({ d: today(), t: $(".tp", el).value, a: w1, m: $(".w2", el).value }); S.dumps = S.dumps.slice(0, 30); save();
      clearInterval(iv); mission("dump"); addXP(15, "브레인 덤프");
      $(".res", el).innerHTML = `<div class="exp">저장했어요! 기억해 낸 단어 수: <b>${w1.split(/\s+/).length}</b>개. 빠뜨린 것은 플래시카드로 만들어 두면 좋아요 → <a href="#/tool/cards">플래시카드</a></div>`;
    };
  },
  curve(el) {
    el.innerHTML = `<h3>📉 망각 곡선 실험실</h3><p class="small muted">복습 날짜를 바꿔 보며 30일 뒤 기억이 얼마나 남는지 비교해 보세요. (단순화한 모형이에요)</p>
      <div class="row"><button class="btn sm ghost" data-p="none">복습 없음</button><button class="btn sm ghost" data-p="cram">벼락치기 (29일째 3번)</button><button class="btn sm ghost" data-p="space">간격 복습 (1·3·7·14·29일)</button></div>
      <div class="row small" style="margin-top:8px">직접 복습일 추가: <input class="dd" type="number" min="1" max="29" value="5" style="width:80px"> 일째 <button class="btn sm add">+ 추가</button> <button class="btn sm line clr">초기화</button></div>
      <svg viewBox="0 0 620 260" style="width:100%;margin-top:10px;background:#FCFBFF;border-radius:14px" class="cv"></svg><div class="res"></div>`;
    let reviews = [];
    function sim(revs) {
      const pts = []; let last = 0, s = 1.4; const set = new Set(revs);
      for (let t = 0; t <= 30; t += .1) {
        const day = Math.round(t * 10) / 10;
        if (set.has(day) && day !== last) { const r = Math.exp(-(day - last) / s); s = s * (1.8 + (1 - r) * 1.8); last = day; }
        pts.push([t, Math.exp(-(t - last) / s)]);
      }
      return pts;
    }
    function draw() {
      const pts = sim(reviews.map(Number)), X = t => 40 + t / 30 * 560, Y = r => 220 - r * 190;
      let g = `<line x1="40" y1="220" x2="600" y2="220" stroke="#ccc"/><line x1="40" y1="30" x2="40" y2="220" stroke="#ccc"/>`;
      [0, 50, 100].forEach(v => g += `<text x="34" y="${Y(v / 100) + 4}" font-size="11" text-anchor="end" fill="#888">${v}%</text>`);
      [0, 7, 14, 21, 30].forEach(v => g += `<text x="${X(v)}" y="238" font-size="11" text-anchor="middle" fill="#888">${v}일</text>`);
      g += `<path d="${pts.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join("")}" fill="none" stroke="#6C5CE7" stroke-width="3"/>`;
      reviews.forEach(d => g += `<circle cx="${X(d)}" cy="${Y(1)}" r="5" fill="#00B894"/><text x="${X(d)}" y="22" font-size="10" text-anchor="middle" fill="#00B894">복습</text>`);
      g += `<text x="300" y="255" font-size="11" text-anchor="middle" fill="#888">시간(일)</text>`;
      $(".cv", el).innerHTML = g;
      const end = pts[pts.length - 1][1], avg = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      $(".res", el).innerHTML = `<div class="exp">30일째 기억 유지: <b>${Math.round(end * 100)}%</b> · 한 달 평균 기억량: <b>${Math.round(avg * 100)}%</b> · 복습 ${reviews.length}회<br><span class="small">벼락치기와 간격 복습을 비교해 보세요. 같은 횟수라도 <b>나눠서</b> 할 때 기억이 더 단단해져요.</span></div>`;
    }
    $$("[data-p]", el).forEach(b => b.onclick = () => { reviews = b.dataset.p === "none" ? [] : b.dataset.p === "cram" ? [29, 29.3, 29.6] : [1, 3, 7, 14, 29]; draw(); });
    $(".add", el).onclick = () => { const d = Math.max(1, Math.min(29, +$(".dd", el).value)); if (!reviews.includes(d)) reviews.push(d); reviews.sort((a, b) => a - b); draw(); };
    $(".clr", el).onclick = () => { reviews = []; draw(); };
    draw();
  },
  interleave(el) { scenarioGame(el, "interleave"); el.insertAdjacentHTML("beforeend", `<p class="small muted" style="margin-top:8px">💡 한 유형만 연달아 풀면 ‘어떤 공식을 쓸지’ 고민할 필요가 없어서 실력이 덜 늘어요. 섞여 있을 때 ‘고르는 힘’이 자랍니다.</p>`); },
  why(el) {
    el.innerHTML = `<h3>❓ 정교화 질문 생성기</h3><input class="cp" placeholder="개념을 입력하세요 (예: 광합성, 3·1 운동, 관성)"><div class="out" style="margin-top:12px"></div>`;
    $(".cp", el).oninput = e => {
      const c = e.target.value.trim(); if (!c) { $(".out", el).innerHTML = ""; return; }
      const qs = [`왜 ${c}은(는) 일어날까/필요할까?`, `${c}은(는) 어떤 단계로 작동할까?`, `${c}와(과) 비슷한 개념은? 무엇이 다를까?`, `${c}이(가) 없다면 무슨 일이 생길까?`, `내 생활에서 ${c}의 예를 찾는다면?`, `${c}의 원인과 결과는 무엇일까?`];
      $(".out", el).innerHTML = qs.map((q, i) => `<div style="margin-bottom:10px"><b>Q${i + 1}. ${esc(q)}</b><textarea style="min-height:50px;margin-top:4px" placeholder="책을 보지 말고 먼저 내 생각을 적어 보세요"></textarea></div>`).join("") + `<p class="small muted">답한 뒤에는 교과서로 맞는지 꼭 확인하세요!</p>`;
    };
  },
  example(el) { scenarioGame(el, "example"); },
  draw(el) {
    const prompts = ["광합성 과정", "물의 순환", "삼권 분립", "태양계", "이야기의 줄거리", "분수의 덧셈", "세포의 구조", "수요와 공급"];
    el.innerHTML = `<h3>🖼️ 그려서 기억하기 (이중 부호화)</h3><p class="small muted">주제를 골라 그림·도표로 그려 보세요. 예쁠 필요 없어요! 그린 뒤 그림만 보고 말로 설명해 보세요.</p>
      <div class="row"><select class="pr" style="width:auto">${prompts.map(p => `<option>${p}</option>`).join("")}</select>
      ${["#1E1B3A", "#6C5CE7", "#00B894", "#FF7675", "#FDCB6E", "#0984E3"].map(c => `<button class="btn sm col" data-c="${c}" style="background:${c};width:30px;height:30px;padding:0"></button>`).join("")}
      <button class="btn sm line er">지우개</button><button class="btn sm line cl">모두 지우기</button><button class="btn sm ghost dl">PNG 저장</button></div>
      <canvas class="pad" style="margin-top:10px"></canvas>`;
    const cv = $(".pad", el), x = cv.getContext("2d");
    const fit = () => { const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1; const img = cv.width ? x.getImageData(0, 0, cv.width, cv.height) : null; cv.width = r.width * d; cv.height = r.height * d; x.scale(d, d); x.fillStyle = "#fff"; x.fillRect(0, 0, r.width, r.height); x.lineCap = x.lineJoin = "round"; };
    fit();
    let col = "#1E1B3A", w = 3, drawing = false;
    const pos = e => { const r = cv.getBoundingClientRect(), p = e.touches ? e.touches[0] : e; return [p.clientX - r.left, p.clientY - r.top]; };
    const start = e => { drawing = true; const [a, b] = pos(e); x.beginPath(); x.moveTo(a, b); e.preventDefault(); };
    const move = e => { if (!drawing) return; const [a, b] = pos(e); x.strokeStyle = col; x.lineWidth = w; x.lineTo(a, b); x.stroke(); e.preventDefault(); };
    const end = () => drawing = false;
    cv.addEventListener("mousedown", start); cv.addEventListener("mousemove", move); window.addEventListener("mouseup", end);
    cv.addEventListener("touchstart", start, { passive: false }); cv.addEventListener("touchmove", move, { passive: false }); cv.addEventListener("touchend", end);
    $$(".col", el).forEach(b => b.onclick = () => { col = b.dataset.c; w = 3; });
    $(".er", el).onclick = () => { col = "#fff"; w = 22; };
    $(".cl", el).onclick = () => { const r = cv.getBoundingClientRect(); x.fillStyle = "#fff"; x.fillRect(0, 0, r.width, r.height); };
    $(".dl", el).onclick = () => { cv.toBlob(b => saveFile("dual-coding-" + $(".pr", el).value + ".png", b), "image/png"); xpOnce("draw" + today(), 10, "그림 정리"); };
  },
  feynman(el) {
    el.innerHTML = `<h3>👩‍🏫 파인만 기법 4단계</h3>
      <label class="small"><b>1. 개념 이름</b><input class="f1" placeholder="예: 민주주의"></label>
      <label class="small"><b>2. 열 살 동생에게 설명하듯 쉬운 말로</b> (전문용어 금지!)<textarea class="f2"></textarea></label>
      <label class="small"><b>3. 설명하다 막힌 곳 / 자신 없는 곳</b><textarea class="f3" style="min-height:60px"></textarea></label>
      <label class="small"><b>4. 다시 공부한 뒤, 비유를 넣어 더 단순하게</b><textarea class="f4" style="min-height:60px" placeholder="예: 민주주의는 반 회장을 다 같이 뽑는 것처럼…"></textarea></label>
      <button class="btn mint sv" style="margin-top:8px">저장</button><div class="list" style="margin-top:12px"></div>`;
    const list = () => $(".list", el).innerHTML = S.feynman.length ? `<h4>📒 나의 설명 노트</h4>` + S.feynman.map(f => `<div class="exp"><b>${esc(f.c)}</b> <span class="small muted">${f.d}</span><br>${esc(f.s).slice(0, 200)}</div>`).join("") : "";
    $(".sv", el).onclick = () => { const c = $(".f1", el).value.trim(), s = $(".f2", el).value.trim(); if (!c || !s) { toast("개념과 설명을 적어 주세요"); return; } S.feynman.unshift({ d: today(), c, s, g: $(".f3", el).value, v: $(".f4", el).value }); S.feynman = S.feynman.slice(0, 30); save(); addXP(15, "파인만 기법"); list(); };
    list();
  },
  calib(el) {
    const c = calib();
    el.innerHTML = `<h3>🎯 나의 메타인지 보정 점수</h3>` + (!c || c.n < 3 ? `<p>아직 데이터가 부족해요. 레슨 퀴즈나 보스 퀴즈를 풀 때 <b>확신도</b>를 골라 주세요. 3문제 이상 풀면 점수가 나와요.</p><a class="btn" href="#/quest">퀴즈 풀러 가기</a>` :
      `<div class="grid g4"><div class="stat"><b>${c.score}</b><small>보정 점수</small></div><div class="stat"><b>${c.acc}%</b><small>실제 정답률</small></div><div class="stat"><b>${c.conf}%</b><small>평균 확신도</small></div><div class="stat"><b>${c.n}</b><small>기록된 문제</small></div></div>
      <div class="exp" style="margin-top:12px">${c.conf - c.acc > 10 ? "📢 <b>과신 경향</b>: 아는 것보다 더 안다고 느끼고 있어요. 다시 읽기보다 ‘덮고 떠올리기’로 점검하세요." : c.acc - c.conf > 10 ? "🌱 <b>과소평가 경향</b>: 생각보다 더 잘 알고 있어요! 자신감을 가져도 돼요." : "👍 확신도와 실제 실력이 잘 맞아요. 훌륭한 메타인지!"}
      <br>😎 확신했는데 틀림: <b>${c.over}</b>회 · 🤔 반반이었는데 맞음: <b>${c.under}</b>회</div>
      <p class="small muted">보정 점수는 ‘확신도와 실제 정답 여부가 얼마나 일치하는지’를 100점 만점으로 나타낸 것이에요. 맞을 문제엔 확신하고, 헷갈리는 문제엔 솔직하게 ‘반반’을 고를수록 높아져요.</p>`);
  },
  woop(el) { goalForms(el, true); },
  rank(el) {
    sortGame(el, { title: "공부법 효과 순위 맞히기 (Dunlosky 외, 2013)", buckets: ["높음", "중간", "낮음"], items: [
      ["스스로 시험 보기(인출 연습)", 0], ["간격 두고 나눠 공부하기", 0], ["여러 유형 섞어 풀기(교차)", 1], ["‘왜?’ 묻고 답하기(정교화)", 1],
      ["스스로 설명하기", 1], ["다시 읽기", 2], ["형광펜·밑줄", 2], ["요약하기", 2], ["키워드 암기법", 2]
    ]}, r => xpOnce("rankgame", 10, "효과 순위 게임"));
  }
};

/* ---------------- 도구함 ---------------- */
const TOOLS = [
  { id: "timer", emoji: "🍅", name: "집중 타이머", desc: "25분 집중 + 5분 휴식 (포모도로)" },
  { id: "cards", emoji: "🃏", name: "라이트너 플래시카드", desc: "간격 반복으로 똑똑하게 암기" },
  { id: "exam", emoji: "📅", name: "시험 D-day 복습 계획", desc: "간격 복습 일정 자동 생성" },
  { id: "goal", emoji: "🎯", name: "SMART 목표 · WOOP", desc: "실천되는 목표 만들기" },
  { id: "todo", emoji: "✅", name: "우선순위 할 일 · 거꾸로 계획", desc: "A/B/C 우선순위와 역순 일정" },
  { id: "week", emoji: "🗓️", name: "주간 시간표", desc: "색칠해서 만드는 일주일 계획" },
  { id: "pie", emoji: "🥧", name: "24시간 파이차트", desc: "내 하루는 어디로 갈까?" },
  { id: "cornell", emoji: "📓", name: "코넬 노트", desc: "질문-필기-요약 3단 노트" },
  { id: "mindmap", emoji: "🧠", name: "마인드맵 메이커", desc: "단원 전체를 한 장에" },
  { id: "mnemonic", emoji: "🔤", name: "암기 문장 메이커", desc: "두문자어·아크로스틱 만들기" },
  { id: "essay", emoji: "✍️", name: "과제 질문 해부기", desc: "대상·요구 행동·관점·조건" },
  { id: "breath", emoji: "🌬️", name: "마음 체크 & 호흡", desc: "스트레스 온도계와 호흡 가이드" },
  { id: "journal", emoji: "📔", name: "학습 일지", desc: "계획-점검-평가 성찰 기록" }
];
routes.tools = function () {
  app.innerHTML = `<div class="fade"><div class="page-head"><h1>🛠️ 도구함</h1><p class="muted">배운 것을 바로 실천하는 도구들이에요. 기록은 이 기기의 브라우저에 저장돼요.</p></div>
    <div class="toolgrid">${TOOLS.map(t => `<a class="tool" href="#/tool/${t.id}"><b>${t.emoji}</b><h3>${t.name}</h3><p>${t.desc}</p></a>`).join("")}</div></div>`;
};
routes.tool = function (id) {
  const t = TOOLS.find(x => x.id === id); if (!t) return routes.tools();
  app.innerHTML = `<div class="fade"><div class="page-head"><div class="crumb"><a href="#/tools">도구함</a> › ${t.name}</div><h1>${t.emoji} ${t.name}</h1></div><div id="tl"></div></div>`;
  tools[id]($("#tl"));
};

/* --- 집중 타이머 (페이지 이동해도 계속 동작) --- */
const T = { mode: "focus", f: 25, b: 5, left: 25 * 60, total: 25 * 60, run: false, iv: null, label: "", cyc: 0 };
function timerHud() {
  const m = $("#miniTimer"), onPage = location.hash.indexOf("tool/timer") >= 0;
  if (T.run && !onPage) { m.style.display = "block"; m.textContent = (T.mode === "focus" ? "🍅 " : "☕ ") + Math.floor(T.left / 60) + ":" + pad(T.left % 60); } else m.style.display = "none";
}
function timerTick() {
  T.left--;
  if (T.left <= 0) {
    clearInterval(T.iv); T.run = false; beep("bell");
    if (T.mode === "focus") {
      S.pomo.count++; S.pomo.log.unshift({ d: today(), m: T.f, l: T.label }); S.pomo.log = S.pomo.log.slice(0, 50); save();
      addXP(20, "집중 " + T.f + "분 완료"); mission("pomo"); badge("pomo1"); if (S.pomo.count >= 10) badge("pomo10");
      T.cyc++; T.mode = "break"; T.total = T.left = (T.cyc % 4 === 0 ? T.b * 3 : T.b) * 60;
      toast(T.cyc % 4 === 0 ? "🎉 4세트 완료! 긴 휴식 시간이에요" : "☕ 휴식 시간! 일어나서 몸을 움직여요");
    } else { T.mode = "focus"; T.total = T.left = T.f * 60; toast("🍅 다시 집중할 시간!"); }
  }
  timerHud(); const f = $("#tFace"); if (f) drawTimer();
}
function drawTimer() {
  const el = $("#tFace"); if (!el) return;
  const pct = T.left / T.total, C = 2 * Math.PI * 118;
  el.innerHTML = `<svg viewBox="0 0 260 260"><circle cx="130" cy="130" r="118" stroke="#ECE8FF" stroke-width="16" fill="none"/><circle cx="130" cy="130" r="118" stroke="${T.mode === "focus" ? "#FF7675" : "#00B894"}" stroke-width="16" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg>
    <div><div class="m">${T.mode === "focus" ? "🍅 집중" : "☕ 휴식"} · 세트 ${T.cyc % 4 + 1}/4</div><div class="t">${Math.floor(T.left / 60)}:${pad(T.left % 60)}</div></div>`;
  const b = $("#tStart"); if (b) b.textContent = T.run ? "⏸ 일시정지" : "▶ 시작";
}
const tools = {
  timer(el) {
    el.innerHTML = `<div class="grid g2"><div class="card" style="text-align:center">
      <div class="row" style="justify-content:center">${[[25, 5], [50, 10], [15, 3]].map(p => `<button class="btn sm ghost ps" data-f="${p[0]}" data-b="${p[1]}">${p[0]}/${p[1]}</button>`).join("")}</div>
      <div class="timer-face" id="tFace"></div>
      <input id="tLabel" placeholder="이번 세션에 할 일 (예: 영어 단어 30개)" value="${esc(T.label)}" style="max-width:340px">
      <div class="row" style="justify-content:center;margin-top:12px"><button class="btn" id="tStart">▶ 시작</button><button class="btn line" id="tReset">↺ 리셋</button><button class="btn line" id="tSkip">⏭ 건너뛰기</button></div></div>
      <div class="card"><h3>🍅 포모도로 기법이란?</h3><ol class="steps"><li>할 일 하나를 정한다</li><li>타이머 25분 동안 그것만 한다 (휴대폰은 다른 방!)</li><li>5분 쉰다 — 일어나서 스트레칭·물 마시기</li><li>4세트마다 15~30분 길게 쉰다</li></ol>
      <div class="tip">💡 딴생각이 떠오르면 종이에 메모만 하고 바로 돌아오세요. 끝나고 처리하면 돼요.</div>
      <h4>📈 나의 집중 기록: 총 ${S.pomo.count}회</h4>${S.pomo.log.slice(0, 6).map(x => `<div class="small">✅ ${x.d} · ${x.m}분 ${esc(x.l || "")}</div>`).join("") || '<p class="small muted">아직 기록이 없어요.</p>'}</div></div>`;
    drawTimer();
    $("#tLabel").oninput = e => T.label = e.target.value;
    $("#tStart").onclick = () => { if (T.run) { clearInterval(T.iv); T.run = false; } else { T.run = true; T.iv = setInterval(timerTick, 1000); beep("ok"); } drawTimer(); };
    $("#tReset").onclick = () => { clearInterval(T.iv); T.run = false; T.mode = "focus"; T.total = T.left = T.f * 60; drawTimer(); };
    $("#tSkip").onclick = () => { T.left = 1; if (!T.run) { T.run = true; T.iv = setInterval(timerTick, 1000); } };
    $$(".ps", el).forEach(b => b.onclick = () => { if (T.run) { toast("타이머를 먼저 멈춰 주세요"); return; } T.f = +b.dataset.f; T.b = +b.dataset.b; T.mode = "focus"; T.total = T.left = T.f * 60; drawTimer(); });
  },
  cards(el) {
    if (!S.decks) { S.decks = [{ id: uid(), name: "공부법 핵심 용어 (샘플)", cards: [
      ["인출 연습", "책을 덮고 기억에서 정보를 꺼내는 연습. 가장 효과 높은 공부법 중 하나"], ["간격 반복", "시간 간격을 두고 나눠서 복습하기 (1·3·7·14일)"], ["교차 학습", "여러 유형·단원을 섞어서 연습하기"],
      ["작업기억", "정보를 잠깐 붙잡아 두는 머릿속 메모장. 용량이 작다"], ["청킹", "정보를 의미 있는 덩어리로 묶어 기억하기"], ["메타인지", "내가 무엇을 알고 모르는지 아는 능력"],
      ["유창성 착각", "여러 번 읽어서 익숙해진 것을 ‘안다’고 착각하는 것"], ["SQ3R", "훑어보기-질문-읽기-떠올려 말하기-복습"], ["이중 부호화", "글과 그림을 함께 써서 두 가지 길로 기억하기"],
      ["If-Then 계획", "‘만약 ~하면, ~한다’로 행동을 미리 정해 두기"], ["코넬 노트", "질문(왼쪽)-필기(오른쪽)-요약(아래) 3단 노트"], ["장소법", "익숙한 장소에 외울 것을 배치해 떠올리는 암기법"]
    ].map(([f, b]) => ({ id: uid(), f, b, box: 1, due: today() })) }]; save(); }
    let deck = S.decks[0], queue = [], cur = null, sess = 0;
    const INT = [0, 1, 2, 4, 8, 16];
    function render() {
      const due = deck.cards.filter(c => c.due <= today());
      el.innerHTML = `<div class="grid g2"><div class="card">
        <div class="row"><select class="dk" style="flex:1">${S.decks.map(d => `<option value="${d.id}" ${d.id === deck.id ? "selected" : ""}>${esc(d.name)} (${d.cards.length})</option>`).join("")}</select><button class="btn sm ghost nd">+ 새 덱</button></div>
        <div class="boxes" style="margin-top:12px">${[1, 2, 3, 4, 5].map(b => `<div><b>${deck.cards.filter(c => c.box === b).length}</b>${b}칸<br><span style="font-size:10px">${INT[b]}일마다</span></div>`).join("")}</div>
        <div class="rv" style="margin-top:12px"></div>
        <div class="row" style="margin-top:8px"><button class="btn st" ${due.length ? "" : "disabled"}>▶ 오늘 복습 (${due.length}장)</button><button class="btn line all" ${deck.cards.length ? "" : "disabled"}>전체 연습</button></div>
        <p class="small muted">맞히면 다음 칸(덜 자주), 틀리면 1칸(자주)으로 이동해요. 오늘 복습: ${S.cToday.d === today() ? S.cToday.n : 0}장 · 누적 ${S.cardReviews}장</p></div>
        <div class="card"><h3>➕ 카드 추가</h3><input class="cf" placeholder="앞면 (질문/단어)"><textarea class="cb" placeholder="뒷면 (답/뜻)" style="min-height:60px;margin-top:6px"></textarea><button class="btn sm ad" style="margin-top:6px">추가</button>
        <details style="margin-top:12px"><summary class="small"><b>📋 여러 장 한 번에 붙여넣기</b></summary><p class="small muted">한 줄에 한 장, <code>앞면 | 뒷면</code> 형식 (탭 구분도 OK)</p><textarea class="bulk" placeholder="apple | 사과&#10;광합성 | 빛에너지로 양분을 만드는 과정"></textarea><button class="btn sm bk">가져오기</button></details>
        <details style="margin-top:8px"><summary class="small"><b>🗂️ 카드 목록 / 덱 관리</b></summary>${deck.cards.map(c => `<div class="todo-item"><span class="small"><b>${esc(c.f)}</b> — ${esc(c.b)} <span class="chip">${c.box}칸</span></span><button class="x" data-del="${c.id}">×</button></div>`).join("")}<button class="btn sm coral dd" style="margin-top:6px">이 덱 삭제</button></details></div></div>`;
      $(".dk", el).onchange = e => { deck = S.decks.find(d => d.id === e.target.value); render(); };
      $(".nd", el).onclick = () => { const n = prompt("새 덱 이름", "영어 단어"); if (n) { const d = { id: uid(), name: n.slice(0, 30), cards: [] }; S.decks.push(d); deck = d; save(); render(); } };
      $(".ad", el).onclick = () => { const f = $(".cf", el).value.trim(), b = $(".cb", el).value.trim(); if (!f || !b) return toast("앞면과 뒷면을 모두 적어 주세요"); deck.cards.push({ id: uid(), f, b, box: 1, due: today() }); save(); render(); toast("카드 추가!"); };
      $(".bk", el).onclick = () => { let n = 0; $(".bulk", el).value.split("\n").forEach(line => { const p = line.split(/\s*\|\s*|\t/); if (p.length >= 2 && p[0].trim() && p[1].trim()) { deck.cards.push({ id: uid(), f: p[0].trim(), b: p.slice(1).join(" ").trim(), box: 1, due: today() }); n++; } }); save(); render(); toast(n + "장 가져왔어요"); };
      $$("[data-del]", el).forEach(b => b.onclick = () => { deck.cards = deck.cards.filter(c => c.id !== b.dataset.del); save(); render(); });
      $(".dd", el).onclick = () => { if (S.decks.length < 2) return toast("마지막 덱은 삭제할 수 없어요"); if (confirm("이 덱을 삭제할까요?")) { S.decks = S.decks.filter(d => d !== deck); deck = S.decks[0]; save(); render(); } };
      $(".st", el).onclick = () => { queue = shuffle(due); sess = 0; next(); };
      $(".all", el).onclick = () => { queue = shuffle(deck.cards); sess = 0; next(true); };
    }
    let practice = false;
    function next(p) {
      if (p !== undefined) practice = p;
      const rv = $(".rv", el); cur = queue.shift();
      if (!cur) { rv.innerHTML = `<div class="exp">🎉 복습 완료! ${sess}장을 떠올렸어요.</div>`; setTimeout(render, 1600); return; }
      rv.innerHTML = `<div class="small muted">남은 카드 ${queue.length + 1}장 · 먼저 답을 소리 내어 말해 본 뒤 카드를 뒤집으세요</div>
        <div class="flash"><div class="flash-in"><div class="flash-f">${esc(cur.f)}</div><div class="flash-b">${esc(cur.b)}</div></div></div>
        <div class="row ab"><button class="btn fl">🔄 뒤집기</button></div>`;
      const fl = $(".flash", rv); const flip = () => { fl.classList.add("flip"); $(".ab", rv).innerHTML = `<button class="btn coral no">😵 몰랐어</button><button class="btn mint yes">😎 알았어</button>`; $(".no", rv).onclick = () => grade(false); $(".yes", rv).onclick = () => grade(true); };
      fl.onclick = flip; $(".fl", rv).onclick = flip;
    }
    function grade(ok) {
      sess++; S.cardReviews++; if (S.cToday.d !== today()) S.cToday = { d: today(), n: 0 }; S.cToday.n++;
      if (!practice) { if (ok) { cur.box = Math.min(5, cur.box + 1); cur.due = addDays(today(), INT[cur.box]); } else { cur.box = 1; cur.due = today(); queue.push(cur); } }
      save(); ok ? beep("ok") : beep("bad");
      if (S.cToday.n === 10) mission("cards");
      if (S.cardReviews >= 50) badge("cards50");
      if (sess % 5 === 0) addXP(10, "카드 5장 복습");
      next();
    }
    render();
  },
  exam(el) {
    const P = S.examPlan || { name: "", date: addDays(today(), 14), units: "" };
    el.innerHTML = `<div class="grid g2"><div class="card noprint"><h3>시험 정보</h3>
      <label class="small">시험 이름<input class="nm" value="${esc(P.name)}" placeholder="예: 2학기 기말고사 과학"></label>
      <label class="small">시험 날짜<input class="dt" type="date" value="${P.date}"></label>
      <label class="small">단원 / 범위 (한 줄에 하나)<textarea class="un" placeholder="1. 물질의 구성&#10;2. 전기와 자기&#10;3. 태양계">${esc(P.units)}</textarea></label>
      <button class="btn mk" style="margin-top:8px">📅 간격 복습 계획 만들기</button></div>
      <div class="card"><h3>📌 이 계획의 원리</h3><p class="small">각 단원을 <b>처음 공부</b>한 뒤 <b>1일 · 3일 · 7일 · 14일</b> 뒤에 다시 <b>떠올려 보는 복습</b>을 배치해요. 시험 전날은 전체를 가볍게 인출하고 <b>일찍 자는 날</b>!</p><p class="small muted">복습은 다시 읽기가 아니라 백지 쓰기·카드·기출 문제로 하세요.</p></div></div>
      <div class="card" style="margin-top:16px" id="plan"></div>`;
    function make(save_) {
      const name = $(".nm", el).value.trim(), date = $(".dt", el).value, units = $(".un", el).value.split("\n").map(s => s.trim()).filter(Boolean);
      const D = diffDays(today(), date);
      if (save_) { S.examPlan = { name, date, units: units.join("\n") }; save(); }
      if (!units.length) { $("#plan").innerHTML = `<p class="muted">단원을 입력하고 계획을 만들어 보세요.</p>`; return; }
      if (D < 2) { $("#plan").innerHTML = `<p>시험까지 2일 이상 남아야 계획을 만들 수 있어요. 지금은 <b>요약 카드로 인출 연습 + 충분한 수면</b>에 집중하세요!</p>`; return; }
      const days = {}; const put = (d, html) => { (days[d] = days[d] || []).push(html); };
      const learnSpan = Math.max(1, Math.floor((D - 1) * 0.55));
      units.forEach((u, i) => {
        const first = Math.min(D - 2, Math.floor(i * learnSpan / units.length));
        put(first, `<span class="chip">📘 처음 공부: ${esc(u)}</span>`);
        [1, 3, 7, 14].forEach(g => { const r = first + g; if (r <= D - 2) put(r, `<span class="chip r">🔁 떠올리기 복습: ${esc(u)}</span>`); });
      });
      put(D - 1, `<span class="chip t">🌙 전 범위 가볍게 인출 + 준비물 확인 + 일찍 자기</span>`);
      let rows = ""; for (let d = 0; d < D; d++) if (days[d]) rows += `<tr><td style="white-space:nowrap"><b>${fmtDate(addDays(today(), d))}</b><br><span class="small muted">D-${D - d}</span></td><td>${days[d].join(" ")}</td><td style="width:30px"><input type="checkbox" style="width:auto"></td></tr>`;
      $("#plan").innerHTML = `<div class="row" style="justify-content:space-between"><h3 style="margin:0">📅 ${esc(name || "시험")} 복습 계획 · ${fmtDate(date)} (D-${D})</h3><button class="btn sm line noprint" onclick="window.print()">🖨️ 인쇄</button></div><table class="plan" style="margin-top:10px"><tr><th>날짜</th><th>할 일</th><th>✔</th></tr>${rows}</table>`;
      if (save_) { badge("planner"); xpOnce("exam" + date + units.length, 15, "복습 계획 생성"); }
    }
    $(".mk", el).onclick = () => make(true);
    if (S.examPlan) make(false); else $("#plan").innerHTML = `<p class="muted">시험 정보를 입력하면 날짜별 복습 계획이 만들어져요.</p>`;
  },
  goal(el) { goalForms(el, false); },
  todo(el) {
    function render() {
      const list = S.todos.slice().sort((a, b) => (a.done - b.done) || a.p.localeCompare(b.p) || (a.due || "9").localeCompare(b.due || "9"));
      el.innerHTML = `<div class="grid g2"><div class="card"><h3>✅ 우선순위 할 일</h3>
        <div class="row"><select class="pp" style="width:auto"><option value="A">A 꼭</option><option value="B">B 하면 좋음</option><option value="C">C 여유</option></select><input class="tx" placeholder="할 일" style="flex:1;min-width:140px"><input class="du" type="date" style="width:auto"><button class="btn sm ad">추가</button></div>
        <div style="margin-top:12px">${list.map(t => `<div class="todo-item ${t.done ? "done" : ""}"><input type="checkbox" data-t="${t.id}" ${t.done ? "checked" : ""} style="width:auto"><span class="prio ${t.p}">${t.p}</span><span>${esc(t.t)} ${t.due ? `<span class="chip">${fmtDate(t.due)}</span>` : ""}</span><button class="x" data-del="${t.id}">×</button></div>`).join("") || '<p class="small muted">할 일을 추가해 보세요. 가장 중요한 A부터!</p>'}</div>
        ${S.todos.some(t => t.done) ? `<button class="btn sm line cl">완료 항목 정리</button>` : ""}</div>
        <div class="card"><h3>⏪ 거꾸로 계획 (역순 일정)</h3><p class="small muted">마감일에서 거꾸로 단계별 날짜를 계산해요. 한 줄에 <code>단계 이름, 걸리는 날 수</code></p>
        <div class="grid g2"><label class="small">마감일<input class="bd" type="date" value="${addDays(today(), 14)}"></label><label class="small">여유(버퍼) 일수<input class="bf" type="number" value="2"></label></div>
        <textarea class="bs" style="margin-top:6px">주제 정하고 질문 분해, 1&#10;자료 찾기, 3&#10;개요 짜기, 1&#10;초안 쓰기, 3&#10;고쳐 쓰기·출처 정리, 2</textarea>
        <button class="btn sm bc" style="margin-top:6px">계산하기</button><div class="bo" style="margin-top:10px"></div></div></div>`;
      $(".ad", el).onclick = () => { const t = $(".tx", el).value.trim(); if (!t) return; S.todos.push({ id: uid(), t, p: $(".pp", el).value, due: $(".du", el).value, done: 0 }); save(); render(); };
      $(".tx", el).onkeydown = e => { if (e.key === "Enter") $(".ad", el).click(); };
      $$("[data-t]", el).forEach(c => c.onchange = () => { const t = S.todos.find(x => x.id === c.dataset.t); t.done = c.checked ? 1 : 0; if (t.done && !t.xp) { t.xp = 1; addXP(t.p === "A" ? 5 : 3, "할 일 완료"); } save(); render(); });
      $$("[data-del]", el).forEach(b => b.onclick = () => { S.todos = S.todos.filter(x => x.id !== b.dataset.del); save(); render(); });
      const cl = $(".cl", el); if (cl) cl.onclick = () => { S.todos = S.todos.filter(x => !x.done); save(); render(); };
      $(".bc", el).onclick = () => {
        const dl = $(".bd", el).value, buf = +$(".bf", el).value || 0;
        const steps = $(".bs", el).value.split("\n").map(l => { const m = l.split(/,\s*/); return { n: m[0].trim(), d: Math.max(1, +m[1] || 1) }; }).filter(s => s.n);
        let end = addDays(dl, -buf); const out = [];
        for (let i = steps.length - 1; i >= 0; i--) { const st = addDays(end, -steps[i].d + 1); out.unshift({ ...steps[i], s: st, e: end }); end = addDays(st, -1); }
        const late = out.length && out[0].s < today();
        $(".bo", el).innerHTML = `<table class="plan"><tr><th>단계</th><th>시작</th><th>끝</th></tr>${out.map(o => `<tr><td>${esc(o.n)}</td><td>${fmtDate(o.s)}</td><td>${fmtDate(o.e)}</td></tr>`).join("")}<tr><td>🛟 버퍼</td><td colspan="2">${buf}일 → 마감 ${fmtDate(dl)}</td></tr></table>
          ${late ? `<p class="small" style="color:#B33">⚠️ 첫 단계 시작일이 이미 지났어요! 단계 일수를 줄이거나 오늘 바로 시작하세요.</p>` : ""}<button class="btn sm ghost tt">할 일 목록에 추가</button>`;
        $(".tt", el).onclick = () => { out.forEach(o => S.todos.push({ id: uid(), t: o.n, p: "A", due: o.e, done: 0 })); save(); render(); toast("할 일에 추가했어요"); };
      };
    }
    render();
  },
  week(el) {
    const CAT = [["study", "공부", "#6C5CE7"], ["class", "수업·학교", "#0984E3"], ["ex", "운동", "#00B894"], ["rest", "휴식·여가", "#FDCB6E"], ["meal", "식사", "#E17055"], ["sleep", "수면", "#636E72"], ["etc", "기타", "#B2BEC3"], ["", "지우개", "#ddd"]];
    let brush = "study", down = false;
    const days = ["월", "화", "수", "목", "금", "토", "일"], hours = Array.from({ length: 18 }, (_, i) => i + 6);
    function render() {
      const cnt = {}; Object.values(S.week).forEach(v => cnt[v] = (cnt[v] || 0) + 1);
      el.innerHTML = `<div class="card"><div class="row noprint" style="justify-content:space-between"><div class="brush">${CAT.map(c => `<button data-b="${c[0]}" class="${brush === c[0] ? "on" : ""}" style="background:${c[2]};${c[0] ? "" : "color:#333"}">${c[1]}</button>`).join("")}</div><div class="row"><button class="btn sm line pr" onclick="window.print()">🖨️ 인쇄</button><button class="btn sm line rs">초기화</button></div></div>
        <p class="small muted noprint">붓을 고르고 칸을 클릭하거나 드래그해서 색칠하세요. 수업·수면·식사를 먼저 칠하고, 남은 칸에 공부와 휴식을 배치해 보세요.</p>
        <div class="week"><table><tr><th></th>${days.map(d => `<th>${d}</th>`).join("")}</tr>${hours.map(h => `<tr><td class="h">${h}:00</td>${days.map((d, i) => { const k = i + "-" + h, v = S.week[k], c = CAT.find(x => x[0] === v); return `<td data-k="${k}" style="background:${c ? c[2] : "#fff"};color:#fff">${c ? c[1].slice(0, 2) : ""}</td>`; }).join("")}</tr>`).join("")}</table></div>
        <div class="row" style="margin-top:10px">${CAT.filter(c => c[0]).map(c => `<span class="chip" style="background:${c[2]}22;color:#333">${c[1]} ${cnt[c[0]] || 0}시간</span>`).join("")}</div>
        ${(cnt.study || 0) > 0 && !(cnt.rest || cnt.ex) ? `<div class="tip">⚖️ 공부만 있고 휴식·운동이 없어요! 균형 잡힌 계획이 더 오래가요.</div>` : ""}</div>`;
      $$("[data-b]", el).forEach(b => b.onclick = () => { brush = b.dataset.b; render(); });
      const paint = td => { if (!td || !td.dataset.k) return; if (brush) S.week[td.dataset.k] = brush; else delete S.week[td.dataset.k]; const c = CAT.find(x => x[0] === brush); td.style.background = brush ? c[2] : "#fff"; td.textContent = brush ? c[1].slice(0, 2) : ""; };
      $$("td[data-k]", el).forEach(td => { td.onmousedown = e => { down = true; paint(td); e.preventDefault(); }; td.onmouseenter = () => { if (down) paint(td); }; td.ontouchstart = () => paint(td); });
      document.onmouseup = () => { if (down) { down = false; save(); render(); xpOnce("week" + today(), 10, "시간표 작성"); } };
      $(".rs", el).onclick = () => { if (confirm("시간표를 모두 지울까요?")) { S.week = {}; save(); render(); } };
    }
    render();
  },
  pie(el) {
    const CAT = [["수면", "#636E72", 8, 9], ["학교·수업", "#0984E3", 7, 7], ["공부", "#6C5CE7", 2, 3], ["식사", "#E17055", 1.5, 1.5], ["이동", "#B2BEC3", 1, 1], ["운동", "#00B894", 0.5, 1], ["휴대폰·영상", "#FD79A8", 3, 1], ["기타·휴식", "#FDCB6E", 1, 0.5]];
    const P = S.pie || { now: CAT.map(c => c[2]), goal: CAT.map(c => c[3]) };
    function svg(vals) {
      const tot = vals.reduce((a, b) => a + b, 0) || 1; let a0 = -Math.PI / 2, out = "";
      vals.forEach((v, i) => { if (!v) return; const a1 = a0 + v / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0; const p = (a) => [100 + 90 * Math.cos(a), 100 + 90 * Math.sin(a)]; const [x0, y0] = p(a0), [x1, y1] = p(a1);
        out += vals.filter(x => x).length === 1 ? `<circle cx="100" cy="100" r="90" fill="${CAT[i][1]}"/>` : `<path d="M100,100 L${x0},${y0} A90,90 0 ${big} 1 ${x1},${y1} Z" fill="${CAT[i][1]}"/>`;
        const m = p((a0 + a1) / 2); if (v / tot > .06) out += `<text x="${(100 + (m[0] - 100) * .62).toFixed(1)}" y="${(100 + (m[1] - 100) * .62).toFixed(1)}" font-size="10" fill="#fff" text-anchor="middle" font-weight="700">${v}h</text>`; a0 = a1; });
      return `<svg viewBox="0 0 200 200" style="width:100%;max-width:240px;display:block;margin:0 auto">${out}</svg>`;
    }
    function render() {
      const sn = P.now.reduce((a, b) => a + (+b || 0), 0), sg = P.goal.reduce((a, b) => a + (+b || 0), 0);
      el.innerHTML = `<div class="grid g2"><div class="card"><h3>⏱️ 하루 24시간 기록</h3><p class="small muted">평소 하루(현재)와 바꾸고 싶은 하루(목표)를 시간 단위로 적어 보세요.</p>
        <table class="plan"><tr><th>활동</th><th>현재</th><th>목표</th></tr>${CAT.map((c, i) => `<tr><td><span class="chip" style="background:${c[1]};color:#fff">${c[0]}</span></td><td><input type="number" step="0.5" min="0" data-a="now" data-i="${i}" value="${P.now[i]}" style="width:80px;padding:6px"></td><td><input type="number" step="0.5" min="0" data-a="goal" data-i="${i}" value="${P.goal[i]}" style="width:80px;padding:6px"></td></tr>`).join("")}
        <tr><td><b>합계</b></td><td style="color:${sn === 24 ? "#00805f" : "#B33"}"><b>${sn}h</b></td><td style="color:${sg === 24 ? "#00805f" : "#B33"}"><b>${sg}h</b></td></tr></table></div>
        <div class="card"><div class="grid g2"><div><h4 style="text-align:center">현재</h4>${svg(P.now.map(Number))}</div><div><h4 style="text-align:center">목표</h4>${svg(P.goal.map(Number))}</div></div>
        <div class="tip">💡 가장 많이 바꾸고 싶은 한 칸을 고르세요. 작은 변화(하루 30분)부터 시작해 2주간 지켜 보세요. ${sn !== 24 ? "<br>⚠️ 현재 합계가 24시간이 되도록 맞춰 보세요." : ""}</div></div></div>`;
      $$("input[data-a]", el).forEach(i => i.onchange = () => { P[i.dataset.a][+i.dataset.i] = Math.max(0, +i.value || 0); S.pie = P; save(); render(); xpOnce("pie", 10, "시간 분석"); });
    }
    render();
  },
  cornell(el) {
    let cur = { id: uid(), t: "", d: today(), c: "", n: "", s: "" }, test = false;
    function render() {
      el.innerHTML = `<div class="card"><div class="row noprint" style="justify-content:space-between"><div class="row"><button class="btn sm ghost nw">+ 새 노트</button><select class="ld" style="width:auto"><option value="">저장된 노트 (${S.cornell.length})</option>${S.cornell.map(n => `<option value="${n.id}">${esc(n.t || "제목 없음")} · ${n.d}</option>`).join("")}</select></div>
        <div class="row"><button class="btn sm ${test ? "coral" : "line"} ts">${test ? "👀 필기 보이기" : "🙈 자가 시험 모드"}</button><button class="btn sm line" onclick="window.print()">🖨️</button><button class="btn sm mint sv">💾 저장</button></div></div>
        <div class="grid g2" style="margin:10px 0"><input class="t" placeholder="제목 / 단원" value="${esc(cur.t)}"><input class="d" type="date" value="${cur.d}"></div>
        <div class="cornell"><div class="cue"><label>❓ 질문 · 핵심어 (수업 후 작성)</label><textarea class="c" placeholder="이 필기에서 나올 질문은?&#10;예) 광합성에 필요한 3가지는?">${esc(cur.c)}</textarea></div>
        <div><label>📝 필기 (수업 중)</label><textarea class="n" placeholder="핵심어 위주로, 내 말로!" style="${test ? "filter:blur(6px)" : ""}">${esc(cur.n)}</textarea></div>
        <div class="sum"><label>📌 요약 (2~3문장, 책 덮고)</label><textarea class="s">${esc(cur.s)}</textarea></div></div>
        <p class="small muted noprint">🙈 자가 시험 모드: 필기를 가리고 왼쪽 질문만 보며 답을 떠올려 보세요. 이게 진짜 복습!</p></div>`;
      const sync = () => { cur.t = $(".t", el).value; cur.d = $(".d", el).value; cur.c = $(".c", el).value; cur.n = $(".n", el).value; cur.s = $(".s", el).value; };
      $(".sv", el).onclick = () => { sync(); if (!cur.n.trim() && !cur.c.trim()) return toast("내용을 적어 주세요"); const i = S.cornell.findIndex(x => x.id === cur.id); if (i >= 0) S.cornell[i] = { ...cur }; else S.cornell.unshift({ ...cur }); save(); xpOnce("cornell" + cur.id, 15, "코넬 노트"); render(); toast("저장했어요"); };
      $(".nw", el).onclick = () => { cur = { id: uid(), t: "", d: today(), c: "", n: "", s: "" }; render(); };
      $(".ld", el).onchange = e => { const n = S.cornell.find(x => x.id === e.target.value); if (n) { cur = { ...n }; render(); } };
      $(".ts", el).onclick = () => { sync(); test = !test; render(); };
    }
    render();
  },
  mindmap(el) {
    const M = S.mindmap || { c: "광합성", b: [{ t: "재료", k: "물, 이산화탄소, 빛" }, { t: "장소", k: "엽록체, 잎" }, { t: "결과물", k: "포도당, 산소" }, { t: "영향 요인", k: "빛의 세기, 온도, CO₂ 농도" }] };
    const COL = ["#6C5CE7", "#00B894", "#FF7675", "#0984E3", "#FDCB6E", "#E17055", "#FD79A8", "#00CEC9"];
    function svg() {
      const W = 900, H = 560, cx = W / 2, cy = H / 2, n = M.b.length || 1; let g = "";
      M.b.forEach((b, i) => {
        const a = -Math.PI / 2 + i / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), bx = cx + ca * 210, by = cy + sa * 150, col = COL[i % COL.length];
        g += `<path d="M${cx},${cy} Q${(cx + bx) / 2 + sa * 24},${(cy + by) / 2 - ca * 24} ${bx},${by}" stroke="${col}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
        const kids = b.k.split(/[,，]/).map(s => s.trim()).filter(Boolean);
        const sp = 30 + 70 * Math.abs(sa), px = -sa, py = ca;
        kids.forEach((k, j) => { const off = (j - (kids.length - 1) / 2) * sp, kx = bx + ca * 120 + px * off, ky = by + sa * 78 + py * off;
          g += `<line x1="${bx}" y1="${by}" x2="${kx}" y2="${ky}" stroke="${col}" stroke-width="2.5" opacity=".55"/><text x="${kx}" y="${ky + 5}" font-size="15" text-anchor="middle" fill="#1E1B3A" stroke="#fff" stroke-width="5" paint-order="stroke" font-weight="600">${esc(k)}</text>`; });
        g += `<rect x="${bx - 62}" y="${by - 19}" width="124" height="38" rx="19" fill="${col}"/><text x="${bx}" y="${by + 6}" font-size="16" font-weight="800" text-anchor="middle" fill="#fff">${esc(b.t)}</text>`;
      });
      g += `<circle cx="${cx}" cy="${cy}" r="64" fill="#1E1B3A"/><text x="${cx}" y="${cy + 7}" font-size="19" font-weight="800" text-anchor="middle" fill="#fff">${esc(M.c)}</text>`;
      return `<svg class="mm" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;background:#FCFBFF;border-radius:14px;font-family:Pretendard,sans-serif">${g}</svg>`;
    }
    function render() {
      el.innerHTML = `<div class="grid"><div class="card noprint"><label class="small"><b>가운데 주제</b><input class="cc" value="${esc(M.c)}"></label>
        <h4 style="margin:12px 0 6px">가지 (세부 내용은 쉼표로)</h4>${M.b.map((b, i) => `<div class="row" style="margin-bottom:6px"><input data-t="${i}" value="${esc(b.t)}" style="width:110px;flex:none"><input data-k="${i}" value="${esc(b.k)}" style="flex:1"><button class="x" data-del="${i}">×</button></div>`).join("")}
        <div class="row"><button class="btn sm ghost ab" ${M.b.length >= 8 ? "disabled" : ""}>+ 가지 추가</button><button class="btn sm mint sv">💾 저장</button><button class="btn sm line dl">⬇️ SVG</button><button class="btn sm line" onclick="window.print()">🖨️</button></div>
        <div class="tip small">💡 완성한 뒤 <b>안 보고 다시 그려 보기</b>! 빈 가지가 복습할 곳이에요.</div></div>
        <div class="card">${svg()}</div></div>`;
      $(".cc", el).oninput = e => { M.c = e.target.value; $(".mm", el).outerHTML = svg(); };
      $$("[data-t]", el).forEach(i => i.oninput = () => { M.b[+i.dataset.t].t = i.value; $(".mm", el).outerHTML = svg(); });
      $$("[data-k]", el).forEach(i => i.oninput = () => { M.b[+i.dataset.k].k = i.value; $(".mm", el).outerHTML = svg(); });
      $$("[data-del]", el).forEach(b => b.onclick = () => { M.b.splice(+b.dataset.del, 1); render(); });
      $(".ab", el).onclick = () => { M.b.push({ t: "새 가지", k: "" }); render(); };
      $(".sv", el).onclick = () => { S.mindmap = M; save(); xpOnce("mm" + today(), 15, "마인드맵"); toast("저장했어요"); };
      $(".dl", el).onclick = () => saveFile("mindmap-" + M.c + ".svg", new Blob([$(".mm", el).outerHTML], { type: "image/svg+xml" }));
    }
    render();
  },
  mnemonic(el) {
    function render() {
      el.innerHTML = `<div class="grid g2"><div class="card"><h3>🔤 외울 목록 입력</h3><p class="small muted">한 줄에 하나씩. 첫 글자를 뽑아 줄게요.</p>
        <textarea class="it" placeholder="수성&#10;금성&#10;지구&#10;화성&#10;목성&#10;토성&#10;천왕성&#10;해왕성"></textarea>
        <div class="out" style="margin:10px 0"></div>
        <label class="small"><b>나만의 암기 문장 (아크로스틱)</b><input class="sn" placeholder="예: 수금지화목토천해 → ‘수박 금방 지나 화나서 목욕하고 토끼랑 천천히 해 보자’"></label>
        <button class="btn sm mint sv" style="margin-top:8px">💾 저장</button></div>
        <div class="card"><h3>📚 나의 암기법 모음</h3>${S.mnemonics.map((m, i) => `<div class="exp"><b>${esc(m.a)}</b> — ${esc(m.s)}<button class="x" data-del="${i}" style="float:right">×</button><br><span class="small muted">${esc(m.l)}</span></div>`).join("") || '<p class="small muted">아직 없어요.</p>'}
        <div class="tip small">🎵 더 강력하게: 문장을 리듬에 맞춰 노래로 부르거나, 엉뚱한 그림으로 그려 보세요. 그리고 정말 아는지 <b>암기법 없이 떠올려 보기</b>도 꼭!</div></div></div>`;
      const it = $(".it", el);
      it.oninput = () => { const L = it.value.split("\n").map(s => s.trim()).filter(Boolean); $(".out", el).innerHTML = L.length ? `<div style="font-size:28px;font-weight:900;letter-spacing:4px;color:var(--p)">${L.map(s => esc(s[0])).join("")}</div>` : ""; };
      $(".sv", el).onclick = () => { const L = it.value.split("\n").map(s => s.trim()).filter(Boolean); if (!L.length) return toast("목록을 입력해 주세요"); S.mnemonics.unshift({ a: L.map(s => s[0]).join(""), s: $(".sn", el).value, l: L.join(", ") }); save(); xpOnce("mn" + S.mnemonics.length, 10, "암기법 제작"); render(); };
      $$("[data-del]", el).forEach(b => b.onclick = () => { S.mnemonics.splice(+b.dataset.del, 1); save(); render(); });
    }
    render();
  },
  essay(el) {
    const V = [["비교", "공통점과 차이점을 함께"], ["대조", "차이점 중심으로"], ["분석", "요소로 나누어 관계·원인 살피기"], ["평가", "근거로 장단점을 따져 판단 내리기"], ["논하", "여러 관점을 검토하고 결론 제시"], ["논의", "여러 관점을 검토하고 결론 제시"], ["설명", "어떻게·왜를 이해하기 쉽게"], ["서술", "특징·과정을 자세히 보여 주기"], ["기술", "특징·과정을 자세히 보여 주기"], ["요약", "핵심만 간결하게"], ["정의", "정확한 뜻 밝히기"], ["비판", "강점과 약점을 근거로 판단"], ["예를 들", "구체적 사례로 보여 주기"], ["compare", "공통점과 차이점"], ["contrast", "차이점 중심"], ["analy", "요소로 나누어 관계 살피기"], ["evaluate", "근거로 판단 내리기"], ["assess", "가치·중요성 판단"], ["discuss", "여러 관점 + 결론"], ["explain", "어떻게·왜"], ["describe", "특징 보여 주기"], ["to what extent", "얼마나 그런지 정도를 판단"], ["justify", "근거를 들어 정당화"], ["outline", "핵심만 개괄"]];
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>1️⃣ 질문 붙여넣기</h3><textarea class="qq" placeholder="예: 20세기 한국의 산업화가 도시 생활에 미친 영향을 평가하시오."></textarea><div class="vv" style="margin-top:8px"></div>
      <h3 style="margin-top:12px">2️⃣ 네 개의 렌즈로 읽기</h3>
      <label class="small">🎯 대상 (무엇에 대해?)<input class="a1" placeholder="산업화"></label><label class="small">⚙️ 요구 행동 (무엇을 하라고?)<input class="a2" placeholder="평가하시오"></label>
      <label class="small">🔦 관점 (어떤 측면을?)<input class="a3" placeholder="도시 생활에 미친 영향"></label><label class="small">📏 조건 (시기·장소·분량 등)<input class="a4" placeholder="20세기 한국"></label>
      <button class="btn sm mk" style="margin-top:8px">개요 틀 만들기</button></div>
      <div class="card"><h3>3️⃣ 개요 틀 (PEEL)</h3><div class="ol"><p class="small muted">왼쪽을 채우면 개요 틀이 만들어져요.</p></div></div></div>`;
    $(".qq", el).oninput = e => { const q = e.target.value.toLowerCase(); const f = V.filter(v => q.includes(v[0].toLowerCase())); $(".vv", el).innerHTML = f.length ? f.map(v => `<span class="chip t">요구 행동 ‘${v[0]}’ → ${v[1]}</span>`).join("") : (q ? '<span class="small muted">요구 행동(핵심 동사)을 찾지 못했어요. 직접 찾아 적어 보세요.</span>' : ""); };
    $(".mk", el).onclick = () => {
      const [a1, a2, a3, a4] = [1, 2, 3, 4].map(i => esc($(".a" + i, el).value || "…"));
      $(".ol", el).innerHTML = `<div class="exp"><b>📍 서론</b>: ${a4} ${a1}의 배경 한두 문장 → ‘${a3}’을(를) ‘${a2}’하겠다는 방향(논지) 밝히기</div>
        ${[1, 2, 3].map(i => `<div class="exp"><b>📍 본론 ${i}</b>: <b>P</b>(주장 한 문장) → <b>E</b>(근거·자료·예시) → <b>E</b>(그 근거가 왜 주장을 뒷받침하는지 설명) → <b>L</b>(질문과 연결)</div>`).join("")}
        <div class="exp"><b>📍 결론</b>: 새 내용 없이, ${a3}에 대한 <b>최종 판단</b>을 분명히 + 핵심 근거 요약</div>
        <div class="tip small">✅ 제출 전 체크: 요구 행동에 맞게 답했나? 조건을 벗어나지 않았나? 단락마다 한 주장? 출처 표기?</div>`;
      xpOnce("essay" + today(), 10, "질문 분해");
    };
  },
  breath(el) {
    let run = false, raf = null;
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>🌡️ 지금 내 스트레스 온도</h3><input type="range" min="1" max="10" value="4" class="slider sl"><div class="row" style="justify-content:space-between" ><span class="small">😌 1</span><b class="sv" style="font-size:28px">4</b><span class="small">10 😫</span></div><div class="adv exp"></div>
      <h3 style="margin-top:16px">📝 걱정 쏟아내기</h3><p class="small muted">시험 전 10분, 걱정을 모두 적어 보세요. 머릿속 공간이 생겨요. (저장되지 않아요)</p><textarea placeholder="지금 걱정되는 것을 전부 써 보세요…"></textarea></div>
      <div class="card" style="text-align:center"><h3>🌬️ 호흡 가이드</h3><select class="pt" style="width:auto"><option value="4,0,6,0">진정 호흡 (4초 들숨 · 6초 날숨)</option><option value="4,7,8,0">4-7-8 호흡</option><option value="4,4,4,4">상자 호흡 (4-4-4-4)</option></select>
      <div class="breath-ball bb">준비</div><div class="small muted cnt">1분 동안 따라 해 보세요</div><div class="row" style="justify-content:center;margin-top:10px"><button class="btn mint go">▶ 시작</button></div></div></div>`;
    const adv = v => v <= 3 ? "😌 평온해요! 지금 페이스를 유지하세요." : v <= 6 ? "🙂 약간 긴장 상태. 짧은 산책, 호흡, 친구와 대화로 미리 낮춰 두세요." : "😣 많이 힘든 상태예요. 할 일을 줄이고, 믿을 만한 어른(부모님·선생님·상담 선생님)에게 꼭 이야기하세요. 청소년상담 1388도 있어요.";
    const sl = $(".sl", el); const up = () => { $(".sv", el).textContent = sl.value; $(".adv", el).innerHTML = adv(+sl.value); }; sl.oninput = up; up();
    $(".go", el).onclick = () => {
      if (run) { run = false; cancelAnimationFrame(raf); $(".go", el).textContent = "▶ 시작"; $(".bb", el).textContent = "준비"; return; }
      run = true; $(".go", el).textContent = "⏹ 멈추기";
      const [i, h, o, h2] = $(".pt", el).value.split(",").map(Number), cyc = i + h + o + h2, t0 = performance.now(), ball = $(".bb", el);
      (function loop(now) {
        if (!run) return;
        const t = (now - t0) / 1000, c = t % cyc; let s, lab;
        if (c < i) { s = .6 + .4 * (c / i); lab = "들이쉬기"; } else if (c < i + h) { s = 1; lab = "멈추기"; } else if (c < i + h + o) { s = 1 - .4 * ((c - i - h) / o); lab = "내쉬기"; } else { s = .6; lab = "멈추기"; }
        ball.style.transform = `scale(${s})`; ball.textContent = lab; $(".cnt", el).textContent = Math.max(0, 60 - Math.floor(t)) + "초 남음";
        if (t >= 60) { run = false; ball.textContent = "잘했어요 🌿"; $(".go", el).textContent = "▶ 다시"; mission("breath"); xpOnce("breath" + today(), 10, "호흡 1분"); beep("bell"); return; }
        raf = requestAnimationFrame(loop);
      })(t0);
    };
  },
  journal(el) {
    function render() {
      el.innerHTML = `<div class="grid g2"><div class="card"><h3>📔 오늘의 학습 일지</h3><p class="small muted">메타인지의 3단계: 계획 → 점검 → 평가. 매일 3분이면 충분해요.</p>
        <label class="small"><b>📚 오늘 공부한 것</b><input class="j1" placeholder="예: 영어 단어 30개, 과학 3단원"></label>
        <label class="small"><b>🛠️ 사용한 방법</b><input class="j2" placeholder="예: 플래시카드, 백지 복습"></label>
        <label class="small"><b>🎯 집중도</b></label><div class="likert fc">${[1, 2, 3, 4, 5].map(n => `<button data-v="${n}">${"⭐".repeat(n)}</button>`).join("")}</div>
        <label class="small"><b>👍 잘된 점</b><textarea class="j3" style="min-height:60px"></textarea></label>
        <label class="small"><b>🔧 내일 바꿀 점 (If-Then으로!)</b><textarea class="j4" style="min-height:60px" placeholder="예: 만약 휴대폰이 보고 싶으면 → 타이머를 다시 켠다"></textarea></label>
        <button class="btn mint sv" style="margin-top:8px">💾 저장</button></div>
        <div class="card"><h3>🗂️ 지난 기록 (${S.journal.length})</h3>${S.journal.slice(0, 15).map((j, k) => `<div class="exp"><b>${fmtDate(j.d)}</b> ${"⭐".repeat(j.f || 0)}<button class="x" data-del="${k}" style="float:right">×</button><br>📚 ${esc(j.a)}<br>🛠️ ${esc(j.m)}${j.g ? "<br>👍 " + esc(j.g) : ""}${j.n ? "<br>🔧 " + esc(j.n) : ""}</div>`).join("") || '<p class="small muted">첫 일지를 써 보세요!</p>'}</div></div>`;
      let f = 0; $$(".fc button", el).forEach(b => b.onclick = () => { f = +b.dataset.v; $$(".fc button", el).forEach(x => x.classList.toggle("on", x === b)); });
      $(".sv", el).onclick = () => { const a = $(".j1", el).value.trim(); if (!a) return toast("오늘 공부한 것을 적어 주세요"); S.journal.unshift({ d: today(), a, m: $(".j2", el).value, f, g: $(".j3", el).value, n: $(".j4", el).value }); save(); mission("journal"); xpOnce("jr" + today(), 15, "학습 일지"); if (S.journal.length >= 3) badge("journal"); render(); };
      $$("[data-del]", el).forEach(b => b.onclick = () => { S.journal.splice(+b.dataset.del, 1); save(); render(); });
    }
    render();
  }
};
function goalForms(el, woopOnly) {
  function render() {
    el.innerHTML = `<div class="grid g2">${woopOnly ? "" : `<div class="card"><h3>🎯 SMART 목표 메이커</h3>
      <label class="small"><b>S</b> 구체적으로 — 무엇을?<input class="s1" placeholder="영어 단어를 외운다"></label>
      <label class="small"><b>M</b> 측정 가능 — 얼마나?<input class="s2" placeholder="하루 20개, 주 5일"></label>
      <label class="small"><b>A</b> 실현 가능 — 어떻게?<input class="s3" placeholder="등교 전 15분 플래시카드로"></label>
      <label class="small"><b>R</b> 의미 있는 — 왜?<input class="s4" placeholder="영어 수행평가 대비"></label>
      <label class="small"><b>T</b> 기한 — 언제까지?<input class="s5" type="date" value="${addDays(today(), 28)}"></label>
      <div class="pv exp"></div><button class="btn sm mint ss" style="margin-top:8px">💾 목표 저장</button></div>`}
      <div class="card"><h3>💫 WOOP + If-Then 계획</h3><p class="small muted">긍정적 상상만으로는 부족해요. 장애물을 미리 떠올리고 계획을 세우는 방법이에요 (Oettingen).</p>
      <label class="small"><b>W</b> 소망 (Wish)<input class="w1" placeholder="수학 시험에서 80점 넘기"></label>
      <label class="small"><b>O</b> 최고의 결과 (Outcome) — 이루면 어떤 기분?<input class="w2" placeholder="자신감이 생기고 부모님께 자랑할 수 있다"></label>
      <label class="small"><b>O</b> 내 안의 장애물 (Obstacle)<input class="w3" placeholder="저녁에 휴대폰을 보다가 시간이 사라진다"></label>
      <label class="small"><b>P</b> 계획 (Plan) — 만약 [장애물]이면, 나는 [행동]을 한다<input class="w4" placeholder="만약 휴대폰을 집으면, 거실에 두고 와서 타이머 25분을 켠다"></label>
      <button class="btn sm mint sw" style="margin-top:8px">💾 WOOP 저장</button></div></div>
      <div class="card" style="margin-top:16px"><h3>📌 나의 목표 보드</h3>${S.goals.map((g, i) => `<div class="todo-item ${g.done ? "done" : ""}"><input type="checkbox" data-g="${i}" ${g.done ? "checked" : ""} style="width:auto"><span>${g.type === "woop" ? "💫" : "🎯"} ${esc(g.text)}</span><button class="x" data-del="${i}">×</button></div>`).join("") || '<p class="small muted">목표를 저장하면 여기에 모여요.</p>'}</div>`;
    const pv = () => { const p = $(".pv", el); if (!p) return; const v = [1, 2, 3, 4].map(i => $(".s" + i, el).value.trim()); const d = $(".s5", el).value; p.innerHTML = v[0] ? `📣 <b>${d ? fmtDate(d) + "까지" : ""} ${esc(v[3] ? v[3] + "을(를) 위해 " : "")}${esc(v[2] ? v[2] + " " : "")}${esc(v[1] ? v[1] + " " : "")}${esc(v[0])}.</b>` : "위 칸을 채우면 목표 문장이 완성돼요."; };
    $$("[class^=s]", el).forEach(i => { if (i.tagName === "INPUT") i.oninput = pv; }); pv();
    const ss = $(".ss", el); if (ss) ss.onclick = () => { const t = $(".pv b", el); if (!t) return toast("목표를 적어 주세요"); S.goals.unshift({ type: "smart", text: t.textContent, done: 0 }); save(); xpOnce("goal" + S.goals.length, 10, "목표 설정"); render(); };
    $(".sw", el).onclick = () => { const w = [1, 2, 3, 4].map(i => $(".w" + i, el).value.trim()); if (!w[0] || !w[3]) return toast("소망과 계획을 적어 주세요"); S.goals.unshift({ type: "woop", text: `${w[0]} — ${w[3]}`, done: 0 }); save(); xpOnce("woop" + S.goals.length, 15, "WOOP 계획"); render(); };
    $$("[data-g]", el).forEach(c => c.onchange = () => { const g = S.goals[+c.dataset.g]; g.done = c.checked ? 1 : 0; if (g.done && !g.xp) { g.xp = 1; addXP(20, "목표 달성!"); confetti(); } save(); render(); });
    $$("[data-del]", el).forEach(b => b.onclick = () => { S.goals.splice(+b.dataset.del, 1); save(); render(); });
  }
  render();
}

/* ---------------- 진단 ---------------- */
routes.diag = function (tab) {
  tab = tab || "habit";
  app.innerHTML = `<div class="fade"><div class="page-head"><h1>🩺 공부 습관 진단</h1><p class="muted">정답은 없어요. 지금의 나를 솔직하게 체크하면, 어디부터 공부하면 좋을지 알려 줄게요.</p></div>
    <div class="row" style="margin-bottom:14px"><a class="btn ${tab === "habit" ? "" : "ghost"}" href="#/diag/habit">📊 공부 습관 진단 (18문항)</a><a class="btn ${tab === "pref" ? "" : "ghost"}" href="#/diag/pref">🎨 학습 선호 탐색 (12문항)</a></div><div id="dg"></div></div>`;
  (tab === "pref" ? prefTest : habitTest)($("#dg"));
};
function radar(vals, labels) {
  const n = vals.length, cx = 180, cy = 170, R = 120; const pt = (i, r) => [cx + Math.sin(i / n * 2 * Math.PI) * r, cy - Math.cos(i / n * 2 * Math.PI) * r];
  let g = ""; [.25, .5, .75, 1].forEach(k => g += `<polygon points="${vals.map((_, i) => pt(i, R * k).join(",")).join(" ")}" fill="none" stroke="#E6E2F7"/>`);
  vals.forEach((_, i) => { const [x, y] = pt(i, R); g += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#E6E2F7"/>`; const [lx, ly] = pt(i, R + 26); g += `<text x="${lx}" y="${ly + 4}" font-size="13" text-anchor="middle" font-weight="700" fill="#1E1B3A">${labels[i]}</text>`; });
  g += `<polygon points="${vals.map((v, i) => pt(i, R * Math.max(.04, v)).join(",")).join(" ")}" fill="rgba(108,92,231,.25)" stroke="#6C5CE7" stroke-width="3"/>`;
  vals.forEach((v, i) => { const [x, y] = pt(i, R * Math.max(.04, v)); g += `<circle cx="${x}" cy="${y}" r="4" fill="#6C5CE7"/>`; });
  return `<svg class="radar" viewBox="0 0 360 340">${g}</svg>`;
}
function habitTest(el) {
  const ans = (S.diag && S.diag.ans) ? S.diag.ans.slice() : [];
  el.innerHTML = `<div class="card">${SS.diagQs.map((q, i) => `<div class="dq"><p>${i + 1}. ${q[1]}</p><div class="likert" data-i="${i}">${["자주 그래요", "가끔", "거의 안 그래요"].map((t, k) => `<button data-k="${k}" class="${ans[i] === k ? "on" : ""}">${t}</button>`).join("")}</div></div>`).join("")}
    <button class="btn" id="dgo" style="margin-top:14px">결과 보기</button></div><div id="dres" style="margin-top:16px"></div>`;
  $$(".likert", el).forEach(l => $$("button", l).forEach(b => b.onclick = () => { ans[+l.dataset.i] = +b.dataset.k; $$("button", l).forEach(x => x.classList.toggle("on", x === b)); }));
  const show = () => {
    const sc = {}; SS.diagAreas.forEach(a => sc[a.k] = [0, 0]);
    SS.diagQs.forEach((q, i) => { const k = ans[i]; const v = q[2] > 0 ? [2, 1, 0][k] : [0, 1, 2][k]; sc[q[0]][0] += v; sc[q[0]][1] += 2; });
    const vals = SS.diagAreas.map(a => sc[a.k][0] / sc[a.k][1]);
    const order = SS.diagAreas.map((a, i) => ({ a, v: vals[i] })).sort((x, y) => x.v - y.v);
    $("#dres").innerHTML = `<div class="grid g2"><div class="card">${radar(vals, SS.diagAreas.map(a => a.name))}</div>
      <div class="card"><h3>📋 나의 공부력 리포트</h3>${order.map(o => `<div class="row" style="margin-bottom:6px"><span style="width:90px;font-weight:700">${o.a.name}</span><div class="xpbar" style="display:block;flex:1;height:10px"><i style="width:${o.v * 100}%"></i></div><b style="width:42px;text-align:right">${Math.round(o.v * 100)}</b></div>`).join("")}
      <h4 style="margin-top:14px">🚀 먼저 키울 영역</h4>${order.slice(0, 2).map(o => { const t = TOOLS.find(x => x.id === o.a.tool), c = SS.chapters.find(x => x.id === o.a.ch); return `<div class="exp"><b>${o.a.name}</b> → <a href="#/ch/${c.id}">${c.emoji} ${c.id}장 ${c.title}</a> · <a href="#/tool/${t.id}">${t.emoji} ${t.name}</a></div>`; }).join("")}
      <p class="small muted">🌟 강점: <b>${order[order.length - 1].a.name}</b> — 이 강점을 자신감의 연료로 쓰세요! 한 달 뒤 다시 진단해 변화를 확인해 보세요.</p></div></div>`;
  };
  $("#dgo").onclick = () => {
    if (ans.filter(x => x !== undefined).length < SS.diagQs.length) return toast("모든 문항에 답해 주세요 (" + ans.filter(x => x !== undefined).length + "/" + SS.diagQs.length + ")");
    S.diag = { ans, d: today() }; save(); show(); badge("diag"); xpOnce("diag", 30, "공부 습관 진단");
    $("#dres").scrollIntoView({ behavior: "smooth" });
  };
  if (S.diag && S.diag.ans && S.diag.ans.length === SS.diagQs.length) show();
}
function prefTest(el) {
  const ans = (S.pref && S.pref.slice()) || [];
  el.innerHTML = `<div class="fact"><h4>🔬 먼저 알아 둘 것</h4>사람마다 좋아하는 방식(선호)은 있지만, ‘내 유형에 맞는 방식으로만 공부해야 성적이 오른다’는 근거는 부족해요(Pashler 외, 2008). 이 탐색은 <b>공부를 즐겁게 만드는 힌트</b>를 찾고, <b>여러 방식을 섞는</b> 데 활용하세요.</div>
    <div class="card">${SS.prefQs.map((q, i) => `<div class="dq"><p>${i + 1}. ${q[1]}</p><div class="likert" data-i="${i}">${["그래요", "조금", "아니요"].map((t, k) => `<button data-k="${k}" class="${ans[i] === k ? "on" : ""}">${t}</button>`).join("")}</div></div>`).join("")}
    <button class="btn" id="pgo" style="margin-top:14px">결과 보기</button></div><div id="pres" style="margin-top:16px"></div>`;
  $$(".likert", el).forEach(l => $$("button", l).forEach(b => b.onclick = () => { ans[+l.dataset.i] = +b.dataset.k; $$("button", l).forEach(x => x.classList.toggle("on", x === b)); }));
  const show = () => {
    const sc = {}; SS.prefs.forEach(p => sc[p.k] = 0); SS.prefQs.forEach((q, i) => sc[q[0]] += [2, 1, 0][ans[i]]);
    const ord = SS.prefs.slice().sort((a, b) => sc[b.k] - sc[a.k]);
    $("#pres").innerHTML = `<div class="card"><h3>🎨 나의 학습 선호 지도</h3>${ord.map(p => `<div class="row" style="margin-bottom:6px"><span style="width:110px;font-weight:700">${p.emoji} ${p.name}</span><div class="xpbar" style="display:block;flex:1;height:10px"><i style="width:${sc[p.k] / 4 * 100}%"></i></div></div>`).join("")}
      <h4 style="margin-top:14px">😊 내가 즐기는 방식 활용하기</h4>${ord.slice(0, 2).map(p => `<div class="exp"><b>${p.emoji} ${p.name}</b>: ${p.tip}</div>`).join("")}
      <h4>🌈 새로 섞어 볼 방식</h4><div class="exp"><b>${ord[ord.length - 1].emoji} ${ord[ord.length - 1].name}</b>: ${ord[ord.length - 1].tip}</div>
      <p class="small muted">어떤 선호든 효과가 확인된 전략 — <a href="#/lab/retrieval">인출 연습</a>, <a href="#/lab/spacing">간격 반복</a>, <a href="#/lab/dual">이중 부호화</a> — 은 모두에게 도움이 돼요!</p></div>`;
  };
  $("#pgo").onclick = () => { if (ans.filter(x => x !== undefined).length < SS.prefQs.length) return toast("모든 문항에 답해 주세요"); S.pref = ans; save(); show(); xpOnce("pref", 15, "학습 선호 탐색"); $("#pres").scrollIntoView({ behavior: "smooth" }); };
  if (S.pref && S.pref.length === SS.prefQs.length) show();
}

/* ---------------- 내 기록 ---------------- */
routes.me = function () {
  const L = lvInfo(S.xp), c = calib(), dn = Object.keys(S.done).length, all = SS.chapters.reduce((a, x) => a + x.lessons.length, 0);
  app.innerHTML = `<div class="fade"><div class="page-head"><h1>🏆 내 기록 · 배지</h1></div>
    <div class="hero" style="margin-bottom:16px"><div class="lvl" style="margin:0"><div class="ring" style="--v:${L.pct}"><b>${L.name.split(" ")[0]}</b></div><div><div style="font-weight:800;font-size:20px">${S.name ? esc(S.name) + " · " : ""}${L.name}</div><div class="small">${S.xp} XP · 다음 레벨까지 ${L.toNext} XP</div></div></div></div>
    <div class="grid g4"><div class="stat"><b>${dn}/${all}</b><small>완료 레슨</small></div><div class="stat"><b>${Object.keys(S.boss).length}/7</b><small>보스 클리어</small></div><div class="stat"><b>🔥${streak()}</b><small>연속 학습일</small></div><div class="stat"><b>${Object.keys(S.days).length}</b><small>총 학습일</small></div>
    <div class="stat"><b>${S.pomo.count}</b><small>집중 타이머</small></div><div class="stat"><b>${S.cardReviews}</b><small>카드 복습</small></div><div class="stat"><b>${c ? c.score : "—"}</b><small>메타인지 점수</small></div><div class="stat"><b>${S.journal.length}</b><small>학습 일지</small></div></div>
    <h2 style="margin-top:22px">🎖️ 배지 ${Object.keys(S.badges).length}/${SS.badges.length}</h2>
    <div class="badges">${SS.badges.map(b => `<div class="badge ${S.badges[b.id] ? "got" : ""}"><b>${b.emoji}</b><strong>${b.name}</strong><small>${b.desc}</small></div>`).join("")}</div>
    <div class="card" style="margin-top:20px"><h3>⚙️ 설정 · 데이터</h3><div class="row"><label class="row small" style="gap:6px"><input type="checkbox" id="snd" ${S.sound ? "checked" : ""} style="width:auto"> 효과음</label>
      <input id="nm2" value="${esc(S.name)}" placeholder="닉네임" style="width:160px"><button class="btn sm ghost" id="nmS">닉네임 저장</button></div>
      <p class="small muted">모든 기록은 이 기기의 브라우저에만 저장돼요. 다른 기기로 옮기려면 백업 파일을 내려받아 불러오세요.</p>
      <div class="row"><button class="btn sm line" id="exp">⬇️ 백업 내려받기</button><label class="btn sm line" style="cursor:pointer">⬆️ 백업 불러오기<input type="file" id="imp" accept=".json" style="display:none"></label><button class="btn sm coral" id="rst">초기화</button></div></div></div>`;
  $("#snd").onchange = e => { S.sound = e.target.checked; save(); };
  $("#nmS").onclick = () => { S.name = $("#nm2").value.trim().slice(0, 12); save(); toast("저장했어요"); };
  $("#exp").onclick = () => saveFile("study-skill-backup-" + today() + ".json", new Blob([JSON.stringify(S)], { type: "application/json" }));
  $("#imp").onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { S = Object.assign(DEF(), JSON.parse(r.result)); save(); hud(); sideChapters(); routes.me(); toast("불러왔어요!"); } catch (er) { toast("파일을 읽을 수 없어요"); } }; r.readAsText(f); };
  $("#rst").onclick = () => { if (confirm("모든 기록(XP, 배지, 카드, 일지 등)을 지울까요? 되돌릴 수 없어요.")) { S = DEF(); save(); hud(); sideChapters(); routes.me(); } };
};
routes.refs = function () {
  app.innerHTML = `<div class="fade"><div class="page-head"><h1>📖 참고 자료</h1><p class="muted">이 앱의 설명·문제·게임·도구는 다인에듀가 직접 기획하고 집필했어요. 과학적 근거는 아래 공개 연구를 참고했으며, 연구 내용은 요약·재서술했습니다.</p></div>
    <div class="card">${SS.refs.map(r => `<div class="dq"><p style="font-weight:500">${r.u ? `<a href="${r.u}" target="_blank" rel="noopener">${esc(r.t)} ↗</a>` : esc(r.t)}</p></div>`).join("")}</div>
    <div class="fact"><h4>🔬 팩트체크 정책</h4>널리 퍼져 있지만 연구 근거가 약한 통념(예: 좌뇌형·우뇌형, 학습 스타일 맞춤 학습)은 레슨 안에 ‘과학 팩트체크’로 표시했어요.</div>
    <p class="small muted">© 다인원격평생교육직업학원(다인에듀) · 후안샘 | <a href="privacy.html" target="_blank">개인정보처리방침</a> | 이모지는 사용자 기기의 기본 글꼴로 표시됩니다.</p></div>`;
};

/* ---------------- 시작 ---------------- */
hud(); sideChapters(); go();
if (!NATIVE && "serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
