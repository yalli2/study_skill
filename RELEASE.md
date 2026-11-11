# 📱 앱 출시 가이드 — 공부력 레벨업 (Study Skill Quest)

앱 ID: `net.dainedu.studyskill` · 앱 이름: **공부력 레벨업** · 버전: 1.0

---

## 0. 먼저 할 일 (5분)
1. GitHub 저장소 **Settings → Pages** → Source: `main` / `(root)` → Save
2. 1~2분 뒤 확인: https://yalli2.github.io/study_skill/
3. 개인정보처리방침 주소(스토어 등록에 필요): https://yalli2.github.io/study_skill/privacy.html

> 💡 Pages만 켜도 학생들은 바로 **앱처럼 설치**할 수 있어요(PWA).
> - Android 크롬: 메뉴 ⋮ → **홈 화면에 추가 / 앱 설치**
> - iPhone 사파리: 공유 버튼 → **홈 화면에 추가**
> - 한 번 열면 인터넷이 없어도 동작합니다.

---

## 1. Android — Google Play 출시

### 1-1. 개발자 계정
- https://play.google.com/console 에서 가입 (등록비 1회 25달러)
- **조직 계정(다인원격평생교육직업학원)으로 가입하는 것을 권장**합니다. 조직 계정은 D-U-N-S 번호가 필요하지만, 신규 *개인* 계정에는 프로덕션 출시 전에 일정 인원·기간의 비공개 테스트를 거쳐야 하는 요건이 있습니다. 최신 요건은 Play Console 안내를 확인하세요.

### 1-2. 서명 키 만들기 (한 번만, PC에서)
Java가 설치된 PC에서:
```bash
keytool -genkeypair -v -keystore release.keystore -alias studyskill -keyalg RSA -keysize 2048 -validity 10000
```
⚠️ `release.keystore` 파일과 비밀번호는 **절대 잃어버리지 말고**, GitHub에 올리지 마세요(업데이트할 때 계속 필요).

### 1-3. GitHub에 서명 정보 등록
저장소 **Settings → Secrets and variables → Actions → New repository secret** 에 4개 추가:

| 이름 | 값 |
|---|---|
| `KEYSTORE_BASE64` | keystore 파일을 base64로 바꾼 문자열 (Mac/Linux: `base64 -i release.keystore`, Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("release.keystore"))`) |
| `KEYSTORE_PASSWORD` | keystore 비밀번호 |
| `KEY_ALIAS` | `studyskill` |
| `KEY_PASSWORD` | 키 비밀번호 |

### 1-4. 앱 파일 자동 빌드 (PC에 Android Studio 없어도 됨)
1. 저장소 **Actions** 탭 → **Android 앱 빌드** → **Run workflow**
2. 5~10분 뒤 완료되면 아래 **Artifacts**에서 `study-skill-quest-android` 다운로드
   - `app-debug.apk` → 휴대폰에 바로 설치해서 테스트
   - `app-release.aab` → Play Console에 업로드하는 출시 파일
3. (`.github/workflows/android.yml`이 저장소에 없다면: 이 저장소의 `docs/android.yml` 파일을 `.github/workflows/` 폴더로 옮기세요.)

### 1-5. Play Console 등록 정보
| 항목 | 준비물 |
|---|---|
| 앱 아이콘 512×512 | `icons/icon-512.png` |
| 그래픽 이미지 1024×500 | `store/feature-graphic-1024x500.png` |
| 휴대폰 스크린샷 | `store/screenshot-*.png` (6장) |
| 개인정보처리방침 | https://yalli2.github.io/study_skill/privacy.html |
| 데이터 보안 | **수집하는 데이터 없음 / 공유하는 데이터 없음** |
| 광고 | 없음 |
| 앱 카테고리 | 교육 |
| 타겟 연령 | 학생이 대상이므로 13세 미만을 포함하면 **‘가족 정책(Families)’** 요건이 적용됩니다. 이 앱은 광고·데이터 수집이 없어 요건 충족이 쉽습니다. |

**짧은 설명 (80자 이내)**
> 과학으로 검증된 공부법을 게임처럼 배우고, 타이머·플래시카드로 바로 실천하는 자기주도학습 앱

**자세한 설명**
> 공부도 기술입니다! 공부력 레벨업은 학생이 스스로 계획하고, 실천하고, 돌아보는 ‘자기주도 학습자’가 되도록 돕는 앱이에요.
>
> 🗺️ 7개 월드 48개 레슨 — 뇌 사용 설명서, 마음 엔진, 시간과 집중, 입력 기술(읽기·노트), 기억 기술(복습·암기법), 출력 기술(글쓰기·시험), 회복과 성장
> 🔬 과학 공부법 랩 — 인출 연습, 간격 반복(망각 곡선 실험), 교차 학습, 이중 부호화, 파인만 기법, 메타인지 점수
> 🛠️ 도구 13종 — 집중 타이머, 라이트너 플래시카드, 시험 D-day 복습 계획, SMART·WOOP 목표, 주간 시간표, 코넬 노트, 마인드맵, 호흡 가이드, 학습 일지
> 🩺 공부 습관 진단 — 나의 강점과 먼저 키울 영역을 레이더 차트로
> 🏆 XP·레벨·배지·오늘의 미션으로 공부가 재밌어져요
>
> ✔ 회원가입·광고·개인정보 수집 없음 ✔ 오프라인에서도 동작

### 1-6. 업데이트할 때
1. 웹 파일(`index.html`, `js/`, `css/`) 수정 → push
2. `android/app/build.gradle`의 `versionName`을 올림 (예: "1.1")
3. Actions에서 다시 빌드 (versionCode는 빌드 번호로 자동 증가) → 새 AAB 업로드

---

## 2. iOS — App Store 출시
iOS 앱은 **Mac + Xcode**가 꼭 필요합니다(애플 정책).

### 2-1. 준비
- Apple Developer Program 가입 (연 99달러, 조직 가입 시 D-U-N-S 필요)
- Mac에 Xcode, Node.js 설치

### 2-2. 빌드
```bash
git clone https://github.com/yalli2/study_skill.git
cd study_skill
npm install
npm run ios        # 웹 파일 복사 + Xcode 열기
```
Xcode에서:
1. **App** 타깃 → Signing & Capabilities → Team 선택 (Bundle ID: `net.dainedu.studyskill`)
2. 상단 기기를 **Any iOS Device** 로 → **Product → Archive** → **Distribute App → App Store Connect**

### 2-3. App Store Connect 등록
- 개인정보 보호: **데이터를 수집하지 않음**
- 카테고리: 교육 · 연령 등급: 4+
- 스크린샷: 6.7"/6.5" iPhone 크기 필요 (시뮬레이터에서 캡처)
- 개인정보처리방침 URL: 위와 동일

> Mac이 없다면 Codemagic, Ionic Appflow 같은 클라우드 빌드 서비스로 iOS 빌드를 할 수도 있습니다(서명 인증서는 Apple 개발자 계정에서 발급).

---

## 3. 개발자 메모
```bash
npm install          # 의존성 설치
npm run build        # 웹 파일 → www/
npx cap sync         # www/ → android/, ios/ 반영
npm run android      # Android Studio 열기
npm run assets       # assets/ 원본으로 아이콘·스플래시 다시 생성
```
- 앱에서는 PNG/SVG/백업 파일 저장 시 **공유 시트**가 열립니다(Filesystem + Share 플러그인).
- 인쇄 버튼은 앱에서 자동으로 숨겨집니다.
