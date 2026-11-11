// 번역 빌드: i18n/*.tsv → js/lang/ui.<lang>.js, js/lang/data.<lang>.js
// 원본(한국어): js/data.js(콘텐츠), i18n/ko.ui.json(화면 문구), i18n/ko.static.tsv(고정 메뉴)
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, ".."), I = p => path.join(root, "i18n", p);
const LANGS = ["en", "es", "ja", "zh"];
const tsv = f => { const d = {}; if (!fs.existsSync(f)) return d; for (const line of fs.readFileSync(f, "utf8").split("\n")) { if (!line.trim()) continue; const i = line.indexOf("\t"); if (i < 0) d[line.trim()] = ""; else d[line.slice(0, i)] = line.slice(i + 1).replace(/\r$/, ""); } return d; };
const fixWs = (src, v) => { const lead = src.match(/^\s*/)[0], trail = src.match(/\s*$/)[0]; if (lead && !/^\s/.test(v)) v = lead + v; if (trail && !/\s$/.test(v)) v = v + trail; return v; };
const koUi = Object.assign(JSON.parse(fs.readFileSync(I("ko.ui.json"), "utf8")), tsv(I("ko.static.tsv")));
const koData = JSON.parse(fs.readFileSync(I("ko.data.json"), "utf8"));
const out = (name, obj) => fs.writeFileSync(path.join(root, "js/lang", name), obj);
out("ui.ko.js", "I18N.ko = " + JSON.stringify(koUi) + ";\n");
const src = fs.readFileSync(path.join(root, "js/data.js"), "utf8");
for (const L of LANGS) {
  const ui = Object.assign(tsv(I(L + ".ui.tsv")), tsv(I(L + ".static.tsv")));
  const miss = Object.keys(koUi).filter(k => !(k in ui));
  for (const k in ui) if (k in koUi) ui[k] = fixWs(koUi[k], ui[k]);
  out("ui." + L + ".js", "I18N." + L + " = " + JSON.stringify(ui) + ";\n");
  const dt = tsv(I(L + ".data.tsv")), byText = {};
  for (const id in koData) if (id in dt) byText[koData[id]] = fixWs(koData[id], dt[id]);
  const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(src, ctx);
  let dmiss = 0;
  (function w(o) { for (const k in o) { const v = o[k]; if (typeof v === "string") { if (/[가-힣]/.test(v)) { if (v in byText) o[k] = byText[v]; else dmiss++; } } else if (v && typeof v === "object") w(v); } })(ctx.window.SS);
  out("data." + L + ".js", "window.SS = window.SS || {};\nObject.assign(window.SS, " + JSON.stringify(ctx.window.SS) + ");\n");
  console.log(L, "UI 누락", miss.length, "| 콘텐츠 누락", dmiss);
}
