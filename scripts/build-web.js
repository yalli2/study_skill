// 웹 파일을 www/ 로 복사 (Capacitor 앱에 들어갈 파일)
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), out = path.join(root, "www");
fs.rmSync(out, { recursive: true, force: true });
const items = ["index.html", "privacy.html", "manifest.webmanifest", "css", "js", "icons"];
for (const it of items) fs.cpSync(path.join(root, it), path.join(out, it), { recursive: true });
console.log("www/ 준비 완료:", items.join(", "));
