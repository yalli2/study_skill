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
const fmtDate = s => { const d = new Date(s + "T00:00:00"); return (d.getMonth() + 1) + "/" + d.getDate() + "(" + $t("a1").split(",")[d.getDay()] + ")"; };
const uid = () => Math.random().toString(36).slice(2, 9);
const $f = (k, ...a) => $t(k).replace(/\{(\d)\}/g, (m, i) => a[i] == null ? "" : a[i]);
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
    } catch (e) { toast($t("a2")); }
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
  if (after > before) { setTimeout(() => { toast($t("a3") + SS.levels[after], "badge-t"); confetti(); beep("win"); }, 500); }
  const st = streak(); if (st >= 3) badge("streak3"); if (st >= 7) badge("streak7");
  hud();
}
function xpOnce(key, n, why) { if (S.xpOnce[key]) return false; S.xpOnce[key] = 1; addXP(n, why); return true; }
function badge(id) {
  if (S.badges[id]) return;
  const b = SS.badges.find(x => x.id === id); if (!b) return;
  S.badges[id] = today(); save();
  setTimeout(() => { toast(b.emoji + $t("a4") + b.name, "badge-t"); confetti(); beep("win"); }, 700);
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
  setTimeout(() => { addXP(m.xp, $t("a5")); if (ms.every(x => S.mDone[x.id])) { toast($t("a6"), "badge-t"); confetti(); } }, 900);
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
      <div class="row" style="justify-content:space-between;margin-bottom:6px"><span class="tag">${opts.label || $t("a7")} ${i + 1} / ${qs.length}</span>${qs.length > 3 ? `<div class="xpbar" style="display:block;width:120px"><i style="width:${i / qs.length * 100}%"></i></div>` : ""}</div>
      <div class="qt">${q.q}</div>
      ${opts.noConf ? "" : `<div class="conf">${$t("a8")} <button data-c="50">${$t("a9")}</button><button data-c="75">${$t("a10")}</button><button data-c="100">${$t("a11")}</button></div>`}
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
    if (!opts.noConf) { if (ok && conf === 50) note = $t("a12"); if (!ok && conf === 100) note = $t("a13"); }
    $(".ans", el).innerHTML = `<div class="exp">${ok ? $t("a14") : $t("a15")} ${q.e || ""}${note}</div>
      <div class="row" style="margin-top:10px"><button class="btn sm nx">${i < qs.length - 1 ? $t("a16") : $t("a17")}</button></div>`;
    $(".nx", el).onclick = () => { i++; if (i < qs.length) draw(); else finish(); };
  }
  function finish() {
    if (opts.onDone) opts.onDone(right, qs.length, res, el);
    else el.innerHTML = `<div class="q fade" style="text-align:center"><div class="score-big">${right}/${qs.length}</div><p class="muted">${$t("a18")}</p><button class="btn ghost sm again">${$t("a19")}</button></div>`;
    const a = $(".again", el); if (a) a.onclick = () => { i = 0; right = 0; res.length = 0; draw(); };
  }
  draw();
}
function shuffleQ(q) { const idx = shuffle(q.o.map((_, i) => i)); return { q: q.q, o: idx.map(i => q.o[i]), a: idx.indexOf(q.a), e: q.e }; }

/* ---------------- 분류(정렬) 게임 엔진 ---------------- */
function sortGame(el, data, onDone) {
  const items = shuffle(data.items); let answered = 0, right = 0;
  el.innerHTML = `<h3>🎮 ${data.title}</h3><p class="small muted">${$t("a20")}</p>` +
    items.map((it, i) => `<div class="sort-item" data-i="${i}"><span>${it[0]}</span><div class="bs">${data.buckets.map((b, k) => `<button class="btn sm ghost" data-k="${k}">${b}</button>`).join("")}</div></div>`).join("") + `<div class="res"></div>`;
  $$(".sort-item", el).forEach(row => {
    $$("button", row).forEach(b => b.onclick = () => {
      const it = items[+row.dataset.i], ok = +b.dataset.k === it[1];
      row.classList.add(ok ? "ok" : "no"); answered++; if (ok) right++;
      $(".bs", row).innerHTML = `<span class="small"><b>${ok ? "⭕" : "❌"} ${data.buckets[it[1]]}</b></span>`;
      ok ? beep("ok") : beep("bad");
      if (answered === items.length) {
        $(".res", el).innerHTML = `<div class="exp"><b>${right} / ${items.length}${$t("a21")} ${right === items.length ? $t("a22") : $t("a23")}</div>`;
        if (onDone) onDone(right, items.length);
      }
    });
  });
}

/* ---------------- 시나리오형 미니게임 데이터 ---------------- */
SS.games = {
  mindset: { title: $t("a24"), desc: $t("a25"), items: [
    { q: $t("a26"), o: [$t("a27"), $t("a28"), $t("a29")], a: 1, e: $t("a30") },
    { q: $t("a31"), o: [$t("a32"), $t("a33"), $t("a34")], a: 0, e: $t("a35") },
    { q: $t("a36"), o: [$t("a37"), $t("a38"), $t("a39")], a: 1, e: $t("a40") },
    { q: $t("a41"), o: [$t("a42"), $t("a43"), $t("a44")], a: 1, e: $t("a45") }
  ]},
  readmode: { title: $t("a46"), desc: $t("a47"), items: [
    { q: $t("a48"), o: [$t("a49"), $t("a50"), $t("a51")], a: 0, e: $t("a52") },
    { q: $t("a53"), o: [$t("a49"), $t("a50"), $t("a51")], a: 1, e: $t("a54") },
    { q: $t("a55"), o: [$t("a49"), $t("a50"), $t("a56")], a: 2, e: $t("a57") },
    { q: $t("a58"), o: [$t("a49"), $t("a59"), $t("a60")], a: 0, e: $t("a61") }
  ]},
  critical: { title: $t("a62"), desc: $t("a63"), items: [
    { q: $t("a64"), o: [$t("a65"), $t("a66"), $t("a67")], a: 1, e: $t("a68") },
    { q: $t("a69"), o: [$t("a70"), $t("a71"), $t("a72")], a: 1, e: $t("a73") },
    { q: $t("a74"), o: [$t("a75"), $t("a76"), $t("a77")], a: 1, e: $t("a78") },
    { q: $t("a79"), o: [$t("a80"), $t("a81"), $t("a82")], a: 1, e: $t("a83") }
  ]},
  verbs: { title: $t("a84"), desc: $t("a85"), items: [
    { q: $t("a86"), o: [$t("a87"), $t("a88"), $t("a89")], a: 0, e: $t("a90") },
    { q: $t("a91"), o: [$t("a92"), $t("a93"), $t("a94")], a: 1, e: $t("a95") },
    { q: $t("a96"), o: [$t("a97"), $t("a98"), $t("a99")], a: 0, e: $t("a100") },
    { q: $t("a101"), o: [$t("a102"), $t("a103"), $t("a104")], a: 0, e: $t("a105") },
    { q: $t("a106"), o: [$t("a107"), $t("a108"), $t("a109")], a: 1, e: $t("a110") }
  ]},
  search: { title: $t("a111"), desc: $t("a112"), items: [
    { q: $t("a113"), o: [$t("a114"), $t("a115"), $t("a116")], a: 1, e: $t("a117") },
    { q: $t("a118"), o: [$t("a119"), $t("a120"), $t("a121")], a: 0, e: $t("a122") },
    { q: $t("a123"), o: [$t("a124"), $t("a125"), $t("a126")], a: 0, e: $t("a127") },
    { q: $t("a128"), o: [$t("a129"), $t("a130"), $t("a131")], a: 1, e: $t("a132") }
  ]},
  errors: { title: $t("a133"), desc: $t("a134"), items: [
    { q: $t("a135"), o: [$t("a136"), $t("a137"), $t("a138"), $t("a139")], a: 1, e: $t("a140") },
    { q: $t("a141"), o: [$t("a136"), $t("a137"), $t("a138"), $t("a139")], a: 0, e: $t("a142") },
    { q: $t("a143"), o: [$t("a136"), $t("a137"), $t("a138"), $t("a139")], a: 2, e: $t("a144") },
    { q: $t("a145"), o: [$t("a136"), $t("a137"), $t("a138"), $t("a139")], a: 3, e: $t("a146") }
  ]},
  interleave: { title: $t("a147"), desc: $t("a148"), items: [
    { q: $t("a149"), o: [$t("a150"), $t("a151"), $t("a152"), $t("a153")], a: 1, e: "6×4÷2 = 12㎠" },
    { q: $t("a154"), o: [$t("a150"), $t("a151"), $t("a152"), $t("a153")], a: 2, e: "3×3×3.14 = 28.26㎠" },
    { q: $t("a155"), o: [$t("a150"), $t("a151"), $t("a152"), $t("a153")], a: 3, e: "(4+8)×5÷2 = 30㎠" },
    { q: $t("a156"), o: [$t("a150"), $t("a151"), $t("a152"), $t("a153")], a: 0, e: "7×3 = 21㎠" },
    { q: $t("a157"), o: [$t("a150"), $t("a151"), $t("a152"), $t("a153")], a: 2, e: $t("a158") }
  ]},
  example: { title: $t("a159"), desc: $t("a160"), items: [
    { q: $t("a161"), o: [$t("a162"), $t("a163"), $t("a164")], a: 0, e: $t("a165") },
    { q: $t("a166"), o: [$t("a167"), $t("a168"), $t("a169")], a: 0, e: $t("a170") },
    { q: $t("a171"), o: [$t("a172"), $t("a173"), $t("a174")], a: 0, e: $t("a175") },
    { q: $t("a176"), o: [$t("a177"), $t("a178"), $t("a179")], a: 0, e: $t("a180") }
  ]}
};
function scenarioGame(el, key) {
  const g = SS.games[key];
  el.innerHTML = `<h3>🎮 ${g.title}</h3><p class="small muted">${g.desc}</p><div class="sg"></div>`;
  quiz($(".sg", el), g.items, { noConf: true, label: $t("a181"), onDone: (r, n, _, box) => {
    box.innerHTML = `<div class="q" style="text-align:center"><div class="score-big">${r}/${n}</div><p>${r === n ? $t("a182") : $t("a183")}</p><button class="btn ghost sm again">${$t("a19")}</button></div>`;
    $(".again", box).onclick = () => scenarioGame(el, key);
    if (r === n) beep("win");
  }});
}

/* ---------------- 특수 미니게임 ---------------- */
const games = {
  digitspan(el) {
    let n = 4, fails = 0, best = 0;
    el.innerHTML = `<h3>${$t("a184")}</h3><p class="small muted">${$t("a185")}</p>
      <div class="digits">${$t("a186")}</div><div class="row in" style="justify-content:center"><button class="btn st">${$t("a187")}</button></div><div class="res"></div>`;
    const D = $(".digits", el), IN = $(".in", el);
    function round() {
      const num = Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
      D.textContent = num; IN.innerHTML = `<span class="muted small">${n}${$t("a188")}</span>`;
      setTimeout(() => {
        D.textContent = "❓".repeat(Math.min(n, 9));
        IN.innerHTML = `<input class="ans" inputmode="numeric" style="max-width:220px;text-align:center;font-size:20px" placeholder="${$t("a189")}"><button class="btn ok">${$t("a190")}</button>`;
        const inp = $(".ans", IN); inp.focus();
        const go = () => {
          if (inp.value.replace(/\D/g, "") === num) { best = n; beep("ok"); D.textContent = "⭕ " + num; n++; fails = 0; IN.innerHTML = `<button class="btn st">${$t("a191")}${n}${$t("a192")}</button>`; $(".st", IN).onclick = round; }
          else { beep("bad"); fails++; D.textContent = $t("a193") + num; if (fails >= 2) end(); else { IN.innerHTML = `<button class="btn st">${$t("a194")}${n}${$t("a192")}</button>`; $(".st", IN).onclick = round; } }
        };
        $(".ok", IN).onclick = go; inp.onkeydown = e => { if (e.key === "Enter") go(); };
      }, 900 + n * 550);
    }
    function end() {
      IN.innerHTML = `<button class="btn ghost st">${$t("a195")}</button>`; $(".st", IN).onclick = () => { n = 4; fails = 0; best = 0; $(".res", el).innerHTML = ""; round(); };
      $(".res", el).innerHTML = `<div class="exp">${$t("a196")}${best}${$t("a197")}</div>`;
    }
    $(".st", el).onclick = round;
  },
  styles(el) {
    el.innerHTML = `<h3>${$t("a198")}</h3><p class="small">${$t("a199")}</p><a class="btn" href="#/diag/pref">${$t("a200")}</a>`;
  },
  loci(el) {
    const spots = [["🚪", $t("a201")], ["🛋️", $t("a202")], ["📺", "TV"], ["🍳", $t("a203")], ["🛏️", $t("a204")]];
    const pool = [["🍌", $t("a205")], ["🎸", $t("a206")], ["🐘", $t("a207")], ["⏰", $t("a208")], ["🌂", $t("a209")], ["🚲", $t("a210")], ["🍕", $t("a211")], ["🧦", $t("a212")], ["🦆", $t("a213")], ["🎈", $t("a214")]];
    let items = shuffle(pool).slice(0, 5);
    el.innerHTML = `<h3>${$t("a215")}</h3><p class="small muted">${$t("a216")}</p>
      <div class="loci-room">${spots.map((s, i) => `<div><b>${s[0]}</b>${s[1]}<em>${items[i][0]}</em><small>${items[i][1]}</small></div>`).join("")}</div>
      <div class="row"><button class="btn go">${$t("a217")}</button></div><div class="res"></div>`;
    $(".go", el).onclick = () => {
      const opts = shuffle(pool);
      $(".loci-room", el).innerHTML = spots.map((s, i) => `<div><b>${s[0]}</b>${s[1]}<select data-i="${i}" style="margin-top:6px;padding:4px;font-size:13px"><option value="">?</option>${opts.map(o => `<option>${o[1]}</option>`).join("")}</select></div>`).join("");
      $(".go", el).outerHTML = `<button class="btn mint chk">${$t("a218")}</button>`;
      $(".chk", el).onclick = () => {
        let r = 0; $$("select", el).forEach(s => { const ok = s.value === items[+s.dataset.i][1]; if (ok) r++; s.parentElement.style.background = ok ? "#D5F5EC" : "#FFE5E5"; });
        $(".res", el).innerHTML = `<div class="exp"><b>${r} ${$t("a219")} ${r >= 4 ? $t("a221") : $t("a222")} ${$t("a220")}</div>`;
        beep(r >= 4 ? "win" : "ok");
      };
    };
  },
  timecalc(el) {
    el.innerHTML = `<h3>${$t("a223")}</h3>
      <div class="grid g3"><label>${$t("a224")}<input class="tt" type="number" value="50"></label><label>${$t("a225")}<input class="rv" type="number" value="5"></label><label>${$t("a226")}<input class="pts" value="10,10,20,30,30"></label></div>
      <div class="out" style="margin-top:12px"></div>`;
    const calc = () => {
      const T = +$(".tt", el).value || 0, R = +$(".rv", el).value || 0, P = $(".pts", el).value.split(/[,\s]+/).map(Number).filter(x => x > 0);
      const sum = P.reduce((a, b) => a + b, 0), avail = Math.max(0, T - R);
      if (!sum) { $(".out", el).innerHTML = ""; return; }
      $(".out", el).innerHTML = `<table class="plan"><tr><th>${$t("a227")}</th><th>${$t("a228")}</th><th>${$t("a229")}</th></tr>${P.map((p, i) => `<tr><td>${i + 1}${$t("a232")}</td><td>${p}${$t("a233")}</td><td><b>${(avail * p / sum).toFixed(1)}${$t("a231")}</td></tr>`).join("")}<tr><td>${$t("a230")}</td><td>—</td><td><b>${R}${$t("a231")}</td></tr></table>`;
    };
    $$("input", el).forEach(i => i.oninput = calc); calc();
  },
  password(el) {
    el.innerHTML = `<h3>${$t("a234")}</h3><p class="small muted">${$t("a235")}</p>
      <input class="pw" placeholder="${$t("a236")}" autocomplete="off"><div class="xpbar" style="display:block;width:100%;height:12px;margin:10px 0"><i class="m"></i></div><div class="o small"></div>`;
    $(".pw", el).oninput = e => {
      const v = e.target.value; let s = 0; const tips = [];
      if (v.length >= 8) s += 20; if (v.length >= 12) s += 25; else tips.push($t("a237"));
      if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s += 10; if (/\d/.test(v)) s += 10; else tips.push($t("a238"));
      if (/[^A-Za-z0-9가-힣]/.test(v)) s += 15; else tips.push($t("a239"));
      if (/[가-힣\-\s]/.test(v) && v.length >= 14) s += 20;
      if (/(1234|password|qwer|abcd|0000|1111|iloveyou)/i.test(v)) { s -= 40; tips.push($t("a240")); }
      if (/(19|20)\d{2}/.test(v)) { s -= 10; tips.push($t("a241")); }
      s = Math.max(0, Math.min(100, s));
      $(".m", el).style.width = s + "%"; $(".m", el).style.background = s < 40 ? "#FF7675" : s < 70 ? "#FDCB6E" : "#00B894";
      $(".o", el).innerHTML = v ? `${$t("a242")}${s < 40 ? $t("a243") : s < 70 ? $t("a244") : $t("a245")}</b> ${tips.length ? $t("a246") + tips.join(", ") : $t("a247")}` : "";
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
  $t("a248"),
  $t("a249"),
  $t("a250"),
  $t("a251"),
  $t("a252"),
  $t("a253"),
  $t("a254"),
  $t("a255"),
  $t("a256"),
  $t("a257")
];
function nextLesson() {
  for (const c of SS.chapters) for (const l of c.lessons) if (!S.done[l.id]) return { c, l };
  return null;
}
function worldsHTML() {
  return `<div class="worlds">${SS.chapters.map(c => { const p = chProgress(c); return `<a class="world" href="#/ch/${c.id}" style="background:linear-gradient(140deg,${c.color},${c.color}cc)">${S.boss[c.id] ? '<span class="crown">👑</span>' : ""}<span class="em">${c.emoji}</span><div><small>${c.id}${$t("a258")} ${c.sub}</small><b>${c.title}</b><div class="bar"><i style="width:${p.done / p.total * 100}%"></i></div><small>${p.done}/${p.total} ${$t("a259")}</small></div></a>`; }).join("")}</div>`;
}
routes.home = function () {
  const L = lvInfo(S.xp), ms = todaysMissions(), nx = nextLesson();
  const tip = TIPS[new Date().getDate() % TIPS.length];
  app.innerHTML = `<div class="fade">
  <section class="hero">
    <div class="deco">📚</div>
    <div class="lvl"><div class="ring" style="--v:${L.pct}"><b>${L.name.split(" ")[0]}</b></div>
      <div><div style="font-weight:800;font-size:18px">${S.name ? esc(S.name) + $t("a275") : ""}${L.name.split(" ").slice(1).join(" ")}</div><div class="small" style="opacity:.9">${S.xp} ${$t("a260")} ${L.toNext} XP · 🔥 ${streak()}${$t("a261")}</div></div></div>
    <h1>${$t("a262")}</h1>
    <p>${$t("a263")}</p>
    ${S.name ? "" : `<div class="namebox" style="margin-bottom:12px"><input id="nm" placeholder="${$t("a276")}"><button class="btn" id="nmOk">${$t("a277")}</button></div>`}
    <div class="row">${nx ? `<a class="btn" href="#/ls/${nx.l.id}${$t("a278")} ${nx.l.title}</a>` : `<a class="btn" href="#/me">${$t("a279")}</a>`}<a class="btn ghost" href="#/diag">${$t("a264")}</a></div>
  </section>
  <div class="grid g2" style="margin-top:18px">
    <div class="card"><h3>${$t("a265")}</h3>${ms.map(m => `<div class="mission ${S.mDone[m.id] ? "done" : ""}"><span class="ck">${S.mDone[m.id] ? "✔" : ""}</span><span>${m.text}</span><span class="xp">+${m.xp} XP</span></div>`).join("")}<p class="small muted" style="margin:6px 0 0">${$t("a266")}</p></div>
    <div class="card"><h3>${$t("a267")}</h3><div class="tipbox">${tip}</div>
      <h3 style="margin-top:16px">${$t("a268")}</h3><div class="grid g3">
      <a class="quick" href="#/tool/timer">${$t("a269")}</a><a class="quick" href="#/tool/cards">${$t("a270")}</a><a class="quick" href="#/lab/retrieval">${$t("a271")}</a></div></div>
  </div>
  <h2 style="margin-top:26px">${$t("a272")}</h2><p class="muted" style="margin-top:-4px">${$t("a273")}</p>
  ${worldsHTML()}
  <h2 style="margin-top:26px">${$t("a274")}</h2>
  <div class="grid g3">${SS.labs.slice(0, 3).map(l => labCard(l)).join("")}</div>
  </div>`;
  const nb = $("#nmOk"); if (nb) nb.onclick = () => { const v = $("#nm").value.trim(); if (v) { S.name = v.slice(0, 12); save(); routes.home(); toast($t("a280") + esc(S.name) + $t("a281")); } };
};

/* ---------------- 퀘스트 / 챕터 / 레슨 / 보스 ---------------- */
routes.quest = function () {
  const all = SS.chapters.reduce((a, c) => a + c.lessons.length, 0), dn = Object.keys(S.done).length;
  app.innerHTML = `<div class="fade"><div class="page-head"><h1>${$t("a282")}</h1><p class="muted">${$t("a283")}${dn}/${all}</b></p></div>${worldsHTML()}
  <div class="card" style="margin-top:20px"><h3>${$t("a284")}</h3><p class="small" style="margin:0">${$t("a285")}</p></div></div>`;
};
routes.ch = function (id) {
  const c = SS.chapters.find(x => x.id === +id); if (!c) return routes.quest();
  const p = chProgress(c);
  app.innerHTML = `<div class="fade">
    <div class="hero" style="background:linear-gradient(135deg,${c.color},${c.color}aa)"><div class="deco">${c.emoji}</div>
      <div class="small" style="opacity:.9"><a href="#/quest" style="color:#fff">${$t("a286")}</a> › ${c.id}${$t("a287")}</div>
      <h1>${c.emoji} ${c.title}</h1><p>${c.intro}</p>
      <div class="row"><span class="pill" style="color:var(--ink)">📘 ${p.done}/${p.total} ${$t("a259")}</span>${S.boss[c.id] ? `<span class="pill" style="color:var(--ink)">${$t("a291")} ${S.boss[c.id]}%</span>` : ""}</div></div>
    <div class="lesson-list" style="margin-top:18px">${c.lessons.map((l, i) => `<a href="#/ls/${l.id}"><span style="font-size:22px">${l.emoji}</span><span>${c.id}-${i + 1}. ${l.title}</span><span class="st ${S.done[l.id] ? "ok" : ""}">${S.done[l.id] ? $t("a292") : $t("a293")}</span></a>`).join("")}</div>
    <div class="card" style="margin-top:12px;display:flex;align-items:center;gap:14px;flex-wrap:wrap"><span style="font-size:40px">🐉</span><div style="flex:1;min-width:200px"><h3 style="margin:0">${$t("a288")} ${c.title}</h3><p class="small muted" style="margin:0">${$t("a289")} ${p.done < p.total ? $t("a294") : ""}</p></div><a class="btn coral" href="#/boss/${c.id}${$t("a290")}</a></div>
  </div>`;
};
routes.ls = function (lid) {
  let c, l, idx; SS.chapters.forEach(ch => ch.lessons.forEach((x, i) => { if (x.id === lid) { c = ch; l = x; idx = i; } }));
  if (!l) return routes.quest();
  const flat = []; SS.chapters.forEach(ch => ch.lessons.forEach(x => flat.push(x.id)));
  const fi = flat.indexOf(lid), prev = flat[fi - 1], next = flat[fi + 1];
  const tl = l.toolLink ? TOOLS.find(t => t.id === l.toolLink) : null;
  app.innerHTML = `<div class="fade" style="--cc:${c.color}">
    <div class="page-head"><div class="crumb"><a href="#/quest">${$t("a286")}</a> › <a href="#/ch/${c.id}">${c.id}${$t("a287")} ${c.title}</a> ${$t("a295")} ${idx + 1}/${c.lessons.length}</div>
    <h1>${l.emoji} ${l.title} ${S.done[l.id] ? $t("a298") : ""}</h1></div>
    <ol class="pts">${l.points.map((p, i) => `<li style="animation-delay:${i * .08}s">${p}</li>`).join("")}</ol>
    ${l.fact ? `<div class="fact"><h4>🔬 ${l.fact.title}</h4>${l.fact.text}</div>` : ""}
    ${l.tip ? `<div class="tip">${$t("a299")} ${l.tip}</div>` : ""}
    ${tl ? `<a class="btn ghost" href="#/tool/${tl.id}">${tl.emoji} ${tl.name} ${$t("a300")}</a>` : ""}
    ${l.sort ? `<div class="act" id="actSort"></div>` : ""}
    ${l.game ? `<div class="act" id="actGame"></div>` : ""}
    ${l.checklist ? `<div class="act"><h3>${$t("a301")}</h3>${l.checklist.map((x, i) => `<label class="row" style="padding:5px 0"><input type="checkbox" style="width:auto"> ${x}</label>`).join("")}</div>` : ""}
    <h2 style="margin-top:22px">${$t("a296")}</h2><p class="small muted" style="margin-top:-6px">${$t("a297")}</p>
    <div id="lq"></div>
    <div class="row" style="justify-content:space-between;margin-top:20px">${prev ? `<a class="btn line" href="#/ls/${prev}${$t("a302")}</a>` : "<span></span>"}${next ? `<a class="btn" href="#/ls/${next}${$t("a303")}</a>` : `<a class="btn" href="#/boss/${c.id}${$t("a304")}</a>`}</div>
  </div>`;
  if (l.sort) sortGame($("#actSort"), l.sort, r => { if (r) xpOnce("sort" + l.id, 5, $t("a305")); });
  if (l.game) { if (SS.games[l.game]) scenarioGame($("#actGame"), l.game); else games[l.game]($("#actGame")); }
  quiz($("#lq"), l.quiz.map(shuffleQ), { onDone: (r, n, res, box) => {
    const first = !S.done[l.id];
    S.done[l.id] = 1; save(); sideChapters();
    box.innerHTML = `<div class="q fade" style="text-align:center"><div style="font-size:44px">${r === n ? "🎉" : "👍"}</div><h3>${$t("a306")} ${r}/${n} ${$t("a307")}</h3><p class="small muted">${r === n ? $t("a308") : $t("a309")}</p>${next ? `<a class="btn" href="#/ls/${next}${$t("a303")}</a>` : `<a class="btn coral" href="#/boss/${c.id}${$t("a310")}</a>`}</div>`;
    if (first) { addXP(10 + r * 5, $t("a311")); badge("first"); mission("lesson"); if (r === n) confetti(); }
  }});
};
routes.boss = function (id) {
  const c = SS.chapters.find(x => x.id === +id); if (!c) return routes.quest();
  const qs = shuffle([].concat(...c.lessons.map(l => l.quiz))).map(shuffleQ);
  app.innerHTML = `<div class="fade"><div class="page-head"><div class="crumb"><a href="#/quest">${$t("a286")}</a> › <a href="#/ch/${c.id}">${c.id}${$t("a287")} ${c.title}</a> ${$t("a312")}</div><h1>${$t("a313")} ${c.title}</h1><p class="muted">${qs.length}${$t("a314")}</p></div><div id="bq"></div></div>`;
  quiz($("#bq"), qs, { label: $t("a315"), onDone: (r, n, res, box) => {
    const pct = Math.round(r / n * 100), clear = pct >= 60, best = S.boss[c.id] || 0;
    if (clear && pct > best) S.boss[c.id] = pct;
    save(); sideChapters();
    const over = res.filter(x => !x.ok && x.conf === 100).length;
    box.innerHTML = `<div class="card fade" style="text-align:center"><div style="font-size:60px">${clear ? "👑" : "💪"}</div><div class="score-big">${pct}%</div><p>${r}/${n} ${$t("a316")} ${clear ? $t("a318") : $t("a319")}</p>
      ${over ? `<p class="small"><span class="chip t">${$t("a320")} ${over}${$t("a321")}</span> ${$t("a322")}</p>` : ""}
      <div class="row" style="justify-content:center"><a class="btn ghost" href="#/ch/${c.id}${$t("a317")}</a><button class="btn re">${$t("a195")}</button>${c.id < 7 ? `<a class="btn" href="#/ch/${c.id + 1}${$t("a323")}</a>` : `<a class="btn" href="#/me">${$t("a324")}</a>`}</div></div>`;
    $(".re", box).onclick = () => routes.boss(id);
    if (clear) {
      confetti(); beep("win");
      if (xpOnce("boss" + c.id, 50, $t("a325"))) {} else addXP(r * 2, $t("a326"));
      badge("ch" + c.id); if (pct === 100) badge("perfect");
      if (SS.chapters.every(x => S.boss[x.id])) badge("all");
    }
  }});
};

/* ---------------- 과학 공부법 랩 ---------------- */
function lvTag(lv) { return `<span class="tag ${lv === $t("a328") ? "hi" : lv === $t("a329") ? "lo" : "mid"}${$t("a327")} ${lv}</span>`; }
function labCard(l) { return `<a class="lab-card" href="#/lab/${l.id}"><span class="em">${l.emoji}</span><b>${l.name}</b><span class="en">${l.en}</span>${lvTag(l.level)}<span class="small muted">${l.what.slice(0, 54)}…</span></a>`; }
routes.lab = function (id) {
  if (!id) {
    app.innerHTML = `<div class="fade"><div class="page-head"><h1>${$t("a330")}</h1><p class="muted">${$t("a331")}</p></div>
      <div class="grid g3">${SS.labs.map(labCard).join("")}</div>
      <div class="fact" style="margin-top:20px"><h4>${$t("a332")}</h4>${$t("a333")}<span class="small muted">${$t("a334")}</span></div></div>`;
    return;
  }
  const l = SS.labs.find(x => x.id === id); if (!l) return routes.lab();
  if (!S.labs[id]) { S.labs[id] = 1; save(); xpOnce("lab" + id, 5, $t("a335")); mission("lab"); if (Object.keys(S.labs).length >= 5) badge("labs"); }
  app.innerHTML = `<div class="fade"><div class="page-head"><div class="crumb"><a href="#/lab">${$t("a336")}</a> › ${l.name}</div><h1>${l.emoji} ${l.name} <span class="muted" style="font-size:16px">${l.en}</span></h1>${lvTag(l.level)}</div>
    <div class="grid g2"><div class="card"><h3>${$t("a337")}</h3><p style="margin:0">${l.what}</p></div><div class="card"><h3>${$t("a338")}</h3><p style="margin:0">${l.why}</p></div></div>
    <div class="card" style="margin-top:16px"><h3>${$t("a339")}</h3><ol class="steps">${l.how.map(h => `<li>${h}</li>`).join("")}</ol></div>
    <div class="act" id="demo"></div>
    <div class="row" style="margin-top:14px"><a class="btn line" href="#/lab">${$t("a340")}</a></div></div>`;
  demos[l.demo]($("#demo"));
};
const demos = {
  braindump(el) {
    let left = 180, iv = null;
    el.innerHTML = `<h3>${$t("a341")}</h3><p class="small muted">${$t("a342")}</p>
      <div class="grid g2"><input class="tp" placeholder="${$t("a343")}"><div class="row"><button class="btn st">${$t("a344")}</button><b class="tm" style="font-size:22px;font-variant-numeric:tabular-nums">3:00</b></div></div>
      <textarea class="w1" placeholder="${$t("a345")}" style="margin-top:10px;min-height:150px"></textarea>
      <div class="p2" style="display:none"><h4>${$t("a346")}</h4><textarea class="w2" placeholder="${$t("a347")}"></textarea><button class="btn mint sv" style="margin-top:8px">${$t("a348")}</button></div><div class="res"></div>`;
    const tm = $(".tm", el);
    $(".st", el).onclick = () => {
      if (iv) return; $(".w1", el).focus();
      iv = setInterval(() => { left--; tm.textContent = Math.floor(left / 60) + ":" + pad(left % 60); if (left <= 0) { clearInterval(iv); beep("bell"); tm.textContent = $t("a349"); $(".p2", el).style.display = "block"; } }, 1000);
      $(".st", el).textContent = $t("a350");
      setTimeout(() => { $(".p2", el).style.display = "block"; }, 3000);
    };
    $(".sv", el).onclick = () => {
      const w1 = $(".w1", el).value.trim(); if (!w1) { toast($t("a351")); return; }
      S.dumps.unshift({ d: today(), t: $(".tp", el).value, a: w1, m: $(".w2", el).value }); S.dumps = S.dumps.slice(0, 30); save();
      clearInterval(iv); mission("dump"); addXP(15, $t("a352"));
      $(".res", el).innerHTML = `<div class="exp">${$t("a353")}${w1.split(/\s+/).length}${$t("a354")} <a href="#/tool/cards">${$t("a355")}</a></div>`;
    };
  },
  curve(el) {
    el.innerHTML = `<h3>${$t("a356")}</h3><p class="small muted">${$t("a357")}</p>
      <div class="row"><button class="btn sm ghost" data-p="none">${$t("a358")}</button><button class="btn sm ghost" data-p="cram">${$t("a359")}</button><button class="btn sm ghost" data-p="space">${$t("a360")}</button></div>
      <div class="row small" style="margin-top:8px">${$t("a361")} <input class="dd" type="number" min="1" max="29" value="5" style="width:80px"> ${$t("a362")} <button class="btn sm add">${$t("a363")}</button> <button class="btn sm line clr">${$t("a364")}</button></div>
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
      [0, 7, 14, 21, 30].forEach(v => g += `<text x="${X(v)}" y="238" font-size="11" text-anchor="middle" fill="#888">${v}${$t("a365")}</text>`);
      g += `<path d="${pts.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join("")}" fill="none" stroke="#6C5CE7" stroke-width="3"/>`;
      reviews.forEach(d => g += `<circle cx="${X(d)}" cy="${Y(1)}" r="5" fill="#00B894"/><text x="${X(d)}${$t("a366")}</text>`);
      g += `<text x="300" y="255" font-size="11" text-anchor="middle" fill="#888">${$t("a367")}</text>`;
      $(".cv", el).innerHTML = g;
      const end = pts[pts.length - 1][1], avg = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      $(".res", el).innerHTML = `<div class="exp">${$t("a368")}${Math.round(end * 100)}${$t("a369")}${Math.round(avg * 100)}${$t("a370")} ${reviews.length}${$t("a371")}<span class="small">${$t("a372")}</span></div>`;
    }
    $$("[data-p]", el).forEach(b => b.onclick = () => { reviews = b.dataset.p === "none" ? [] : b.dataset.p === "cram" ? [29, 29.3, 29.6] : [1, 3, 7, 14, 29]; draw(); });
    $(".add", el).onclick = () => { const d = Math.max(1, Math.min(29, +$(".dd", el).value)); if (!reviews.includes(d)) reviews.push(d); reviews.sort((a, b) => a - b); draw(); };
    $(".clr", el).onclick = () => { reviews = []; draw(); };
    draw();
  },
  interleave(el) { scenarioGame(el, "interleave"); el.insertAdjacentHTML("beforeend", `<p class="small muted" style="margin-top:8px">${$t("a373")}</p>`); },
  why(el) {
    el.innerHTML = `<h3>${$t("a374")}</h3><input class="cp" placeholder="${$t("a375")}"><div class="out" style="margin-top:12px"></div>`;
    $(".cp", el).oninput = e => {
      const c = e.target.value.trim(); if (!c) { $(".out", el).innerHTML = ""; return; }
      const qs = [1, 2, 3, 4, 5, 6].map(i => $f("why" + i, c));
      $(".out", el).innerHTML = qs.map((q, i) => `<div style="margin-bottom:10px"><b>Q${i + 1}. ${esc(q)}</b><textarea style="min-height:50px;margin-top:4px" placeholder="${$t("a384")}"></textarea></div>`).join("") + `<p class="small muted">${$t("a385")}</p>`;
    };
  },
  example(el) { scenarioGame(el, "example"); },
  draw(el) {
    const prompts = [$t("a386"), $t("a387"), $t("a388"), $t("a389"), $t("a390"), $t("a391"), $t("a392"), $t("a393")];
    el.innerHTML = `<h3>${$t("a394")}</h3><p class="small muted">${$t("a395")}</p>
      <div class="row"><select class="pr" style="width:auto">${prompts.map(p => `<option>${p}</option>`).join("")}</select>
      ${["#1E1B3A", "#6C5CE7", "#00B894", "#FF7675", "#FDCB6E", "#0984E3"].map(c => `<button class="btn sm col" data-c="${c}" style="background:${c};width:30px;height:30px;padding:0"></button>`).join("")}
      <button class="btn sm line er">${$t("a396")}</button><button class="btn sm line cl">${$t("a397")}</button><button class="btn sm ghost dl">${$t("a398")}</button></div>
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
    $(".dl", el).onclick = () => { cv.toBlob(b => saveFile("dual-coding-" + $(".pr", el).value + ".png", b), "image/png"); xpOnce("draw" + today(), 10, $t("a399")); };
  },
  feynman(el) {
    el.innerHTML = `<h3>${$t("a400")}</h3>
      <label class="small">${$t("a401")}<input class="f1" placeholder="${$t("a402")}"></label>
      <label class="small">${$t("a403")}<textarea class="f2"></textarea></label>
      <label class="small">${$t("a404")}<textarea class="f3" style="min-height:60px"></textarea></label>
      <label class="small">${$t("a405")}<textarea class="f4" style="min-height:60px" placeholder="${$t("a406")}"></textarea></label>
      <button class="btn mint sv" style="margin-top:8px">${$t("a277")}</button><div class="list" style="margin-top:12px"></div>`;
    const list = () => $(".list", el).innerHTML = S.feynman.length ? `<h4>${$t("a407")}</h4>` + S.feynman.map(f => `<div class="exp"><b>${esc(f.c)}</b> <span class="small muted">${f.d}</span><br>${esc(f.s).slice(0, 200)}</div>`).join("") : "";
    $(".sv", el).onclick = () => { const c = $(".f1", el).value.trim(), s = $(".f2", el).value.trim(); if (!c || !s) { toast($t("a408")); return; } S.feynman.unshift({ d: today(), c, s, g: $(".f3", el).value, v: $(".f4", el).value }); S.feynman = S.feynman.slice(0, 30); save(); addXP(15, $t("a409")); list(); };
    list();
  },
  calib(el) {
    const c = calib();
    el.innerHTML = `<h3>${$t("a410")}</h3>` + (!c || c.n < 3 ? `<p>${$t("a411")}</p><a class="btn" href="#/quest">${$t("a412")}</a>` :
      `<div class="grid g4"><div class="stat"><b>${c.score}</b><small>${$t("a413")}</small></div><div class="stat"><b>${c.acc}%</b><small>${$t("a414")}</small></div><div class="stat"><b>${c.conf}%</b><small>${$t("a415")}</small></div><div class="stat"><b>${c.n}</b><small>${$t("a416")}</small></div></div>
      <div class="exp" style="margin-top:12px">${c.conf - c.acc > 10 ? $t("a421") : c.acc - c.conf > 10 ? $t("a422") : $t("a423")}
      ${$t("a417")}${c.over}${$t("a418")}${c.under}${$t("a419")}</div>
      <p class="small muted">${$t("a420")}</p>`);
  },
  woop(el) { goalForms(el, true); },
  rank(el) {
    sortGame(el, { title: $t("a424"), buckets: [$t("a328"), $t("a425"), $t("a329")], items: [
      [$t("a426"), 0], [$t("a427"), 0], [$t("a428"), 1], [$t("a429"), 1],
      [$t("a430"), 1], [$t("a431"), 2], [$t("a432"), 2], [$t("a433"), 2], [$t("a434"), 2]
    ]}, r => xpOnce("rankgame", 10, $t("a435")));
  }
};

/* ---------------- 도구함 ---------------- */
const TOOLS = [
  { id: "timer", emoji: "🍅", name: $t("a436"), desc: $t("a437") },
  { id: "cards", emoji: "🃏", name: $t("a438"), desc: $t("a439") },
  { id: "exam", emoji: "📅", name: $t("a440"), desc: $t("a441") },
  { id: "goal", emoji: "🎯", name: $t("a442"), desc: $t("a443") },
  { id: "todo", emoji: "✅", name: $t("a444"), desc: $t("a445") },
  { id: "week", emoji: "🗓️", name: $t("a446"), desc: $t("a447") },
  { id: "pie", emoji: "🥧", name: $t("a448"), desc: $t("a449") },
  { id: "cornell", emoji: "📓", name: $t("a450"), desc: $t("a451") },
  { id: "mindmap", emoji: "🧠", name: $t("a452"), desc: $t("a453") },
  { id: "mnemonic", emoji: "🔤", name: $t("a454"), desc: $t("a455") },
  { id: "essay", emoji: "✍️", name: $t("a456"), desc: $t("a457") },
  { id: "breath", emoji: "🌬️", name: $t("a458"), desc: $t("a459") },
  { id: "journal", emoji: "📔", name: $t("a460"), desc: $t("a461") }
];
routes.tools = function () {
  app.innerHTML = `<div class="fade"><div class="page-head"><h1>${$t("a462")}</h1><p class="muted">${$t("a463")}</p></div>
    <div class="toolgrid">${TOOLS.map(t => `<a class="tool" href="#/tool/${t.id}"><b>${t.emoji}</b><h3>${t.name}</h3><p>${t.desc}</p></a>`).join("")}</div></div>`;
};
routes.tool = function (id) {
  const t = TOOLS.find(x => x.id === id); if (!t) return routes.tools();
  app.innerHTML = `<div class="fade"><div class="page-head"><div class="crumb"><a href="#/tools">${$t("a464")}</a> › ${t.name}</div><h1>${t.emoji} ${t.name}</h1></div><div id="tl"></div></div>`;
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
      addXP(20, $t("a465") + T.f + $t("a466")); mission("pomo"); badge("pomo1"); if (S.pomo.count >= 10) badge("pomo10");
      T.cyc++; T.mode = "break"; T.total = T.left = (T.cyc % 4 === 0 ? T.b * 3 : T.b) * 60;
      toast(T.cyc % 4 === 0 ? $t("a467") : $t("a468"));
    } else { T.mode = "focus"; T.total = T.left = T.f * 60; toast($t("a469")); }
  }
  timerHud(); const f = $("#tFace"); if (f) drawTimer();
}
function drawTimer() {
  const el = $("#tFace"); if (!el) return;
  const pct = T.left / T.total, C = 2 * Math.PI * 118;
  el.innerHTML = `<svg viewBox="0 0 260 260"><circle cx="130" cy="130" r="118" stroke="#ECE8FF" stroke-width="16" fill="none"/><circle cx="130" cy="130" r="118" stroke="${T.mode === "focus" ? "#FF7675" : "#00B894"}" stroke-width="16" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg>
    <div><div class="m">${T.mode === "focus" ? $t("a471") : $t("a472")} ${$t("a470")} ${T.cyc % 4 + 1}/4</div><div class="t">${Math.floor(T.left / 60)}:${pad(T.left % 60)}</div></div>`;
  const b = $("#tStart"); if (b) b.textContent = T.run ? $t("a473") : $t("a474");
}
const tools = {
  timer(el) {
    el.innerHTML = `<div class="grid g2"><div class="card" style="text-align:center">
      <div class="row" style="justify-content:center">${[[25, 5], [50, 10], [15, 3]].map(p => `<button class="btn sm ghost ps" data-f="${p[0]}" data-b="${p[1]}">${p[0]}/${p[1]}</button>`).join("")}</div>
      <div class="timer-face" id="tFace"></div>
      ${$t("a475")}${esc(T.label)}" style="max-width:340px">
      <div class="row" style="justify-content:center;margin-top:12px"><button class="btn" id="tStart">${$t("a474")}</button><button class="btn line" id="tReset">${$t("a476")}</button><button class="btn line" id="tSkip">${$t("a477")}</button></div></div>
      <div class="card"><h3>${$t("a478")}</h3><ol class="steps"><li>${$t("a479")}</li><li>${$t("a480")}</li><li>${$t("a481")}</li><li>${$t("a482")}</li></ol>
      <div class="tip">${$t("a483")}</div>
      <h4>${$t("a484")} ${S.pomo.count}${$t("a485")}</h4>${S.pomo.log.slice(0, 6).map(x => `<div class="small">✅ ${x.d} · ${x.m}${$t("a486")} ${esc(x.l || "")}</div>`).join("") || $t("a487")}</div></div>`;
    drawTimer();
    $("#tLabel").oninput = e => T.label = e.target.value;
    $("#tStart").onclick = () => { if (T.run) { clearInterval(T.iv); T.run = false; } else { T.run = true; T.iv = setInterval(timerTick, 1000); beep("ok"); } drawTimer(); };
    $("#tReset").onclick = () => { clearInterval(T.iv); T.run = false; T.mode = "focus"; T.total = T.left = T.f * 60; drawTimer(); };
    $("#tSkip").onclick = () => { T.left = 1; if (!T.run) { T.run = true; T.iv = setInterval(timerTick, 1000); } };
    $$(".ps", el).forEach(b => b.onclick = () => { if (T.run) { toast($t("a488")); return; } T.f = +b.dataset.f; T.b = +b.dataset.b; T.mode = "focus"; T.total = T.left = T.f * 60; drawTimer(); });
  },
  cards(el) {
    if (!S.decks) { S.decks = [{ id: uid(), name: $t("a489"), cards: [
      [$t("a490"), $t("a491")], [$t("a492"), $t("a493")], [$t("a494"), $t("a495")],
      [$t("a496"), $t("a497")], [$t("a498"), $t("a499")], [$t("a500"), $t("a501")],
      [$t("a502"), $t("a503")], ["SQ3R", $t("a504")], [$t("a505"), $t("a506")],
      [$t("a507"), $t("a508")], [$t("a450"), $t("a509")], [$t("a510"), $t("a511")]
    ].map(([f, b]) => ({ id: uid(), f, b, box: 1, due: today() })) }]; save(); }
    let deck = S.decks[0], queue = [], cur = null, sess = 0;
    const INT = [0, 1, 2, 4, 8, 16];
    function render() {
      const due = deck.cards.filter(c => c.due <= today());
      el.innerHTML = `<div class="grid g2"><div class="card">
        <div class="row"><select class="dk" style="flex:1">${S.decks.map(d => `<option value="${d.id}" ${d.id === deck.id ? "selected" : ""}>${esc(d.name)} (${d.cards.length})</option>`).join("")}</select><button class="btn sm ghost nd">${$t("a512")}</button></div>
        <div class="boxes" style="margin-top:12px">${[1, 2, 3, 4, 5].map(b => `<div><b>${deck.cards.filter(c => c.box === b).length}</b>${b}${$t("a528")}<span style="font-size:10px">${INT[b]}${$t("a529")}</span></div>`).join("")}</div>
        <div class="rv" style="margin-top:12px"></div>
        <div class="row" style="margin-top:8px"><button class="btn st" ${due.length ? "" : "disabled"}${$t("a513")}${due.length}${$t("a514")}</button><button class="btn line all" ${deck.cards.length ? "" : "disabled"}${$t("a515")}</button></div>
        <p class="small muted">${$t("a516")} ${S.cToday.d === today() ? S.cToday.n : 0}${$t("a517")} ${S.cardReviews}${$t("u_cards")}</p></div>
        <div class="card"><h3>${$t("a518")}</h3><input class="cf" placeholder="${$t("a519")}"><textarea class="cb" placeholder="${$t("a520")}" style="min-height:60px;margin-top:6px"></textarea><button class="btn sm ad" style="margin-top:6px">${$t("a521")}</button>
        <details style="margin-top:12px"><summary class="small">${$t("a522")}</summary><p class="small muted">${$t("a523")}</p><textarea class="bulk" placeholder="${$t("a524")}"></textarea><button class="btn sm bk">${$t("a525")}</button></details>
        <details style="margin-top:8px"><summary class="small">${$t("a526")}</summary>${deck.cards.map(c => `<div class="todo-item"><span class="small"><b>${esc(c.f)}</b> — ${esc(c.b)} <span class="chip">${c.box}${$t("a530")}</span></span><button class="x" data-del="${c.id}">×</button></div>`).join("")}<button class="btn sm coral dd" style="margin-top:6px">${$t("a527")}</button></details></div></div>`;
      $(".dk", el).onchange = e => { deck = S.decks.find(d => d.id === e.target.value); render(); };
      $(".nd", el).onclick = () => { const n = prompt($t("a531"), $t("a532")); if (n) { const d = { id: uid(), name: n.slice(0, 30), cards: [] }; S.decks.push(d); deck = d; save(); render(); } };
      $(".ad", el).onclick = () => { const f = $(".cf", el).value.trim(), b = $(".cb", el).value.trim(); if (!f || !b) return toast($t("a533")); deck.cards.push({ id: uid(), f, b, box: 1, due: today() }); save(); render(); toast($t("a534")); };
      $(".bk", el).onclick = () => { let n = 0; $(".bulk", el).value.split("\n").forEach(line => { const p = line.split(/\s*\|\s*|\t/); if (p.length >= 2 && p[0].trim() && p[1].trim()) { deck.cards.push({ id: uid(), f: p[0].trim(), b: p.slice(1).join(" ").trim(), box: 1, due: today() }); n++; } }); save(); render(); toast(n + $t("a535")); };
      $$("[data-del]", el).forEach(b => b.onclick = () => { deck.cards = deck.cards.filter(c => c.id !== b.dataset.del); save(); render(); });
      $(".dd", el).onclick = () => { if (S.decks.length < 2) return toast($t("a536")); if (confirm($t("a537"))) { S.decks = S.decks.filter(d => d !== deck); deck = S.decks[0]; save(); render(); } };
      $(".st", el).onclick = () => { queue = shuffle(due); sess = 0; next(); };
      $(".all", el).onclick = () => { queue = shuffle(deck.cards); sess = 0; next(true); };
    }
    let practice = false;
    function next(p) {
      if (p !== undefined) practice = p;
      const rv = $(".rv", el); cur = queue.shift();
      if (!cur) { rv.innerHTML = `<div class="exp">${$t("a538")} ${sess}${$t("a539")}</div>`; setTimeout(render, 1600); return; }
      rv.innerHTML = `<div class="small muted">${$t("a540")} ${queue.length + 1}${$t("a541")}</div>
        <div class="flash"><div class="flash-in"><div class="flash-f">${esc(cur.f)}</div><div class="flash-b">${esc(cur.b)}</div></div></div>
        <div class="row ab"><button class="btn fl">${$t("a542")}</button></div>`;
      const fl = $(".flash", rv); const flip = () => { fl.classList.add("flip"); $(".ab", rv).innerHTML = `<button class="btn coral no">${$t("a543")}</button><button class="btn mint yes">${$t("a544")}</button>`; $(".no", rv).onclick = () => grade(false); $(".yes", rv).onclick = () => grade(true); };
      fl.onclick = flip; $(".fl", rv).onclick = flip;
    }
    function grade(ok) {
      sess++; S.cardReviews++; if (S.cToday.d !== today()) S.cToday = { d: today(), n: 0 }; S.cToday.n++;
      if (!practice) { if (ok) { cur.box = Math.min(5, cur.box + 1); cur.due = addDays(today(), INT[cur.box]); } else { cur.box = 1; cur.due = today(); queue.push(cur); } }
      save(); ok ? beep("ok") : beep("bad");
      if (S.cToday.n === 10) mission("cards");
      if (S.cardReviews >= 50) badge("cards50");
      if (sess % 5 === 0) addXP(10, $t("a545"));
      next();
    }
    render();
  },
  exam(el) {
    const P = S.examPlan || { name: "", date: addDays(today(), 14), units: "" };
    el.innerHTML = `<div class="grid g2"><div class="card noprint"><h3>${$t("a546")}</h3>
      <label class="small">${$t("a547")}${esc(P.name)}${$t("a548")}</label>
      <label class="small">${$t("a549")}${P.date}"></label>
      <label class="small">${$t("a550")}<textarea class="un" placeholder="${$t("a551")}">${esc(P.units)}</textarea></label>
      <button class="btn mk" style="margin-top:8px">${$t("a552")}</button></div>
      <div class="card"><h3>${$t("a553")}</h3><p class="small">${$t("a554")}</p><p class="small muted">${$t("a555")}</p></div></div>
      <div class="card" style="margin-top:16px" id="plan"></div>`;
    function make(save_) {
      const name = $(".nm", el).value.trim(), date = $(".dt", el).value, units = $(".un", el).value.split("\n").map(s => s.trim()).filter(Boolean);
      const D = diffDays(today(), date);
      if (save_) { S.examPlan = { name, date, units: units.join("\n") }; save(); }
      if (!units.length) { $("#plan").innerHTML = `<p class="muted">${$t("a556")}</p>`; return; }
      if (D < 2) { $("#plan").innerHTML = `<p>${$t("a557")}</p>`; return; }
      const days = {}; const put = (d, html) => { (days[d] = days[d] || []).push(html); };
      const learnSpan = Math.max(1, Math.floor((D - 1) * 0.55));
      units.forEach((u, i) => {
        const first = Math.min(D - 2, Math.floor(i * learnSpan / units.length));
        put(first, `<span class="chip">${$t("a558")} ${esc(u)}</span>`);
        [1, 3, 7, 14].forEach(g => { const r = first + g; if (r <= D - 2) put(r, `<span class="chip r">${$t("a559")} ${esc(u)}</span>`); });
      });
      put(D - 1, `<span class="chip t">${$t("a560")}</span>`);
      let rows = ""; for (let d = 0; d < D; d++) if (days[d]) rows += `<tr><td style="white-space:nowrap"><b>${fmtDate(addDays(today(), d))}</b><br><span class="small muted">D-${D - d}</span></td><td>${days[d].join(" ")}</td><td style="width:30px"><input type="checkbox" style="width:auto"></td></tr>`;
      $("#plan").innerHTML = `<div class="row" style="justify-content:space-between"><h3 style="margin:0">📅 ${esc(name || $t("a565"))} ${$t("a561")} ${fmtDate(date)} (D-${D})</h3><button class="btn sm line noprint" onclick="window.print()">${$t("a562")}</button></div><table class="plan" style="margin-top:10px"><tr><th>${$t("a563")}</th><th>${$t("a564")}</th><th>✔</th></tr>${rows}</table>`;
      if (save_) { badge("planner"); xpOnce("exam" + date + units.length, 15, $t("a566")); }
    }
    $(".mk", el).onclick = () => make(true);
    if (S.examPlan) make(false); else $("#plan").innerHTML = `<p class="muted">${$t("a567")}</p>`;
  },
  goal(el) { goalForms(el, false); },
  todo(el) {
    function render() {
      const list = S.todos.slice().sort((a, b) => (a.done - b.done) || a.p.localeCompare(b.p) || (a.due || "9").localeCompare(b.due || "9"));
      el.innerHTML = `<div class="grid g2"><div class="card"><h3>${$t("a568")}</h3>
        <div class="row"><select class="pp" style="width:auto"><option value="A">${$t("a569")}</option><option value="B">${$t("a570")}</option><option value="C">${$t("a571")}</option></select><input class="tx" placeholder="${$t("a564")}" style="flex:1;min-width:140px"><input class="du" type="date" style="width:auto"><button class="btn sm ad">${$t("a521")}</button></div>
        <div style="margin-top:12px">${list.map(t => `<div class="todo-item ${t.done ? "done" : ""}"><input type="checkbox" data-t="${t.id}" ${t.done ? "checked" : ""} style="width:auto"><span class="prio ${t.p}">${t.p}</span><span>${esc(t.t)} ${t.due ? `<span class="chip">${fmtDate(t.due)}</span>` : ""}</span><button class="x" data-del="${t.id}">×</button></div>`).join("") || $t("a578")}</div>
        ${S.todos.some(t => t.done) ? `<button class="btn sm line cl">${$t("a579")}</button>` : ""}</div>
        <div class="card"><h3>${$t("a572")}</h3><p class="small muted">${$t("a573")}</p>
        <div class="grid g2"><label class="small">${$t("a574")}${addDays(today(), 14)}"></label><label class="small">${$t("a575")}<input class="bf" type="number" value="2"></label></div>
        <textarea class="bs" style="margin-top:6px">${$t("a576")}</textarea>
        <button class="btn sm bc" style="margin-top:6px">${$t("a577")}</button><div class="bo" style="margin-top:10px"></div></div></div>`;
      $(".ad", el).onclick = () => { const t = $(".tx", el).value.trim(); if (!t) return; S.todos.push({ id: uid(), t, p: $(".pp", el).value, due: $(".du", el).value, done: 0 }); save(); render(); };
      $(".tx", el).onkeydown = e => { if (e.key === "Enter") $(".ad", el).click(); };
      $$("[data-t]", el).forEach(c => c.onchange = () => { const t = S.todos.find(x => x.id === c.dataset.t); t.done = c.checked ? 1 : 0; if (t.done && !t.xp) { t.xp = 1; addXP(t.p === "A" ? 5 : 3, $t("a580")); } save(); render(); });
      $$("[data-del]", el).forEach(b => b.onclick = () => { S.todos = S.todos.filter(x => x.id !== b.dataset.del); save(); render(); });
      const cl = $(".cl", el); if (cl) cl.onclick = () => { S.todos = S.todos.filter(x => !x.done); save(); render(); };
      $(".bc", el).onclick = () => {
        const dl = $(".bd", el).value, buf = +$(".bf", el).value || 0;
        const steps = $(".bs", el).value.split("\n").map(l => { const m = l.split(/,\s*/); return { n: m[0].trim(), d: Math.max(1, +m[1] || 1) }; }).filter(s => s.n);
        let end = addDays(dl, -buf); const out = [];
        for (let i = steps.length - 1; i >= 0; i--) { const st = addDays(end, -steps[i].d + 1); out.unshift({ ...steps[i], s: st, e: end }); end = addDays(st, -1); }
        const late = out.length && out[0].s < today();
        $(".bo", el).innerHTML = `<table class="plan"><tr><th>${$t("a581")}</th><th>${$t("a582")}</th><th>${$t("a583")}</th></tr>${out.map(o => `<tr><td>${esc(o.n)}</td><td>${fmtDate(o.s)}</td><td>${fmtDate(o.e)}</td></tr>`).join("")}<tr><td>${$t("a584")}</td><td colspan="2">${buf}${$t("a585")} ${fmtDate(dl)}</td></tr></table>
          ${late ? `<p class="small" style="color:#B33">${$t("a587")}</p>` : ""}<button class="btn sm ghost tt">${$t("a586")}</button>`;
        $(".tt", el).onclick = () => { out.forEach(o => S.todos.push({ id: uid(), t: o.n, p: "A", due: o.e, done: 0 })); save(); render(); toast($t("a588")); };
      };
    }
    render();
  },
  week(el) {
    const CAT = [["study", $t("a589"), "#6C5CE7"], ["class", $t("a590"), "#0984E3"], ["ex", $t("a591"), "#00B894"], ["rest", $t("a592"), "#FDCB6E"], ["meal", $t("a593"), "#E17055"], ["sleep", $t("a594"), "#636E72"], ["etc", $t("a206"), "#B2BEC3"], ["", $t("a396"), "#ddd"]];
    let brush = "study", down = false;
    const days = [$t("a595"), $t("a596"), $t("a597"), $t("a598"), $t("a599"), $t("a600"), $t("w_sun")], hours = Array.from({ length: 18 }, (_, i) => i + 6);
    function render() {
      const cnt = {}; Object.values(S.week).forEach(v => cnt[v] = (cnt[v] || 0) + 1);
      el.innerHTML = `<div class="card"><div class="row noprint" style="justify-content:space-between"><div class="brush">${CAT.map(c => `<button data-b="${c[0]}" class="${brush === c[0] ? "on" : ""}" style="background:${c[2]};${c[0] ? "" : "color:#333"}">${c[1]}</button>`).join("")}</div><div class="row"><button class="btn sm line pr" onclick="window.print()">${$t("a562")}</button><button class="btn sm line rs">${$t("a364")}</button></div></div>
        <p class="small muted noprint">${$t("a601")}</p>
        <div class="week"><table><tr><th></th>${days.map(d => `<th>${d}</th>`).join("")}</tr>${hours.map(h => `<tr><td class="h">${h}:00</td>${days.map((d, i) => { const k = i + "-" + h, v = S.week[k], c = CAT.find(x => x[0] === v); return `<td data-k="${k}" style="background:${c ? c[2] : "#fff"};color:#fff">${c ? c[1].slice(0, 2) : ""}</td>`; }).join("")}</tr>`).join("")}</table></div>
        <div class="row" style="margin-top:10px">${CAT.filter(c => c[0]).map(c => `<span class="chip" style="background:${c[2]}22;color:#333">${c[1]} ${cnt[c[0]] || 0}${$t("a602")}</span>`).join("")}</div>
        ${(cnt.study || 0) > 0 && !(cnt.rest || cnt.ex) ? `<div class="tip">${$t("a603")}</div>` : ""}</div>`;
      $$("[data-b]", el).forEach(b => b.onclick = () => { brush = b.dataset.b; render(); });
      const paint = td => { if (!td || !td.dataset.k) return; if (brush) S.week[td.dataset.k] = brush; else delete S.week[td.dataset.k]; const c = CAT.find(x => x[0] === brush); td.style.background = brush ? c[2] : "#fff"; td.textContent = brush ? c[1].slice(0, 2) : ""; };
      $$("td[data-k]", el).forEach(td => { td.onmousedown = e => { down = true; paint(td); e.preventDefault(); }; td.onmouseenter = () => { if (down) paint(td); }; td.ontouchstart = () => paint(td); });
      document.onmouseup = () => { if (down) { down = false; save(); render(); xpOnce("week" + today(), 10, $t("a604")); } };
      $(".rs", el).onclick = () => { if (confirm($t("a605"))) { S.week = {}; save(); render(); } };
    }
    render();
  },
  pie(el) {
    const CAT = [[$t("a594"), "#636E72", 8, 9], [$t("a606"), "#0984E3", 7, 7], [$t("a589"), "#6C5CE7", 2, 3], [$t("a593"), "#E17055", 1.5, 1.5], [$t("a607"), "#B2BEC3", 1, 1], [$t("a591"), "#00B894", 0.5, 1], [$t("a608"), "#FD79A8", 3, 1], [$t("a609"), "#FDCB6E", 1, 0.5]];
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
      el.innerHTML = `<div class="grid g2"><div class="card"><h3>${$t("a610")}</h3><p class="small muted">${$t("a611")}</p>
        <table class="plan"><tr><th>${$t("a612")}</th><th>${$t("a613")}</th><th>${$t("a614")}</th></tr>${CAT.map((c, i) => `<tr><td><span class="chip" style="background:${c[1]};color:#fff">${c[0]}</span></td><td><input type="number" step="0.5" min="0" data-a="now" data-i="${i}" value="${P.now[i]}" style="width:80px;padding:6px"></td><td><input type="number" step="0.5" min="0" data-a="goal" data-i="${i}" value="${P.goal[i]}" style="width:80px;padding:6px"></td></tr>`).join("")}
        <tr><td>${$t("a615")}</td><td style="color:${sn === 24 ? "#00805f" : "#B33"}"><b>${sn}h</b></td><td style="color:${sg === 24 ? "#00805f" : "#B33"}"><b>${sg}h</b></td></tr></table></div>
        <div class="card"><div class="grid g2"><div><h4 style="text-align:center">${$t("a613")}</h4>${svg(P.now.map(Number))}</div><div><h4 style="text-align:center">${$t("a614")}</h4>${svg(P.goal.map(Number))}</div></div>
        <div class="tip">${$t("a616")} ${sn !== 24 ? $t("a617") : ""}</div></div></div>`;
      $$("input[data-a]", el).forEach(i => i.onchange = () => { P[i.dataset.a][+i.dataset.i] = Math.max(0, +i.value || 0); S.pie = P; save(); render(); xpOnce("pie", 10, $t("a618")); });
    }
    render();
  },
  cornell(el) {
    let cur = { id: uid(), t: "", d: today(), c: "", n: "", s: "" }, test = false;
    function render() {
      el.innerHTML = `<div class="card"><div class="row noprint" style="justify-content:space-between"><div class="row"><button class="btn sm ghost nw">${$t("a619")}</button><select class="ld" style="width:auto"><option value="">${$t("a620")}${S.cornell.length})</option>${S.cornell.map(n => `<option value="${n.id}">${esc(n.t || $t("a629"))} · ${n.d}</option>`).join("")}</select></div>
        <div class="row"><button class="btn sm ${test ? "coral" : "line"} ts">${test ? $t("a630") : $t("a631")}</button><button class="btn sm line" onclick="window.print()">🖨️</button><button class="btn sm mint sv">${$t("a621")}</button></div></div>
        <div class="grid g2" style="margin:10px 0">${$t("a622")}${esc(cur.t)}"><input class="d" type="date" value="${cur.d}"></div>
        <div class="cornell"><div class="cue"><label>${$t("a623")}</label><textarea class="c" placeholder="${$t("a624")}">${esc(cur.c)}</textarea></div>
        <div><label>${$t("a625")}</label>${$t("a626")}${test ? "filter:blur(6px)" : ""}">${esc(cur.n)}</textarea></div>
        <div class="sum"><label>${$t("a627")}</label><textarea class="s">${esc(cur.s)}</textarea></div></div>
        <p class="small muted noprint">${$t("a628")}</p></div>`;
      const sync = () => { cur.t = $(".t", el).value; cur.d = $(".d", el).value; cur.c = $(".c", el).value; cur.n = $(".n", el).value; cur.s = $(".s", el).value; };
      $(".sv", el).onclick = () => { sync(); if (!cur.n.trim() && !cur.c.trim()) return toast($t("a632")); const i = S.cornell.findIndex(x => x.id === cur.id); if (i >= 0) S.cornell[i] = { ...cur }; else S.cornell.unshift({ ...cur }); save(); xpOnce("cornell" + cur.id, 15, $t("a450")); render(); toast($t("a633")); };
      $(".nw", el).onclick = () => { cur = { id: uid(), t: "", d: today(), c: "", n: "", s: "" }; render(); };
      $(".ld", el).onchange = e => { const n = S.cornell.find(x => x.id === e.target.value); if (n) { cur = { ...n }; render(); } };
      $(".ts", el).onclick = () => { sync(); test = !test; render(); };
    }
    render();
  },
  mindmap(el) {
    const M = S.mindmap || { c: $t("a634"), b: [{ t: $t("a635"), k: $t("a636") }, { t: $t("a637"), k: $t("a638") }, { t: $t("a639"), k: $t("a640") }, { t: $t("a641"), k: $t("a642") }] };
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
      el.innerHTML = `<div class="grid"><div class="card noprint"><label class="small">${$t("a643")}${esc(M.c)}"></label>
        <h4 style="margin:12px 0 6px">${$t("a644")}</h4>${M.b.map((b, i) => `<div class="row" style="margin-bottom:6px"><input data-t="${i}" value="${esc(b.t)}" style="width:110px;flex:none"><input data-k="${i}" value="${esc(b.k)}" style="flex:1"><button class="x" data-del="${i}">×</button></div>`).join("")}
        <div class="row"><button class="btn sm ghost ab" ${M.b.length >= 8 ? "disabled" : ""}${$t("a645")}</button><button class="btn sm mint sv">${$t("a621")}</button><button class="btn sm line dl">⬇️ SVG</button><button class="btn sm line" onclick="window.print()">🖨️</button></div>
        <div class="tip small">${$t("a646")}</div></div>
        <div class="card">${svg()}</div></div>`;
      $(".cc", el).oninput = e => { M.c = e.target.value; $(".mm", el).outerHTML = svg(); };
      $$("[data-t]", el).forEach(i => i.oninput = () => { M.b[+i.dataset.t].t = i.value; $(".mm", el).outerHTML = svg(); });
      $$("[data-k]", el).forEach(i => i.oninput = () => { M.b[+i.dataset.k].k = i.value; $(".mm", el).outerHTML = svg(); });
      $$("[data-del]", el).forEach(b => b.onclick = () => { M.b.splice(+b.dataset.del, 1); render(); });
      $(".ab", el).onclick = () => { M.b.push({ t: $t("a647"), k: "" }); render(); };
      $(".sv", el).onclick = () => { S.mindmap = M; save(); xpOnce("mm" + today(), 15, $t("a648")); toast($t("a633")); };
      $(".dl", el).onclick = () => saveFile("mindmap-" + M.c + ".svg", new Blob([$(".mm", el).outerHTML], { type: "image/svg+xml" }));
    }
    render();
  },
  mnemonic(el) {
    function render() {
      el.innerHTML = `<div class="grid g2"><div class="card"><h3>${$t("a649")}</h3><p class="small muted">${$t("a650")}</p>
        <textarea class="it" placeholder="${$t("a651")}"></textarea>
        <div class="out" style="margin:10px 0"></div>
        <label class="small">${$t("a652")}<input class="sn" placeholder="${$t("a653")}"></label>
        <button class="btn sm mint sv" style="margin-top:8px">${$t("a621")}</button></div>
        <div class="card"><h3>${$t("a654")}</h3>${S.mnemonics.map((m, i) => `<div class="exp"><b>${esc(m.a)}</b> — ${esc(m.s)}<button class="x" data-del="${i}" style="float:right">×</button><br><span class="small muted">${esc(m.l)}</span></div>`).join("") || $t("a656")}
        <div class="tip small">${$t("a655")}</div></div></div>`;
      const it = $(".it", el);
      it.oninput = () => { const L = it.value.split("\n").map(s => s.trim()).filter(Boolean); $(".out", el).innerHTML = L.length ? `<div style="font-size:28px;font-weight:900;letter-spacing:4px;color:var(--p)">${L.map(s => esc(s[0])).join("")}</div>` : ""; };
      $(".sv", el).onclick = () => { const L = it.value.split("\n").map(s => s.trim()).filter(Boolean); if (!L.length) return toast($t("a657")); S.mnemonics.unshift({ a: L.map(s => s[0]).join(""), s: $(".sn", el).value, l: L.join(", ") }); save(); xpOnce("mn" + S.mnemonics.length, 10, $t("a658")); render(); };
      $$("[data-del]", el).forEach(b => b.onclick = () => { S.mnemonics.splice(+b.dataset.del, 1); save(); render(); });
    }
    render();
  },
  essay(el) {
    const V = [[$t("a659"), $t("a660")], [$t("a661"), $t("a662")], [$t("a663"), $t("a664")], [$t("a665"), $t("a666")], [$t("a667"), $t("a668")], [$t("a669"), $t("a668")], [$t("a670"), $t("a671")], [$t("a672"), $t("a673")], [$t("a674"), $t("a673")], [$t("a675"), $t("a676")], [$t("a677"), $t("a678")], [$t("a679"), $t("a680")], [$t("a681"), $t("a682")], ["compare", $t("a683")], ["contrast", $t("a684")], ["analy", $t("a685")], ["evaluate", $t("a686")], ["assess", $t("a687")], ["discuss", $t("a688")], ["explain", $t("a689")], ["describe", $t("a690")], ["to what extent", $t("a691")], ["justify", $t("a692")], ["outline", $t("a693")]];
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>${$t("a694")}</h3><textarea class="qq" placeholder="${$t("a695")}"></textarea><div class="vv" style="margin-top:8px"></div>
      <h3 style="margin-top:12px">${$t("a696")}</h3>
      <label class="small">${$t("a697")}<input class="a1" placeholder="${$t("a698")}"></label><label class="small">${$t("a699")}<input class="a2" placeholder="${$t("a700")}"></label>
      <label class="small">${$t("a701")}<input class="a3" placeholder="${$t("a702")}"></label><label class="small">${$t("a703")}<input class="a4" placeholder="${$t("a704")}"></label>
      <button class="btn sm mk" style="margin-top:8px">${$t("a705")}</button></div>
      <div class="card"><h3>${$t("a706")}</h3><div class="ol"><p class="small muted">${$t("a707")}</p></div></div></div>`;
    $(".qq", el).oninput = e => { const q = e.target.value.toLowerCase(); const f = V.filter(v => q.includes(v[0].toLowerCase())); $(".vv", el).innerHTML = f.length ? f.map(v => `<span class="chip t">${$f("verb_chip", v[0], v[1])}</span>`).join("") : (q ? $t("a709") : ""); };
    $(".mk", el).onclick = () => {
      const [a1, a2, a3, a4] = [1, 2, 3, 4].map(i => esc($(".a" + i, el).value || "…"));
      $(".ol", el).innerHTML = `<div class="exp">${$f("ess_intro", a4, a1, a3, a2)}</div>
        ${[1, 2, 3].map(i => `<div class="exp">${$f("ess_body", i)}</div>`).join("")}
        <div class="exp">${$f("ess_end", a3)}</div>
        <div class="tip small">${$t("a716")}</div>`;
      xpOnce("essay" + today(), 10, $t("a719"));
    };
  },
  breath(el) {
    let run = false, raf = null;
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>${$t("a720")}</h3><input type="range" min="1" max="10" value="4" class="slider sl"><div class="row" style="justify-content:space-between" ><span class="small">😌 1</span><b class="sv" style="font-size:28px">4</b><span class="small">10 😫</span></div><div class="adv exp"></div>
      <h3 style="margin-top:16px">${$t("a721")}</h3><p class="small muted">${$t("a722")}</p><textarea placeholder="${$t("a723")}"></textarea></div>
      <div class="card" style="text-align:center"><h3>${$t("a724")}</h3><select class="pt" style="width:auto"><option value="4,0,6,0">${$t("a725")}</option><option value="4,7,8,0">${$t("a726")}</option><option value="4,4,4,4">${$t("a727")}</option></select>
      <div class="breath-ball bb">${$t("a728")}</div><div class="small muted cnt">${$t("a729")}</div><div class="row" style="justify-content:center;margin-top:10px"><button class="btn mint go">${$t("a474")}</button></div></div></div>`;
    const adv = v => v <= 3 ? $t("a730") : v <= 6 ? $t("a731") : $t("a732");
    const sl = $(".sl", el); const up = () => { $(".sv", el).textContent = sl.value; $(".adv", el).innerHTML = adv(+sl.value); }; sl.oninput = up; up();
    $(".go", el).onclick = () => {
      if (run) { run = false; cancelAnimationFrame(raf); $(".go", el).textContent = $t("a474"); $(".bb", el).textContent = $t("a728"); return; }
      run = true; $(".go", el).textContent = $t("a733");
      const [i, h, o, h2] = $(".pt", el).value.split(",").map(Number), cyc = i + h + o + h2, t0 = performance.now(), ball = $(".bb", el);
      (function loop(now) {
        if (!run) return;
        const t = (now - t0) / 1000, c = t % cyc; let s, lab;
        if (c < i) { s = .6 + .4 * (c / i); lab = $t("a734"); } else if (c < i + h) { s = 1; lab = $t("a735"); } else if (c < i + h + o) { s = 1 - .4 * ((c - i - h) / o); lab = $t("a736"); } else { s = .6; lab = $t("a735"); }
        ball.style.transform = `scale(${s})`; ball.textContent = lab; $(".cnt", el).textContent = Math.max(0, 60 - Math.floor(t)) + $t("a737");
        if (t >= 60) { run = false; ball.textContent = $t("a738"); $(".go", el).textContent = $t("a739"); mission("breath"); xpOnce("breath" + today(), 10, $t("a740")); beep("bell"); return; }
        raf = requestAnimationFrame(loop);
      })(t0);
    };
  },
  journal(el) {
    function render() {
      el.innerHTML = `<div class="grid g2"><div class="card"><h3>${$t("a741")}</h3><p class="small muted">${$t("a742")}</p>
        <label class="small">${$t("a743")}<input class="j1" placeholder="${$t("a744")}"></label>
        <label class="small">${$t("a745")}<input class="j2" placeholder="${$t("a746")}"></label>
        <label class="small">${$t("a747")}</label><div class="likert fc">${[1, 2, 3, 4, 5].map(n => `<button data-v="${n}">${"⭐".repeat(n)}</button>`).join("")}</div>
        <label class="small">${$t("a748")}<textarea class="j3" style="min-height:60px"></textarea></label>
        <label class="small">${$t("a749")}<textarea class="j4" style="min-height:60px" placeholder="${$t("a750")}"></textarea></label>
        <button class="btn mint sv" style="margin-top:8px">${$t("a621")}</button></div>
        <div class="card"><h3>${$t("a751")}${S.journal.length})</h3>${S.journal.slice(0, 15).map((j, k) => `<div class="exp"><b>${fmtDate(j.d)}</b> ${"⭐".repeat(j.f || 0)}<button class="x" data-del="${k}" style="float:right">×</button><br>📚 ${esc(j.a)}<br>🛠️ ${esc(j.m)}${j.g ? "<br>👍 " + esc(j.g) : ""}${j.n ? "<br>🔧 " + esc(j.n) : ""}</div>`).join("") || $t("a752")}</div></div>`;
      let f = 0; $$(".fc button", el).forEach(b => b.onclick = () => { f = +b.dataset.v; $$(".fc button", el).forEach(x => x.classList.toggle("on", x === b)); });
      $(".sv", el).onclick = () => { const a = $(".j1", el).value.trim(); if (!a) return toast($t("a753")); S.journal.unshift({ d: today(), a, m: $(".j2", el).value, f, g: $(".j3", el).value, n: $(".j4", el).value }); save(); mission("journal"); xpOnce("jr" + today(), 15, $t("a460")); if (S.journal.length >= 3) badge("journal"); render(); };
      $$("[data-del]", el).forEach(b => b.onclick = () => { S.journal.splice(+b.dataset.del, 1); save(); render(); });
    }
    render();
  }
};
function goalForms(el, woopOnly) {
  function render() {
    el.innerHTML = `<div class="grid g2">${woopOnly ? "" : `<div class="card"><h3>${$t("a766")}</h3>
      <label class="small">${$t("a767")}<input class="s1" placeholder="${$t("a768")}"></label>
      <label class="small">${$t("a769")}<input class="s2" placeholder="${$t("a770")}"></label>
      <label class="small">${$t("a771")}<input class="s3" placeholder="${$t("a772")}"></label>
      <label class="small">${$t("a773")}<input class="s4" placeholder="${$t("a774")}"></label>
      <label class="small">${$t("a775")}${addDays(today(), 28)}"></label>
      <div class="pv exp"></div><button class="btn sm mint ss" style="margin-top:8px">${$t("a776")}</button></div>`}
      <div class="card"><h3>${$t("a754")}</h3><p class="small muted">${$t("a755")}</p>
      <label class="small">${$t("a756")}<input class="w1" placeholder="${$t("a757")}"></label>
      <label class="small">${$t("a758")}<input class="w2" placeholder="${$t("a759")}"></label>
      <label class="small">${$t("a760")}<input class="w3" placeholder="${$t("a761")}"></label>
      <label class="small">${$t("a762")}<input class="w4" placeholder="${$t("a763")}"></label>
      <button class="btn sm mint sw" style="margin-top:8px">${$t("a764")}</button></div></div>
      <div class="card" style="margin-top:16px"><h3>${$t("a765")}</h3>${S.goals.map((g, i) => `<div class="todo-item ${g.done ? "done" : ""}"><input type="checkbox" data-g="${i}" ${g.done ? "checked" : ""} style="width:auto"><span>${g.type === "woop" ? "💫" : "🎯"} ${esc(g.text)}</span><button class="x" data-del="${i}">×</button></div>`).join("") || $t("a777")}</div>`;
    const pv = () => { const p = $(".pv", el); if (!p) return; const v = [1, 2, 3, 4].map(i => $(".s" + i, el).value.trim()); const d = $(".s5", el).value; p.innerHTML = v[0] ? `📣 <b>${$f("smart", d ? $f("sm_by", fmtDate(d)) : "", v[3] ? $f("sm_for", esc(v[3])) : "", esc(v[2]), esc(v[1]), esc(v[0])).replace(/\s+/g, " ").trim()}</b>` : $t("a780"); };
    $$("[class^=s]", el).forEach(i => { if (i.tagName === "INPUT") i.oninput = pv; }); pv();
    const ss = $(".ss", el); if (ss) ss.onclick = () => { const t = $(".pv b", el); if (!t) return toast($t("a781")); S.goals.unshift({ type: "smart", text: t.textContent, done: 0 }); save(); xpOnce("goal" + S.goals.length, 10, $t("a782")); render(); };
    $(".sw", el).onclick = () => { const w = [1, 2, 3, 4].map(i => $(".w" + i, el).value.trim()); if (!w[0] || !w[3]) return toast($t("a783")); S.goals.unshift({ type: "woop", text: `${w[0]} — ${w[3]}`, done: 0 }); save(); xpOnce("woop" + S.goals.length, 15, $t("a784")); render(); };
    $$("[data-g]", el).forEach(c => c.onchange = () => { const g = S.goals[+c.dataset.g]; g.done = c.checked ? 1 : 0; if (g.done && !g.xp) { g.xp = 1; addXP(20, $t("a785")); confetti(); } save(); render(); });
    $$("[data-del]", el).forEach(b => b.onclick = () => { S.goals.splice(+b.dataset.del, 1); save(); render(); });
  }
  render();
}

/* ---------------- 진단 ---------------- */
routes.diag = function (tab) {
  tab = tab || "habit";
  app.innerHTML = `<div class="fade"><div class="page-head"><h1>${$t("a264")}</h1><p class="muted">${$t("a786")}</p></div>
    <div class="row" style="margin-bottom:14px"><a class="btn ${tab === "habit" ? "" : "ghost"}${$t("a787")}</a><a class="btn ${tab === "pref" ? "" : "ghost"}${$t("a788")}</a></div><div id="dg"></div></div>`;
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
  el.innerHTML = `<div class="card">${SS.diagQs.map((q, i) => `<div class="dq"><p>${i + 1}. ${q[1]}</p><div class="likert" data-i="${i}">${[$t("a789"), $t("a790"), $t("a791")].map((t, k) => `<button data-k="${k}" class="${ans[i] === k ? "on" : ""}">${t}</button>`).join("")}</div></div>`).join("")}
    <button class="btn" id="dgo" style="margin-top:14px">${$t("a17")}</button></div><div id="dres" style="margin-top:16px"></div>`;
  $$(".likert", el).forEach(l => $$("button", l).forEach(b => b.onclick = () => { ans[+l.dataset.i] = +b.dataset.k; $$("button", l).forEach(x => x.classList.toggle("on", x === b)); }));
  const show = () => {
    const sc = {}; SS.diagAreas.forEach(a => sc[a.k] = [0, 0]);
    SS.diagQs.forEach((q, i) => { const k = ans[i]; const v = q[2] > 0 ? [2, 1, 0][k] : [0, 1, 2][k]; sc[q[0]][0] += v; sc[q[0]][1] += 2; });
    const vals = SS.diagAreas.map(a => sc[a.k][0] / sc[a.k][1]);
    const order = SS.diagAreas.map((a, i) => ({ a, v: vals[i] })).sort((x, y) => x.v - y.v);
    $("#dres").innerHTML = `<div class="grid g2"><div class="card">${radar(vals, SS.diagAreas.map(a => a.name))}</div>
      <div class="card"><h3>${$t("a792")}</h3>${order.map(o => `<div class="row" style="margin-bottom:6px"><span style="width:90px;font-weight:700">${o.a.name}</span><div class="xpbar" style="display:block;flex:1;height:10px"><i style="width:${o.v * 100}%"></i></div><b style="width:42px;text-align:right">${Math.round(o.v * 100)}</b></div>`).join("")}
      <h4 style="margin-top:14px">${$t("a793")}</h4>${order.slice(0, 2).map(o => { const t = TOOLS.find(x => x.id === o.a.tool), c = SS.chapters.find(x => x.id === o.a.ch); return `<div class="exp"><b>${o.a.name}</b> → <a href="#/ch/${c.id}">${c.emoji} ${c.id}${$t("a287")} ${c.title}</a> · <a href="#/tool/${t.id}">${t.emoji} ${t.name}</a></div>`; }).join("")}
      <p class="small muted">${$t("a794")}${order[order.length - 1].a.name}${$t("a795")}</p></div></div>`;
  };
  $("#dgo").onclick = () => {
    if (ans.filter(x => x !== undefined).length < SS.diagQs.length) return toast($t("a796") + ans.filter(x => x !== undefined).length + "/" + SS.diagQs.length + ")");
    S.diag = { ans, d: today() }; save(); show(); badge("diag"); xpOnce("diag", 30, $t("a797"));
    $("#dres").scrollIntoView({ behavior: "smooth" });
  };
  if (S.diag && S.diag.ans && S.diag.ans.length === SS.diagQs.length) show();
}
function prefTest(el) {
  const ans = (S.pref && S.pref.slice()) || [];
  el.innerHTML = `<div class="fact"><h4>${$t("a798")}</h4>${$t("a799")}</div>
    <div class="card">${SS.prefQs.map((q, i) => `<div class="dq"><p>${i + 1}. ${q[1]}</p><div class="likert" data-i="${i}">${[$t("a800"), $t("a801"), $t("a802")].map((t, k) => `<button data-k="${k}" class="${ans[i] === k ? "on" : ""}">${t}</button>`).join("")}</div></div>`).join("")}
    <button class="btn" id="pgo" style="margin-top:14px">${$t("a17")}</button></div><div id="pres" style="margin-top:16px"></div>`;
  $$(".likert", el).forEach(l => $$("button", l).forEach(b => b.onclick = () => { ans[+l.dataset.i] = +b.dataset.k; $$("button", l).forEach(x => x.classList.toggle("on", x === b)); }));
  const show = () => {
    const sc = {}; SS.prefs.forEach(p => sc[p.k] = 0); SS.prefQs.forEach((q, i) => sc[q[0]] += [2, 1, 0][ans[i]]);
    const ord = SS.prefs.slice().sort((a, b) => sc[b.k] - sc[a.k]);
    $("#pres").innerHTML = `<div class="card"><h3>${$t("a803")}</h3>${ord.map(p => `<div class="row" style="margin-bottom:6px"><span style="width:110px;font-weight:700">${p.emoji} ${p.name}</span><div class="xpbar" style="display:block;flex:1;height:10px"><i style="width:${sc[p.k] / 4 * 100}%"></i></div></div>`).join("")}
      <h4 style="margin-top:14px">${$t("a804")}</h4>${ord.slice(0, 2).map(p => `<div class="exp"><b>${p.emoji} ${p.name}</b>: ${p.tip}</div>`).join("")}
      <h4>${$t("a805")}</h4><div class="exp"><b>${ord[ord.length - 1].emoji} ${ord[ord.length - 1].name}</b>: ${ord[ord.length - 1].tip}</div>
      <p class="small muted">${$t("a806")} <a href="#/lab/retrieval">${$t("a490")}</a>, <a href="#/lab/spacing">${$t("a492")}</a>, <a href="#/lab/dual">${$t("a505")}</a> ${$t("a807")}</p></div>`;
  };
  $("#pgo").onclick = () => { if (ans.filter(x => x !== undefined).length < SS.prefQs.length) return toast($t("a808")); S.pref = ans; save(); show(); xpOnce("pref", 15, $t("a809")); $("#pres").scrollIntoView({ behavior: "smooth" }); };
  if (S.pref && S.pref.length === SS.prefQs.length) show();
}

/* ---------------- 내 기록 ---------------- */
routes.me = function () {
  const L = lvInfo(S.xp), c = calib(), dn = Object.keys(S.done).length, all = SS.chapters.reduce((a, x) => a + x.lessons.length, 0);
  app.innerHTML = `<div class="fade"><div class="page-head"><h1>${$t("a810")}</h1></div>
    <div class="hero" style="margin-bottom:16px"><div class="lvl" style="margin:0"><div class="ring" style="--v:${L.pct}"><b>${L.name.split(" ")[0]}</b></div><div><div style="font-weight:800;font-size:20px">${S.name ? esc(S.name) + " · " : ""}${L.name}</div><div class="small">${S.xp} ${$t("a260")} ${L.toNext} XP</div></div></div></div>
    <div class="grid g4"><div class="stat"><b>${dn}/${all}</b><small>${$t("a811")}</small></div><div class="stat"><b>${Object.keys(S.boss).length}/7</b><small>${$t("a325")}</small></div><div class="stat"><b>🔥${streak()}</b><small>${$t("a812")}</small></div><div class="stat"><b>${Object.keys(S.days).length}</b><small>${$t("a813")}</small></div>
    <div class="stat"><b>${S.pomo.count}</b><small>${$t("a436")}</small></div><div class="stat"><b>${S.cardReviews}</b><small>${$t("a814")}</small></div><div class="stat"><b>${c ? c.score : "—"}</b><small>${$t("a815")}</small></div><div class="stat"><b>${S.journal.length}</b><small>${$t("a460")}</small></div></div>
    <h2 style="margin-top:22px">${$t("a816")} ${Object.keys(S.badges).length}/${SS.badges.length}</h2>
    <div class="badges">${SS.badges.map(b => `<div class="badge ${S.badges[b.id] ? "got" : ""}"><b>${b.emoji}</b><strong>${b.name}</strong><small>${b.desc}</small></div>`).join("")}</div>
    <div class="card" style="margin-top:20px"><h3>${$t("a817")}</h3><div class="row"><label class="row small" style="gap:6px"><input type="checkbox" id="snd" ${S.sound ? "checked" : ""} ${$t("a818")}</label>
      <input id="nm2" value="${esc(S.name)}${$t("a819")}<button class="btn sm ghost" id="nmS">${$t("a820")}</button></div>
      <p class="small muted">${$t("a821")}</p>
      <div class="row"><button class="btn sm line" id="exp">${$t("a822")}</button><label class="btn sm line" style="cursor:pointer">${$t("a823")}<input type="file" id="imp" accept=".json" style="display:none"></label><button class="btn sm coral" id="rst">${$t("a364")}</button></div></div></div>`;
  $("#snd").onchange = e => { S.sound = e.target.checked; save(); };
  $("#nmS").onclick = () => { S.name = $("#nm2").value.trim().slice(0, 12); save(); toast($t("a633")); };
  $("#exp").onclick = () => saveFile("study-skill-backup-" + today() + ".json", new Blob([JSON.stringify(S)], { type: "application/json" }));
  $("#imp").onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { S = Object.assign(DEF(), JSON.parse(r.result)); save(); hud(); sideChapters(); routes.me(); toast($t("a824")); } catch (er) { toast($t("a825")); } }; r.readAsText(f); };
  $("#rst").onclick = () => { if (confirm($t("a826"))) { S = DEF(); save(); hud(); sideChapters(); routes.me(); } };
};
routes.refs = function () {
  app.innerHTML = `<div class="fade"><div class="page-head"><h1>${$t("a827")}</h1><p class="muted">${$t("a828")}</p></div>
    <div class="card">${SS.refs.map(r => `<div class="dq"><p style="font-weight:500">${r.u ? `<a href="${r.u}" target="_blank" rel="noopener">${esc(r.t)} ↗</a>` : esc(r.t)}</p></div>`).join("")}</div>
    <div class="fact"><h4>${$t("a829")}</h4>${$t("a830")}</div>
    <p class="small muted">${$t("a831")} <a href="privacy.html" target="_blank">${$t("a832")}</a> ${$t("a833")}</p></div>`;
};

/* ---------------- 시작 ---------------- */
/* 언어: 고정 문구 번역 + 언어 선택 */
document.title = $t("doc_title");
$$("[data-i18n]").forEach(e => { e.textContent = $t(e.dataset.i18n); });
const ls = $("#langSel"); if (ls) { ls.value = window.SSQ_LANG || "ko"; ls.title = $t("lang_title"); ls.onchange = () => { try { localStorage.setItem("ssq_lang", ls.value); } catch (e) {} location.reload(); }; }
hud(); sideChapters(); go();
if (!NATIVE && "serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
