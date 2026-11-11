/* 언어 선택 + 번역 함수 + 스크립트 로더 */
(function () {
  var LANGS = ["ko", "en", "es", "ja", "zh"], lang = null;
  try { lang = localStorage.getItem("ssq_lang"); } catch (e) {}
  if (LANGS.indexOf(lang) < 0) { var n = (navigator.language || "ko").toLowerCase().slice(0, 2); lang = LANGS.indexOf(n) >= 0 ? n : "en"; }
  window.SSQ_LANG = lang;
  document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
  window.I18N = window.I18N || {};
  window.$t = function (k) { var d = I18N[lang], v = d && d[k]; if (v == null) v = I18N.ko && I18N.ko[k]; return v == null ? k : v; };
  var files = ["js/lang/ui.ko.js"];
  if (lang !== "ko") files.push("js/lang/ui." + lang + ".js", "js/lang/data." + lang + ".js"); else files.push("js/data.js");
  files.push("js/app.js");
  files.forEach(function (f) { var s = document.createElement("script"); s.src = f; s.async = false; document.body.appendChild(s); });
})();
