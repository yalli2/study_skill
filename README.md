# 🚀 Study Skill Quest · 공부력 레벨업

학생들이 **스스로 공부하는 힘(자기주도학습)**을 기르도록 만든 인터랙티브 공부법 앱입니다. 웹(PWA)·Android·iOS로 배포할 수 있어요.

🌐 **5개 언어 지원**: 한국어 · English · Español · 日本語 · 中文(简体) — 화면 오른쪽 위 언어 버튼으로 전환 (처음 방문 시 기기 언어를 자동 선택)

- 웹: https://yalli2.github.io/study_skill/ (GitHub Pages 활성화 후)
- 앱 출시 방법: [RELEASE.md](RELEASE.md)

## 구성
- **🗺️ 7개 월드 · 48개 레슨** — 뇌 사용 설명서 → 마음 엔진 → 시간과 집중 → 입력 기술 → 기억 기술 → 출력 기술 → 회복과 성장
- **🔬 과학 공부법 랩 10종** · **🛠️ 도구 13종** · **🩺 공부 습관 진단** · **🏆 XP·배지·미션**
- 기록은 기기 안에만 저장(개인정보 수집 없음) — [개인정보처리방침](privacy.html)

## 폴더
| 경로 | 내용 |
|---|---|
| `index.html`, `css/`, `js/`, `icons/` | 앱 본체(웹) |
| `manifest.webmanifest`, `sw.js` | PWA(설치·오프라인) |
| `android/`, `ios/` | Capacitor 네이티브 프로젝트 |
| `assets/` | 앱 아이콘·스플래시 원본 |
| `i18n/` | 번역 원본 (`ko.ui.json`·`ko.data.json` = 한국어 원문, `*.tsv` = 언어별 번역) |
| `js/lang/` | 빌드된 언어 파일 (`npm run i18n`으로 생성) |
| `.github/workflows/android.yml` | GitHub에서 APK/AAB 자동 빌드 |

## 번역 수정 방법
1. `i18n/<언어>.ui.tsv`(화면 문구), `<언어>.data.tsv`(레슨 내용), `<언어>.static.tsv`(메뉴)에서 해당 줄의 탭 뒤 문장을 고칩니다. (en·es·ja·zh)
2. `npm run i18n` 실행 → `js/lang/`이 다시 만들어집니다.
3. 한국어 원문을 바꾸려면 `js/data.js`(레슨)·`i18n/ko.ui.json`(화면)을 고친 뒤 각 언어 파일의 같은 키도 고쳐 주세요.

## 저작권
설명·문제·게임·도구·아이콘은 다인에듀가 직접 기획·제작했습니다. 과학적 근거는 공개 연구(Dunlosky 외 2013, Pashler 외 2008, EEF 등)를 요약·재서술해 인용했습니다. 이모지는 사용자 기기의 기본 글꼴로 표시됩니다.

© 다인원격평생교육직업학원(다인에듀) · 후안샘
