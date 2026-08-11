# 14. 빌드 & 배포 가이드

> **문서 지위: 실행 문서(Operational).** 정본은 `01-CONCEPT-AND-STORY.md` / `03-GDD-CORE.md` / `04-PACT-SYSTEM.md`.
> 충돌 시 정본이 우선한다. 이 문서는 "그 정본을 어떻게 기기와 스토어에 올리는가"만 다룬다.
>
> 최종 수정: **2026-08-10** / 1인 개발 / 개발 기간 7일 (Day 1 = 2026-08-10, Day 7 = 2026-08-16)
>
> **배포 대상: Android + iOS 동시.** 개발 머신은 **Windows이며 Mac이 없다.**
> 따라서 iOS 빌드는 전량 **클라우드 macOS CI**로 수행하며, 로컬 Xcode·시뮬레이터를 전제한 서술은 이 문서에 없다.
> iOS 관련 서술은 전부 **"CI 로그와 TestFlight 빌드만으로 진단 가능한가"** 를 기준으로 쓰였다. (§1.1, §10.0)
>
> **외부 정책 확인 기준일: 2026-08-10 (WebSearch로 실확인).** 확인하지 못한 항목은 본문에
> `⚠ 확인 필요(2026-08-10 기준 미확인)` 로 명시했다. 그 표시가 없는 Google Play 정책 수치는 아래 §7.0 출처 목록의
> 링크로 이날 직접 확인한 값이다. **Apple 쪽은 확인 강도가 다르므로 §7.0 표에 섞지 않고 본문에 개별 표기했다** (§7.0 하단 주석).

---

## 0. 이 문서의 결론부터 (TL;DR)

| 질문 | 답 |
|---|---|
| 이번 주 배포 대상은? | **Android + iOS 동시.** Day 7(2026-08-16)에 **Play 내부 테스트 트랙 + TestFlight 내부 테스트** 양쪽에 업로드를 완료하는 것이 목표다. |
| Day 7에 정식 출시 가능한가? | **양쪽 다 불가능하고, 이번 주 목표도 아니다.** Play는 신규 개인 개발자 계정이 **폐쇄형 테스트 12명 × 14일 연속**을 통과해야 프로덕션 접근을 신청할 수 있다(§7.2). App Store 공개도 전체 심사가 필요하므로 Day 7 이후 별도 일정이다. |
| 그럼 Day 7 목표는? | **Play 내부 테스트(Internal testing) 트랙에 AAB 업로드 + TestFlight 내부 테스트에 IPA 업로드.** Play 내부 테스트는 12/14 요건 대상이 아니고, **TestFlight 내부 테스트는 심사가 없다**(§7.5). 즉 양쪽 다 "심사에 막히지 않는 경로"만 고른 것이다. |
| Android에서 제일 먼저 막히는 것은? | ① Play Console 계정 생성(신원 확인 대기) ② 서명 키스토어 ③ targetSdk. **전부 Day 1에 처리.** (§13) |
| **iOS에서 제일 먼저 막히는 것은?** | ① **git 원격 저장소 부재** ② 서명 자산(인증서·프로비저닝·API 키) ③ App Store Connect 앱 레코드. **①이 최상위 블로커다** — 클라우드 CI는 예외 없이 원격 저장소를 트리거로 잡는데 이 프로젝트는 아직 git 저장소조차 아니다. (§6.4) |
| **Mac이 없는데 iOS 빌드가 되나?** | **로컬로는 불가능하다.** iOS 빌드는 전량 **클라우드 macOS CI**로 수행한다(권장 제공자: Codemagic, §6.4). 로컬 Xcode·시뮬레이터는 이 프로젝트에서 사용하지 않는다. 서명 자산은 Mac 없이 **openssl만으로** 만든다(§5.5). |
| targetSdk는? | 현재 스캐폴드 **35**. **2026-08-31부터 신규 앱/업데이트는 API 36(Android 16) 필수.** Day 7이 8/16이라 아슬아슬하다 → **지금 36으로 올려두는 것을 권장.** (§7.1) |
| iOS 최소 배포 타겟은? | **iOS 14.0** (Capacitor 7 요구사항). Xcode **16.0 이상**, Node **20 이상**, CI에 **`pod install` 단계 필수**. (§6.4) |
| 패키지 포맷은? | Android **AAB 필수**(신규 앱은 2021-08부터 APK 업로드 불가) / iOS **IPA**(`xcodebuild archive` → `exportArchive`). |
| 앱 ID는? | Android `applicationId` = iOS bundle identifier = **`com.bloodsworn.game`** 단일값. **양쪽 다 첫 업로드 후 영구 변경 불가.** (§2) |
| 개인정보 처리방침 URL? | Play는 **데이터를 하나도 수집하지 않아도 필요.** 데이터 보안 양식도 필수. iOS는 **내부 TestFlight에는 불필요**하고 App Store 제출 시 필요. (§9) |

### 0.1 이 문서를 관통하는 원칙 — "iOS 파이프라인 수직 관통 선행"

```
게임이 완성되기 전에, Day 1~2 안에
「빈 껍데기 빌드 → 클라우드 macOS CI → 서명 → App Store Connect → TestFlight 내부테스터 설치」
전 구간을 한 번 관통시켜 둔다.
```

**왜 이렇게 하는가**

1. iOS에서 위험한 건 게임이 아니라 **툴체인**이다. 게임 코드는 Android에서 이미 검증되고, Capacitor가 같은 `dist/`를 쓴다.
2. **Mac이 없으므로 서명·프로비저닝 오류를 로컬에서 재현할 수 없다.** CI를 돌려야만 알 수 있고, 1회 왕복이 길다.
3. 따라서 시행착오는 **시간이 남아 있을 때** 해야 한다. Day 7에 처음 시도하면 실패가 확정된다.
4. 관통에 성공하면 Day 7의 iOS 작업은 **"태그 푸시 → CI가 알아서 → TestFlight 확인"** 으로 축소된다.

> 이것은 §13.1의 "Day 6 릴리스 빌드 리허설"과 **같은 사상**이다.
> **iOS는 그 리허설을 Day 1~2로 더 앞당긴 것**이다. 앞당기는 이유는 위 2번 — 로컬 재현 수단이 없기 때문이다.

---

## 1. 빌드 파이프라인 개요

### 1.1 전체 다이어그램

```
                          ┌──────────────────────────────┐
                          │  소스 (FE/)                  │
                          │  src/ + index.html + public/ │
                          │  + asset/ (원본 스프라이트)   │
                          └───────────────┬──────────────┘
                                          │  npm run build
                                          │  (vite build)
                                          ▼
                          ┌──────────────────────────────┐
                          │  FE/dist/                    │
                          │  index.html                  │
                          │  assets/*.js  *.css          │
                          │  assets/*.png *.mp3          │
                          └───────┬──────────────┬───────┘
                                  │              │
              ┌───────────────────┘              └───────────────────┐
              │ npx cap sync android                                 │ git push (태그) → CI 트리거
              │ [로컬 Windows]                                        │ [여기부터 전부 클라우드 macOS CI]
              ▼                                                      ▼
┌──────────────────────────────────┐              ┌────────────────────────────────┐
│ FE/android/app/src/main/assets/  │              │ CI가 같은 소스에서 dist/ 재생성  │
│   public/  ← dist 복사본          │              │ npm ci && npm run build        │
│ + capacitor.config.json 반영      │              │ npx cap sync ios               │
└───────────────┬──────────────────┘              └───────────────┬────────────────┘
                │ gradlew bundleRelease                           │ pod install (CocoaPods 필수)
                ▼                                                 ▼
┌──────────────────────────────────┐              ┌────────────────────────────────┐
│ app-release.aab (서명됨)          │              │ xcodebuild archive  (서명)      │
│ app/build/outputs/bundle/release/ │              │   ↓                            │
└───────────────┬──────────────────┘              │ xcodebuild -exportArchive      │
                │ 업로드                           │   ↓                            │
                ▼                                 │ BLOODSWORN.ipa                 │
┌──────────────────────────────────┐              └───────────────┬────────────────┘
│ Google Play Console              │                              │ fastlane pilot 업로드
│  → 내부 테스트 트랙               │                              │ (ASC API 키 인증)
│ (Play 앱 서명이 AAB를 기기별      │                              ▼
│  APK로 분할 생성)                 │              ┌────────────────────────────────┐
└──────────────────────────────────┘              │ App Store Connect              │
                                                  │  → 빌드 처리 대기               │
                                                  │  → TestFlight 내부 테스터       │
                                                  │    (심사 없음)                  │
                                                  └────────────────────────────────┘

  [Android 검증] app-release.aab ──bundletool build-apks──▶ *.apks ──install-apks──▶ 실기기
  [iOS 검증]     BLOODSWORN.ipa ──AWS Device Farm(무료분)──▶ 원격 실기기
                 TestFlight ──▶ 사람이 가진 실제 iPhone   (시뮬레이터는 쓰지 않는다 — §13.1)
```

> **왼쪽과 오른쪽의 성격이 근본적으로 다르다.**
> Android는 내 PC에서 실패하고 내 PC에서 고친다. iOS는 **실패가 CI 로그로만 보인다.**
> Mac이 없어 로컬 재현이 불가능하므로, iOS 쪽 서술은 전부 "CI 로그와 TestFlight 빌드만으로 진단 가능한가"를 기준으로 쓰여 있다.

### 1.2 두 배포 대상의 차이

| 항목 | Android (AAB) | iOS (IPA) |
|---|---|---|
| 산출물 | `app-release.aab` | `BLOODSWORN.ipa` |
| 빌드 장소 | **로컬 Windows** (Gradle) | **클라우드 macOS CI** (Mac 없음 → 선택지가 없다) |
| 빌드 명령 | `gradlew bundleRelease` | `pod install` → `xcodebuild archive` → `xcodebuild -exportArchive` |
| 서명 | 업로드 키스토어 `.jks` (직접 생성·보관) | 배포 인증서 `.p12` + 프로비저닝 프로파일 `.mobileprovision` (§5.5) |
| 업로드 인증 | Play Console 웹 UI에 수동 업로드 | **App Store Connect API 키**(`.p8`) — CI 비대화식, 2FA 우회 |
| base 경로 | 상관없음(WebView가 `https://localhost/` 루트로 서빙) | 상관없음(WebView가 `capacitor://localhost/` 루트로 서빙) — 단 **상대경로가 안전선** (§4.3) |
| 방향 고정 | `AndroidManifest.xml` `screenOrientation` 로 강제 | `Info.plist` `UISupportedInterfaceOrientations` 로 강제 (§3.5) |
| 오디오 | WebView 자동재생 정책 → 첫 터치 후 `resume()` 필요 | 동일 + **하드웨어 무음 스위치를 존중한다**(Android에 없는 실패 모드, §12-H) |
| 저장 | WebView `localStorage` (`bloodsworn.save.v1`) | `localStorage`는 **OS가 회수할 수 있다** → `@capacitor/preferences` write-through 병행 (§12-H) |
| 배포 대상 | Play 내부 테스트 트랙 | TestFlight 내부 테스트 (§7.5) |
| 심사 | 트랙 업로드 검토(수 분~수 시간) | **내부 TestFlight는 심사 없음.** 관문은 빌드 처리 성공 + 수출 규정 응답뿐 |

> **한 개의 `dist/` 로 둘 다 만든다.** 플랫폼별 분기 빌드를 만들지 않는다. 7일 스코프에서 빌드 분기는 사치이며,
> 무엇보다 **iOS를 로컬에서 확인할 수 없는 상황에서 분기는 곧 "어느 쪽이 문제인지 모르는 상태"** 를 만든다.
> `base: './'` 는 Android WebView(`https://localhost`)와 iOS WebView(`capacitor://localhost`) 양쪽에서 정상 동작하므로 단일 설정으로 충분하다. (§4.3)

---

## 2. 앱 아이덴티티 변경 절차 (`com.superdimension.app` → `com.bloodsworn.game`)

### 2.0 ⚠ 최우선 경고 — Android와 iOS **양쪽 모두** 되돌릴 수 없다

> **Android:** `applicationId` 는 Play Console에 앱을 한 번 생성해 업로드하면 영구히 변경할 수 없다.
> 같은 앱을 다른 ID로 다시 올리는 것은 "새 앱"이며, 기존 앱의 설치수·리뷰·테스터를 승계하지 못한다.
>
> **iOS:** `PRODUCT_BUNDLE_IDENTIFIER`(= bundle identifier) 역시 **첫 빌드를 App Store Connect에 업로드하면 영구 고정된다.**
> App ID 자체에 rename 기능이 없고, **한 번 쓴 ID는 재사용할 수 없다.** 틀리면 앱 레코드를 새로 만들어야 하며
> 평점·리뷰·업데이트 경로를 전부 잃는다. (신뢰도 중상 — Apple 공식 문장으로는 확보하지 못했으나 동작은 확실)
>
> **즉 스캐폴드 기본값 `com.superdimension.app` 으로 "테스트 삼아" 첫 업로드를 하면, 그 값이 양 스토어에서 그대로 동결된다.**
> **따라서 이 §2 작업은 Play Console에 첫 AAB를 올리기 전에, 그리고 App Store Connect에 첫 IPA를 올리기 전에 —
> 즉 Day 1에 끝내야 한다.** 앱 이름(`appName`, `app_name`, `CFBundleDisplayName`)은 나중에 바꿀 수 있지만, ID는 안 된다.

**왜 Android와 iOS의 ID를 같은 값으로 맞추는가**

Apple은 Android `applicationId` 와 일치시킬 것을 **요구하지 않는다.** 그럼에도 일치시키는 이유는 Capacitor 때문이다.
Capacitor는 `capacitor.config.json` 의 `appId` **하나**로 iOS `PRODUCT_BUNDLE_IDENTIFIER` 와 Android `applicationId` 를
함께 seed한다. 다르게 가져가면 **`cap sync` 를 돌릴 때마다 네이티브 프로젝트를 손으로 되돌려야 한다.**
7일 스코프에서 그런 수동 절차는 반드시 잊혀지고, 잊혀진 결과가 §2.0의 되돌릴 수 없는 사고다. → **`com.bloodsworn.game` 단일값.**

> `com.bloodsworn.game` 은 양쪽 형식 검증을 통과한다. **밑줄(`_`)이 없어야 한다** — Android는 허용하지만 Apple은 거부한다.
> **오늘(Day 1) 해야 할 일: Apple Developer Portal에 App ID 등록 + Play Console에 패키지명 선점.** 둘 다 무료·선착순·영구다.

### 2.1 수정해야 하는 파일 전량 (Android 7개 + 디렉토리 1건 + iOS 2개)

| # | 파일 | 현재 | 변경 후 |
|---|---|---|---|
| 1 | `FE/capacitor.config.json` | `appId: com.superdimension.app`, `appName: SuperDimension` | `com.bloodsworn.game`, `BLOODSWORN` |
| 2 | `FE/android/app/build.gradle` | `namespace "com.superdimension.app"`, `applicationId "com.superdimension.app"` | 둘 다 `com.bloodsworn.game` |
| 3 | `FE/android/app/src/main/res/values/strings.xml` | `app_name`, `title_activity_main`, `package_name`, `custom_url_scheme` 4개 문자열 | 아래 §2.2 |
| 4 | `FE/android/app/src/main/AndroidManifest.xml` | `.MainActivity` (상대 경로) | **변경 불필요** — `namespace` 를 따라간다. 단 §3의 방향 고정 속성은 추가 |
| 5 | 패키지 디렉토리 `FE/android/app/src/main/java/com/superdimension/app/` | `MainActivity.java` 안에 `package com.superdimension.app;` | `…/java/com/bloodsworn/game/` 로 이동 + `package com.bloodsworn.game;` |
| 6 | `FE/index.html` | `<title>fe</title>`, `lang="en"` | `<title>BLOODSWORN — 피의 서약</title>`, `lang="ko"` |
| 7 | `FE/package.json` | `"name": "superdimension"` | `"name": "bloodsworn"` |
| 8 | `FE/android/app/google-services.json` | (현재 없음. 있다면 package_name 필드) | Firebase 미사용이면 **생성하지 않는다** |
| **9** | **`FE/ios/App/App.xcodeproj/project.pbxproj`** | `PRODUCT_BUNDLE_IDENTIFIER = com.superdimension.app;` 가 **2곳**(Debug/Release 구성) | 둘 다 `com.bloodsworn.game` — **한쪽만 고치면 Release 빌드에서 옛 ID가 그대로 나간다** |
| **10** | **`FE/ios/App/App/Info.plist`** | `CFBundleDisplayName` = `SuperDimension` | `BLOODSWORN` |

> **iOS는 `CFBundleIdentifier` 를 직접 고치지 않는다.** `Info.plist` 의 값은 이미 `$(PRODUCT_BUNDLE_IDENTIFIER)` 변수 참조이며,
> 실제 값은 `project.pbxproj` 에 있다. 이 변수 참조를 리터럴 문자열로 바꿔 쓰지 말 것 — 두 곳이 어긋나는 순간 진단이 불가능해진다.
> 마찬가지로 `CFBundleShortVersionString` = `$(MARKETING_VERSION)`, `CFBundleVersion` = `$(CURRENT_PROJECT_VERSION)` 이므로
> **버전도 `project.pbxproj` 가 진실의 근원**이다. (§11.2)

> `FE/android/app/build.gradle` 의 하단 `google-services.json` 블록은 파일이 없으면 조용히 skip 되므로 건드리지 않아도 된다.
> `package.json` 의 `firebase` 의존성도 이번 주에 쓰지 않는다 → **제거하면 번들이 줄지만, 제거는 Day 6 이후 여유 있을 때만** (import 누락 리스크).

### 2.2 각 파일의 정확한 수정 내용

**① `FE/capacitor.config.json`**
```json
{
    "appId": "com.bloodsworn.game",
    "appName": "BLOODSWORN",
    "webDir": "dist",
    "bundledWebRuntime": false,
    "android": {
        "backgroundColor": "#0b0710",
        "allowMixedContent": false
    },
    "server": {
        "androidScheme": "https"
    }
}
```
- `backgroundColor` 를 정본 레터박스 색 `#0b0710`(`03-GDD-CORE.md` §2.1)으로 맞춘다. WebView 로드 직전 흰 플래시를 없앤다.
- `androidScheme: "https"` 는 Capacitor 7 Android 기본값이지만 **명시해두면 `localStorage` 오리진이 고정**되어 저장 데이터가 날아가는 사고를 막는다.

**② `FE/android/app/build.gradle`**
```gradle
android {
    namespace "com.bloodsworn.game"          // ← 변경
    compileSdk rootProject.ext.compileSdkVersion
    defaultConfig {
        applicationId "com.bloodsworn.game"  // ← 변경 (출시 후 변경 불가!)
        ...
    }
}
```

**③ `FE/android/app/src/main/res/values/strings.xml`** (전문 교체)
```xml
<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">BLOODSWORN</string>
    <string name="title_activity_main">BLOODSWORN</string>
    <string name="package_name">com.bloodsworn.game</string>
    <string name="custom_url_scheme">com.bloodsworn.game</string>
</resources>
```
> `app_name` 이 **런처 아이콘 밑에 뜨는 이름**이다. 한글 `피의 서약`을 넣고 싶다면 `values-ko/strings.xml` 을
> 따로 만들어 `<string name="app_name">피의 서약</string>` 로 오버라이드하는 것이 정석. 다만 7일 스코프에서는
> **`BLOODSWORN` 단일로 통일**을 권장(런처 이름과 스토어 이름 불일치는 심사에서 질문을 부른다).

**④ 패키지 디렉토리 이동** (Git Bash 기준)
```bash
cd "/c/Users/741u7/OneDrive/바탕 화면/PJT20260810/FE/android/app/src/main/java/com"
mkdir -p bloodsworn/game
git mv superdimension/app/MainActivity.java bloodsworn/game/MainActivity.java 2>/dev/null \
  || mv superdimension/app/MainActivity.java bloodsworn/game/MainActivity.java
rm -rf superdimension
# MainActivity.java 첫 줄을 수정
sed -i 's/^package com\.superdimension\.app;/package com.bloodsworn.game;/' bloodsworn/game/MainActivity.java
```
PowerShell 버전:
```powershell
$java = "C:\Users\741u7\OneDrive\바탕 화면\PJT20260810\FE\android\app\src\main\java\com"
New-Item -ItemType Directory -Force "$java\bloodsworn\game" | Out-Null
Move-Item "$java\superdimension\app\MainActivity.java" "$java\bloodsworn\game\MainActivity.java"
Remove-Item -Recurse -Force "$java\superdimension"
(Get-Content "$java\bloodsworn\game\MainActivity.java") `
  -replace '^package com\.superdimension\.app;', 'package com.bloodsworn.game;' `
  | Set-Content -Encoding utf8 "$java\bloodsworn\game\MainActivity.java"
```
> `androidTest` / `test` 아래의 `com/getcapacitor/myapp/` 는 템플릿 테스트라 **건드리지 않아도 빌드된다.**
> 신경 쓰이면 통째로 삭제해도 무방하다.

**⑤ `FE/index.html`**
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="./icon-32.png" />
    <meta name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#0b0710" />
    <title>BLOODSWORN — 피의 서약</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```
- `user-scalable=no` / `maximum-scale=1.0`: 모바일 WebView에서 **두 손가락 확대로 게임 화면이 틀어지는 사고**를 막는다.
- `viewport-fit=cover`: 노치 기기에서 좌우 세이프 인셋을 CSS `env(safe-area-inset-*)` 로 받을 수 있게 한다. `03-GDD-CORE.md` §2.1의 "HUD를 세이프 인셋 기준 배치" 요건에 필요.
- `/vite.svg` 참조는 파일이 지워지면 404가 나므로 실제 아이콘으로 교체하거나 줄 자체를 제거.

**⑥ `FE/package.json`**
```json
"name": "bloodsworn",
"version": "0.1.0",
```

**⑦ `FE/ios/App/App.xcodeproj/project.pbxproj` — 번들 ID (2곳)**

네이티브 프로젝트는 이미 생성되어 있으므로 `capacitor.config.json` 의 `appId` 만 고쳐서는 반영되지 않는다.
Android `build.gradle` 을 직접 고치는 것과 **정확히 같은 이유**다. 직접 치환한다:

```powershell
$pbx = "C:\Users\741u7\OneDrive\바탕 화면\PJT20260810\FE\ios\App\App.xcodeproj\project.pbxproj"
$txt = (Get-Content $pbx -Raw) -replace `
  'PRODUCT_BUNDLE_IDENTIFIER = com\.superdimension\.app;', `
  'PRODUCT_BUNDLE_IDENTIFIER = com.bloodsworn.game;'
# ⚠ BOM 없는 UTF-8로 써야 한다. Set-Content -Encoding utf8 은 BOM을 붙인다.
[System.IO.File]::WriteAllText($pbx, $txt, (New-Object System.Text.UTF8Encoding($false)))

# 검증 — 2줄 모두 bloodsworn 이어야 한다 (Debug 구성 1 + Release 구성 1)
Select-String -Path $pbx -Pattern 'PRODUCT_BUNDLE_IDENTIFIER'
```
> **`Set-Content -Encoding utf8` 을 쓰지 않는 이유:** Windows PowerShell 5.1은 UTF-8에 **BOM을 붙인다.**
> `project.pbxproj` 는 Xcode가 파싱하는 구조화 텍스트이고, 이 파일이 깨지면 **Mac이 없는 이 프로젝트에서는
> CI 로그의 파싱 에러 한 줄만 보고 원인을 추측해야 한다.** 편집 방식 하나로 왕복 한 번을 날릴 수 있다.

**⑧ `FE/ios/App/App/Info.plist` — 표시 이름**

```powershell
$plist = "C:\Users\741u7\OneDrive\바탕 화면\PJT20260810\FE\ios\App\App\Info.plist"
$txt = (Get-Content $plist -Raw) -replace '<string>SuperDimension</string>', '<string>BLOODSWORN</string>'
[System.IO.File]::WriteAllText($plist, $txt, (New-Object System.Text.UTF8Encoding($false)))
```
- `CFBundleDisplayName` 이 **홈 화면 아이콘 밑에 뜨는 이름**이다. Android `app_name` 과 같은 역할.
- Android와 동일하게 **`BLOODSWORN` 단일 표기로 통일**한다 (§2.2 ③의 근거와 동일).
- `CFBundleIdentifier` / `CFBundleShortVersionString` / `CFBundleVersion` 은 **변수 참조이므로 건드리지 않는다.**

### 2.3 변경 후 검증

```powershell
cd "C:\Users\741u7\OneDrive\바탕 화면\PJT20260810\FE"
# 옛 ID가 남아있는지 전수 검사 — 결과가 0줄이어야 한다
Get-ChildItem -Recurse -File -Exclude *.aab,*.apk,*.ipa `
  | Where-Object { $_.FullName -notmatch 'node_modules|\\build\\|\\dist\\|\.git|\\Pods\\|DerivedData' } `
  | Select-String -Pattern 'superdimension|SuperDimension' `
  | Select-Object Path, LineNumber, Line
```
> 이 명령이 한 줄이라도 뱉으면 아직 안 끝난 것이다. `cap sync` 전에 0줄을 만들 것.
> **이 검사는 `FE/ios/` 도 함께 훑는다.** iOS 쪽에 옛 ID가 남아 있으면 결과에 `project.pbxproj` 나 `Info.plist` 가 뜬다.
> `Pods/` 와 `DerivedData` 는 CI가 매번 새로 만드는 산출물이라 제외한다.
>
> **Android:** 변경 후 **반드시 `.\gradlew clean` 을 한 번 돌린다.** 이전 패키지명의 `R.java` 캐시가 남아 `namespace` 불일치 에러를 낸다.
> **iOS:** 대응되는 캐시는 `ios/App/Pods/` 와 `DerivedData` 이며, 둘 다 `.gitignore` 대상이라 **CI에는 애초에 올라가지 않는다.**
> 즉 이 사고는 iOS에서는 로컬 캐시 문제가 아니라 **커밋 누락 문제**로 나타난다 → 커밋 후 `git show --stat` 으로 `project.pbxproj` 가 포함됐는지 확인할 것.

---

## 3. 가로(Landscape) 방향 고정 설정

정본 `03-GDD-CORE.md` §2.1: `방향 고정 = landscape`.
**강제 수단은 플랫폼마다 다르고, 네이티브 설정이 유일한 진짜 강제 수단이다.**

| 플랫폼 | 방향을 강제하는 파일 | 절 |
|---|---|---|
| Android | `AndroidManifest.xml` 의 `android:screenOrientation="landscape"` | §3.1 |
| iOS | `Info.plist` 의 `UISupportedInterfaceOrientations` 배열 | §3.5 |
| 공통 | CSS·Phaser는 **강제가 아니라 대응**이다 (레터박스·세이프 인셋) | §3.3 |

### 3.1 `AndroidManifest.xml` 전문 (수정본)

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:hardwareAccelerated="true"
        android:theme="@style/AppTheme">

        <activity
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true"

            android:screenOrientation="landscape"
            android:resizeableActivity="false"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode|navigation">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
    </application>

    <!-- Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />

    <!-- 게임은 터치 스크린이 필수. Play가 기기 필터링에 사용한다 -->
    <uses-feature android:name="android.hardware.touchscreen" android:required="true" />
</manifest>
```

**각 속성의 이유**

| 속성 | 값 | 이유 |
|---|---|---|
| `android:screenOrientation` | `landscape` | 가로 고정. `sensorLandscape` 로 하면 180° 뒤집기를 허용하지만, **뒤집힐 때 세이프 인셋이 반대편으로 이동**해 HUD가 틀어진다. 7일 스코프에서는 `landscape` 단일 고정이 안전하다. |
| `android:resizeableActivity` | `false` | 태블릿/폴더블의 멀티윈도우·자유 크기 창에서 레이아웃이 깨지는 것을 막는다. |
| `android:configChanges` | `…density\|fontScale\|layoutDirection` **추가** | 원본 스캐폴드에는 `density`/`fontScale`/`layoutDirection`이 없다. 이게 빠지면 **폰트 크기·다크모드 변경 시 Activity가 재생성되어 게임이 처음부터 다시 시작**된다. 반드시 추가. |
| `android:hardwareAccelerated` | `true` | Phaser WebGL 성능. (기본값이지만 명시) |
| `uses-feature touchscreen` | required | 조이스틱 조작이 필수이므로 터치 없는 기기에 배포되면 안 된다. |

> ⚠ `configChanges` 에 `orientation|screenSize` 가 이미 있으므로 회전 시 Activity 재생성은 없다.
> 그러나 `screenOrientation="landscape"` 를 넣으면 애초에 회전 자체가 발생하지 않는다. 둘 다 유지하는 게 맞다.

### 3.2 전체화면 / 상태바 숨김

**방법 A — 테마 XML만으로 (플러그인 0개, 권장)**

`FE/android/app/src/main/res/values/styles.xml` 의 `AppTheme.NoActionBarLaunch` 에 다음을 추가:

```xml
<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
    <item name="android:background">@drawable/splash</item>

    <!-- 몰입 모드: 상태바/내비게이션바 숨김 -->
    <item name="android:windowFullscreen">true</item>
    <item name="android:windowTranslucentStatus">false</item>
    <item name="android:windowTranslucentNavigation">false</item>
    <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
    <item name="android:statusBarColor">#0b0710</item>
    <item name="android:navigationBarColor">#0b0710</item>
</style>
```
- `windowLayoutInDisplayCutoutMode=shortEdges`: 가로 모드에서 **노치 영역까지 화면을 확장**한다. 이걸 안 하면 노치 기기에서 한쪽에 검은 띠가 생긴다. 확장한 대신 CSS `env(safe-area-inset-left/right)` 로 HUD를 밀어야 한다.

**방법 B — 런타임 몰입 모드 (더 확실, `MainActivity.java` 수정)**

```java
package com.bloodsworn.game;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemUi();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();   // 알림 내렸다 올릴 때 다시 숨김
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
          | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
          | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
          | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
          | View.SYSTEM_UI_FLAG_FULLSCREEN
          | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }
}
```
- `FLAG_KEEP_SCREEN_ON`: 6분 런 중 화면이 꺼지면 안 된다. **게임에서는 사실상 필수.**
- `IMMERSIVE_STICKY`: 가장자리 스와이프로 잠깐 바가 나왔다가 자동으로 다시 숨는다. 게임에 적합.
- `setSystemUiVisibility` 는 API 30에서 deprecated 되었지만 API 36에서도 **동작한다.** `WindowInsetsControllerCompat`
  로 쓰는 것이 정석이나, 그러려면 `androidx.core` 의존성 확인이 필요하다 →
  ⚠ **7일 스코프에서는 위 코드로 시작하고, 실기기에서 안 먹으면 그때 교체.**

**추천 조합: A + B 둘 다 적용.** 테마만으로는 알림 내린 뒤 복귀 시 바가 남는 경우가 있다.

### 3.3 CSS 쪽 보강 (`FE/src/index.css`)

```css
html, body, #root {
    margin: 0; padding: 0;
    width: 100%; height: 100%;
    overflow: hidden;
    background: #0b0710;
    overscroll-behavior: none;          /* 당겨서 새로고침/바운스 차단 */
    -webkit-user-select: none; user-select: none;
    -webkit-tap-highlight-color: transparent;  /* 터치 시 파란 하이라이트 제거 */
    -webkit-touch-callout: none;        /* 롱프레스 컨텍스트 메뉴 차단 */
    touch-action: none;                 /* 조이스틱 드래그가 스크롤로 먹히는 것 방지 */
}

/* 세이프 인셋 (노치/제스처바) — HUD 컨테이너에 적용 */
.hud-safe {
    padding-left:  env(safe-area-inset-left,  0px);
    padding-right: env(safe-area-inset-right, 0px);
    padding-bottom:env(safe-area-inset-bottom,0px);
}

/* 세로로 들어온 경우 회전 안내 — 개발 중 브라우저 미리보기(§4.2 server.host)용 안전망.
   릴리스 앱에서는 Android Manifest(§3.1)와 iOS Info.plist(§3.5)가 세로를 애초에 차단하므로
   이 오버레이는 뜨지 않는다. 그래도 남겨둔다: 비용이 0이고, 방향 고정이 실기기에서
   먹지 않았을 때 "왜 이상한지"를 즉시 알려주는 진단 장치가 된다. */
@media (orientation: portrait) {
    #rotate-hint { display: flex; }
}
@media (orientation: landscape) {
    #rotate-hint { display: none; }
}
```
> `touch-action: none` 은 **가상 조이스틱이 동작하지 않는 문제의 90%를 예방**한다. §12 트러블슈팅 참조.
> 위 CSS 리셋(`-webkit-touch-callout`, `user-select`, `overscroll-behavior`)은 **iOS에서 추가로 심사상 의미가 있다.**
> 러버밴드 스크롤·텍스트 선택 핸들·롱프레스 콜아웃은 App Store 심사에서 "상자 안의 웹페이지"로 보이는 대표적 흔적이며,
> 가이드라인 4.2(최소 기능) 판정에 불리하게 작용한다. **이 리셋을 지우지 말 것.** (§7.5)

### 3.4 Capacitor 쪽 설정

Capacitor 7 코어 자체에는 방향 잠금 API가 없다. 방향의 진짜 강제 수단은 **Android는 `AndroidManifest.xml`,
iOS는 `Info.plist`** 이며, 둘 다 네이티브 설정이다.
`@capacitor/screen-orientation` 플러그인은 **웹/PWA용**이며, 네이티브 고정과 중복이라 이번 주에는 도입하지 않는다.
(정본 `03-GDD-CORE.md` §9의 "플러그인 최소화" 방침과 일치.)

> **플러그인 최소화 방침의 유일한 예외는 `@capacitor/preferences` 다.** iOS에서 `localStorage` 가 OS 회수 대상이라
> 세이브가 소실될 수 있기 때문이며, 방향 잠금처럼 "네이티브 설정으로 이미 해결되는 것"과는 성격이 다르다. 근거는 §12-H.

`capacitor.config.json` 에 iOS 블록을 추가한다 (§2.2 ①의 확장형):

```json
{
    "appId": "com.bloodsworn.game",
    "appName": "BLOODSWORN",
    "webDir": "dist",
    "bundledWebRuntime": false,
    "android": {
        "backgroundColor": "#0b0710",
        "allowMixedContent": false
    },
    "ios": {
        "backgroundColor": "#0b0710",
        "contentInset": "never"
    },
    "server": {
        "androidScheme": "https",
        "iosScheme": "capacitor"
    }
}
```
- `ios.backgroundColor`: Android와 같은 이유 — WebView 로드 직전 흰 플래시 제거. 정본 레터박스 색과 일치시킨다.
- `ios.contentInset: "never"`: WKWebView가 상단에 자동 인셋을 넣어 캔버스를 밀어내는 것을 막는다.
- **`iosScheme: "capacitor"` 를 명시하는 이유가 Android보다 훨씬 중요하다.**
  이 값이 곧 WebView의 **origin**(`capacitor://localhost`)이고, **origin이 바뀌면 그 origin에 묶인 세이브가 통째로 고아가 된다.**
  Android `androidScheme: "https"` 를 명시하는 것과 같은 사고 예방이지만, iOS는 로컬에서 재현할 수단이 없어 발견이 훨씬 늦다.
- ⚠ **이 값들은 첫 TestFlight 빌드 이후 절대 바꾸지 않는다.** 바꾸는 순간 기존 테스터의 세이브가 전량 유실된다.
  `server.url` 은 **릴리스 설정에 절대 남기지 않는다** — 원격 URL을 로드하는 빌드는 심사 가이드라인 4.2.2의
  "web clipping" 패턴에 정확히 해당한다. (§7.5)

Phaser 쪽은 정본 값 그대로:
```js
// FE/src/game/config.js — 정본 03-GDD-CORE.md §2.1 준수
export const GAME_CONFIG = {
    type: Phaser.AUTO,
    width: 640, height: 360,
    backgroundColor: '#0b0710',
    pixelArt: true,
    roundPixels: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // ...
};
```
> ⚠ **현재 스캐폴드는 `width:375, height:667`(세로) + `Scale.RESIZE` 이고, `GameManager.js` 가 존재하지 않는
> `./scenes/AudienceRoomScene.js` 를 import해 빌드가 깨진 상태다** (정본 §2.1 경고). **Day 1에 반드시 수정.**
> 빌드가 안 되면 이 문서의 나머지가 전부 무의미하다.

### 3.5 iOS 방향 고정 — `Info.plist`

**현재 스캐폴드 상태 (`FE/ios/App/App/Info.plist`)** — 세로가 허용되어 있다. 이대로 두면 세로로 뜬다.

```xml
<key>UISupportedInterfaceOrientations</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>        <!-- ← 제거 대상 -->
    <string>UIInterfaceOrientationLandscapeLeft</string>
    <string>UIInterfaceOrientationLandscapeRight</string>
</array>
```

**수정 후 (iPhone / iPad 양쪽)**

```xml
<key>UISupportedInterfaceOrientations</key>
<array>
    <string>UIInterfaceOrientationLandscapeLeft</string>
    <string>UIInterfaceOrientationLandscapeRight</string>
</array>
<key>UISupportedInterfaceOrientations~ipad</key>
<array>
    <string>UIInterfaceOrientationLandscapeLeft</string>
    <string>UIInterfaceOrientationLandscapeRight</string>
</array>
```

**각 항목의 이유**

| 항목 | 결정 | 이유 |
|---|---|---|
| `UIInterfaceOrientationPortrait` 제거 | 필수 | 배열에 남아 있으면 iOS가 세로를 허용한다. **배열에서 빼는 것이 iOS의 방향 고정 방식**이며, Android `screenOrientation` 처럼 별도 속성이 있는 게 아니다 |
| `LandscapeLeft` + `Right` **둘 다 유지** | 유지 | Android는 `landscape` 단일 고정(§3.1)을 택했지만, iOS에서 한쪽만 남기면 **폰을 반대로 들었을 때 화면이 뒤집힌 채 고정**된다. iOS는 두 가로 방향 사이 회전에서 세이프 인셋을 **좌우 대칭으로 보고**하므로(§F 인셋 조사) Android에서 `sensorLandscape` 를 피한 이유가 여기서는 성립하지 않는다 |
| `~ipad` 도 가로 2종만 | 유지 | `TARGETED_DEVICE_FAMILY = "1,2"`(iPhone+iPad)가 스캐폴드 기본값이다. iPad에서만 세로가 허용되면 레이아웃이 깨진다 |

> **`TARGETED_DEVICE_FAMILY` 를 이번 주에 `1`(iPhone 전용)로 줄이지 않는다.**
> 줄이면 대상 기기가 좁아져 안전해 보이지만, **TestFlight 실행 가능 기기에서 iPad가 빠진다.**
> Mac이 없는 이 프로젝트에서 실기기 접근 경로 하나를 스스로 없애는 셈이라 손해가 더 크다.
> ⚠ iPhone 전용 앱에서 **App Store 제출 시 iPad 스크린샷이 필요한지 여부는 확인 필요(2026-08-10 기준 미확인)** —
> 다만 **내부 TestFlight에는 스크린샷 자체가 불필요**하므로 Day 7 경로에는 걸리지 않는다. (§7.5)

**전체화면 / 상태바 — Android §3.2에 대응하는 iOS 쪽**

| 목적 | Android (§3.2) | iOS |
|---|---|---|
| 상태바 숨김 | `windowFullscreen` 테마 + 런타임 몰입 모드 | `Info.plist` 의 `UIStatusBarHidden = true` + `UIViewControllerBasedStatusBarAppearance = false` |
| 화면 꺼짐 방지 | `FLAG_KEEP_SCREEN_ON` | ⚠ 대응 수단 **확인 필요(2026-08-10 기준 미확인)**. 네이티브(`AppDelegate`) 수정이 필요할 수 있다 |
| 컷아웃까지 화면 확장 | `layoutInDisplayCutoutMode=shortEdges` | iOS는 기본이 전체 확장이다. **`index.html` 의 `viewport-fit=cover`(§2.2 ⑤)가 인셋을 CSS로 받는 스위치**이며 이미 들어가 있다 |

> ⚠ 위 상태바 2개 키의 조합이 **Capacitor 7 + WKWebView 환경에서 실제로 상태바를 숨기는지는 확인 필요(2026-08-10 기준 미확인)** 이다.
> **확실한 것은 방향 고정뿐이다** — 배열에서 항목을 빼는 것이므로 해석의 여지가 없다.
> 상태바는 **§0.1 수직 관통 리허설(Day 1~2)의 TestFlight 빌드에서 눈으로 확인**하고, 안 되면 그때 판단한다.
> **화면 꺼짐 방지가 안 되는 것이 상태바가 남는 것보다 훨씬 치명적**(6분 런 중 화면이 꺼진다)이므로, 둘 중 하나만 고쳐야 하면 이쪽을 먼저 본다.

> ⚠ **추가 관찰:** 스캐폴드 `Info.plist` 의 `UIRequiredDeviceCapabilities` 가 `armv7` 로 되어 있다.
> 이 값이 iOS 14 최소 타겟(64비트 전용) 환경에서 업로드 거부를 유발하는지는 **확인 필요(2026-08-10 기준 미확인)**.
> **지금 손대지 않는다** — 추측으로 고치면 무엇이 원인이었는지 알 수 없게 된다.
> §0.1 관통 리허설에서 업로드가 거부되면 **그때 이 값을 첫 번째 용의자로 본다.** (§10-C)

---

## 4. Vite 빌드 설정

### 4.1 현재 상태

`FE/vite.config.js` 는 이미 `base: "./"` 가 들어가 있다(👍 Capacitor 대응 완료). 청크 분리·에셋 임계값이 없다.

### 4.2 최종 형태 (교체안)

```js
// FE/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],

    // Capacitor WebView는 커스텀 스킴으로 서빙한다.
    //   Android: https://localhost/      iOS: capacitor://localhost/
    // 상대경로면 두 스킴 모두에서 동일하게 해석된다. 절대 '/'로 바꾸지 말 것.
    base: "./",

    resolve: {
        alias: { "@": path.resolve(__dirname, "src") },
    },

    build: {
        outDir: "dist",
        emptyOutDir: true,
        target: "es2020",          // Android 7(API 24)+ WebView / minSdk 23 대응 안전선
        sourcemap: false,          // 릴리스는 끔. 디버깅 필요 시 'hidden' 으로

        // 4KB 미만 에셋만 base64 인라인. 픽셀아트 스프라이트가 인라인되면
        // JS 번들이 부풀고 Phaser 텍스처 캐시 효율이 떨어지므로 낮게 유지한다.
        assetsInlineLimit: 4096,

        chunkSizeWarningLimit: 1600,   // phaser 청크가 1.3MB대라 기본 500KB 경고가 시끄럽다

        rollupOptions: {
            output: {
                manualChunks: {
                    // Phaser를 별도 청크로 분리 → 게임 로직만 고칠 때 phaser 청크가
                    // 그대로 재사용되어 재빌드/캐시가 빨라진다.
                    phaser: ["phaser"],
                    react: ["react", "react-dom"],
                },
                // 출력 파일명 고정 패턴 (디버깅/용량 추적 편의)
                entryFileNames: "assets/[name]-[hash].js",
                chunkFileNames: "assets/[name]-[hash].js",
                assetFileNames: "assets/[name]-[hash][extname]",
            },
        },
    },

    server: {
        host: true,     // 같은 와이파이의 실제 폰에서 http://<PC IP>:5173 으로 접속 테스트
        port: 5173,
    },
});
```

### 4.3 설정 근거

| 항목 | 값 | 근거 |
|---|---|---|
| `base` | `'./'` | **Capacitor WebView가 커스텀 스킴으로 서빙하기 때문.** Android는 `https://localhost`, iOS는 `capacitor://localhost` 다. 상대경로는 두 스킴 모두에서 동일하게 해석되지만, `/assets/...` 절대경로는 스킴/호스트 해석이 어긋나는 순간 404 → **흰 화면**이 된다. §12-A |
| `base` 를 `'/'` 로 바꾸지 않는 이유 | — | 흰 화면은 **iOS에서 특히 위험하다.** Android는 `chrome://inspect` 로 실기기 콘솔을 볼 수 있지만(§6.1), **Mac이 없으면 iOS WebView 콘솔을 볼 수단이 없다.** 즉 같은 사고인데 iOS에서는 원인 파악 비용이 몇 배다 |
| `manualChunks.phaser` | 별도 | Phaser 3.90 min 번들만 1.3MB대. 게임 로직만 고칠 때 phaser 청크가 그대로 재사용되어 재빌드·CI 캐시가 빨라진다. **CI 분(minute)이 유한한 자원**이므로 iOS 쪽에서 실이익이 있다(§6.4) |
| `assetsInlineLimit` | 4096 | 픽셀아트 PNG가 인라인되면 `pixelArt:true` 텍스처 로딩 경로가 달라져 필터링 사고가 난다. 낮게 유지. |
| `target` | `es2020` | `minSdkVersion 23`(Android 6) 기준 WebView는 업데이트 가능하지만, es2022 최신 문법(`.at()`, top-level await)은 구형 WebView에서 깨질 수 있다. |
| `sourcemap` | `false` | AAB에 소스맵이 들어가면 용량 증가 + 코드 노출. |

### 4.4 빌드 산출물 크기 확인

```powershell
cd "C:\Users\741u7\OneDrive\바탕 화면\PJT20260810\FE"
npm run build

# 전체 크기
"{0:N2} MB" -f ((Get-ChildItem -Recurse dist | Measure-Object Length -Sum).Sum / 1MB)

# 큰 파일 Top 15
Get-ChildItem -Recurse dist -File |
  Sort-Object Length -Descending |
  Select-Object -First 15 @{n='MB';e={"{0:N2}" -f ($_.Length/1MB)}}, Name, DirectoryName

# 확장자별 합계 (에셋이 범인인지 JS가 범인인지 즉시 판별)
Get-ChildItem -Recurse dist -File |
  Group-Object Extension |
  Select-Object Name, Count, @{n='MB';e={"{0:N2}" -f (($_.Group | Measure-Object Length -Sum).Sum/1MB)}} |
  Sort-Object MB -Descending
```

**목표 예산 (7일 스코프)**

| 구간 | 목표 | 한계선 |
|---|---|---|
| `dist/` 전체 | ≤ 25 MB | 40 MB |
| JS 번들 합 | ≤ 3 MB | 5 MB |
| AAB 최종 | ≤ 40 MB | Play 자체 상한과는 거리가 멀다. 이 예산은 다운로드 이탈률 기준 |
| IPA 최종 | ≤ 60 MB | ⚠ App Store의 셀룰러 다운로드 상한·바이너리 상한 수치는 **확인 필요(2026-08-10 기준 미확인)**. 같은 `dist/` 를 쓰므로 AAB와 큰 차이가 없어야 정상이며, **AAB보다 크게 벌어지면 그 자체가 이상 신호**다(불필요한 리소스가 iOS 번들에만 들어간 것) |

> **BGM(`asset/bgm/`)이 용량의 최대 위협이다.** WAV가 섞여 있으면 즉시 OGG/MP3(96~128kbps)로 변환할 것. §12-D 참조.
> **용량은 iOS에서 CI 시간으로도 환산된다.** 업로드·처리 대기가 길어지고, 그 대기는 §6.4의 유한한 빌드 분(minute)을 직접 갉아먹는다.

#### ★ APK 안의 리소스도 예산에 든다 — 스플래시 (2026-08-12 정리)

`dist/` 만 재면 안 된다. **APK 크기의 상당 부분이 `android/app/src/main/res/` 다.**
실제로 이 프로젝트는 스플래시 PNG 11장이 6.24MB 를 먹고 있었고, 그중 **세로용 5장(3.18MB)이 죽은 용량**이었다.

| | APK 크기 | 스플래시 PNG |
|---|---|---|
| 세로 스플래시 제거 전 | 18,622,231 B (17.76 MiB) | 11장 · 6.24 MiB |
| 제거 후 | 15,437,832 B (14.72 MiB) | 6장 · 3.05 MiB |
| 차이 | **−3,184,399 B (−3.04 MiB, −17.1%)** | −5장 |

**왜 지워도 되는가**
- 이 앱은 가로 고정이다 — `AndroidManifest.xml` 의 `screenOrientation="landscape"` + `resizeableActivity="false"`.
- `res/drawable/splash.png`(한정자 없는 기본)가 남아 있어 **세로 구성이 잡히더라도 그것으로 폴백**된다.
  Android 리소스 해석 규칙상 `-port` 한정자 후보가 없으면 한정자 없는 `drawable/` 이 매칭된다.
- 세로 스플래시가 보일 수 있는 유일한 순간은 "런처에서 뜬 직후, 회전 잠금이 적용되기 전 한 프레임" 뿐이고
  그 프레임의 배경색은 `styles.xml` 의 `windowSplashScreenBackground` = `@color/splashBackground`(VOID `#0b0710`)라
  **흰 플래시는 애초에 나지 않는다.** (에뮬레이터 검증 완료 — 콜드 스타트 → 타이틀 → 전투 진입 정상)

**되살리는 법**
`FE/tools/build-icons.mjs` 의 `PORTRAIT_SPLASH` 배열을 `ANDROID_SPLASH` 에 이어붙이고 `npm run build:icons`.
⚠ `res/drawable-port-*` 를 만드는 도구는 이 스크립트 하나뿐이다. `@capacitor/assets` 는 설치돼 있지 않고
`npx cap sync` 도 `res/` 의 이미지 리소스는 건드리지 않는다. **한 번 지우면 다시 생기지 않는다.**

> ⏭ 더 줄일 여지 — 남은 land 5장을 WebP(품질 80)로 바꾸면 추가로 2MB 안팎을 더 줄일 수 있다.
> minSdk 23 이므로 WebP 는 안전하다. 이번 주 스코프에서는 하지 않았다.


---

## 5. 서명 자산 생성 및 관리 (Android 키스토어 · iOS 인증서)

> §5.0~§5.4는 **Android**, §5.5는 **iOS**다. 두 플랫폼의 서명은 **개념도 절차도 전혀 다르다.**
>
> | | Android | iOS |
> |---|---|---|
> | 만드는 도구 | `keytool` (JDK 동봉, Windows에서 그대로) | **`openssl`** (Keychain Access는 macOS 전용이라 못 쓴다, §5.5) |
> | 만드는 것 | 키스토어 `.jks` 1개 | 개인키 + CSR → **배포 인증서 `.p12`** + **프로비저닝 프로파일** + **ASC API 키 `.p8`** |
> | 발급 주체 | 나 (자체 서명) | **Apple** (CSR을 올려 인증서를 받아온다) |
> | 쓰는 곳 | 로컬 Gradle | **CI 시크릿** (로컬에서 서명할 수단이 없다) |
> | 분실 시 | **복구 불가에 가깝다** — 프로젝트 종료급 사고 (§5.0) | 포털에서 폐기·재발급 절차가 존재한다. 단 **재발급 왕복이 CI 시행착오 1회를 더 먹는다** |

### 5.0 🔴 절대 경고

> **업로드 키를 분실하면 그 앱은 영원히 업데이트할 수 없다.**
> Play 앱 서명(Play App Signing)을 쓰면 Google이 배포용 키를 보관하므로 **업로드 키 분실은 복구 신청이 가능**하지만,
> 신청·처리에 수일이 걸리고 승인이 보장되지도 않는다. **7일 프로젝트에서 이 사고는 곧 프로젝트 종료다.**
> 키스토어 파일과 비밀번호는 **생성 즉시** §5.4 절차로 3중 백업한다.

### 5.1 keytool 명령 전문 (Windows)

`keytool` 은 **모든 JDK 에 들어 있다** — 어느 버전이든 상관없다(키스토어 생성에는 21 이 아니어도 된다).
⚠ 이 PC 에는 **Android Studio 가 설치돼 있지 않다.** 예전 판 문서가 안내하던
`C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe` 는 **존재하지 않는 경로**다. 실제 경로는:
`C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot\bin\keytool.exe`

```powershell
# 0) keytool 위치 확인 (PATH에 없으면 절대 경로로 실행)
$keytool = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot\bin\keytool.exe"
if (-not (Test-Path $keytool)) { $keytool = (Get-Command keytool).Source }
& $keytool -help | Select-Object -First 3

# 1) 키스토어 보관 폴더 — ⚠ 프로젝트 폴더 "밖"에 만든다 (git에 섞이는 사고 원천 차단)
$keyDir = "$env:USERPROFILE\.android-keys\bloodsworn"
New-Item -ItemType Directory -Force $keyDir | Out-Null

# 2) 업로드 키스토어 생성 (RSA 2048 / 10000일 = 약 27년)
& $keytool -genkeypair -v `
  -keystore "$keyDir\bloodsworn-upload.jks" `
  -storetype PKCS12 `
  -alias bloodsworn-upload `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -dname "CN=BLOODSWORN, OU=Solo, O=Bloodsworn, L=Seoul, S=Seoul, C=KR"
```
실행하면 `키 저장소 비밀번호`를 두 번 묻는다. PKCS12 형식에서는 **키 비밀번호 = 저장소 비밀번호**로 동일하게 잡힌다.

> **`-validity 10000`(≈27년) 미만으로 잡지 말 것.** Google Play는 키 만료 후 업데이트를 거부한다.
> `-storetype PKCS12` 를 명시한다. JKS는 레거시라 keytool이 경고를 뱉는다.
> `-dname` 에 실명·실주소를 넣을 필요는 없다. 이 값은 스토어에 노출되지 않는다.

**비밀번호 규칙:** 최소 16자, 영문 대소문자+숫자+기호. 비밀번호 관리자에 저장.
`Set-Content` 로 메모장에 적어두고 그걸 git에 올리는 사고가 실제로 가장 흔하다.

### 5.2 `key.properties` 방식으로 Gradle에 주입

**① `FE/android/key.properties` 생성 (git 제외 대상)**
```properties
storeFile=C:/Users/741u7/.android-keys/bloodsworn/bloodsworn-upload.jks
storePassword=여기에_실제_비밀번호
keyAlias=bloodsworn-upload
keyPassword=여기에_실제_비밀번호
```
> ⚠ **경로 구분자는 `/` 또는 `\\` 를 쓴다.** Windows 경로를 `\` 하나로 쓰면 Java Properties가 이스케이프로 먹어 `C:UsersXXX` 가 된다.

**② `FE/.gitignore` 에 추가 (지금 당장)**
```gitignore
# --- Android 서명: 절대 커밋 금지 ---
android/key.properties
*.jks
*.keystore
key.properties

# --- iOS 서명: 절대 커밋 금지 (§5.5) ---
*.p12
*.p8
*.mobileprovision
*.cer
*.csr
*.pem
*.key
AuthKey_*.p8

# --- 빌드 산출물 ---
dist/
android/app/build/
android/build/
android/.gradle/
android/app/src/main/assets/public/
ios/App/build/
ios/App/Pods/
ios/App/output/
ios/App/App/public/
ios/DerivedData/
*.aab
*.apk
*.apks
*.ipa
*.xcarchive
node_modules/
```
> 이미 커밋한 적이 있다면 `.gitignore` 추가만으로는 안 지워진다.
> `git rm --cached android/key.properties` 로 인덱스에서 빼고, **이미 push했다면 그 키는 폐기하고 새로 만든다.**
>
> **iOS 서명 자산에는 §5.0의 키스토어 경고가 그대로, 같은 강도로 적용된다.**
> `.p12`(배포 인증서+개인키), `.p8`(App Store Connect API 키), `.mobileprovision`(프로비저닝 프로파일)이 유출되면
> **제3자가 당신의 이름으로 서명된 앱을 만들 수 있다.**
> ⚠ `.p8` 은 발급 시 **한 번만 다운로드된다고 알려져 있다**(2026-08-10 기준 미확인). 사실 여부와 무관하게
> **받는 즉시 백업하는 것이 정답**이므로 그렇게 취급한다.
> 이 4종은 저장소가 아니라 **CI 시크릿과 비밀번호 관리자에만** 존재해야 한다. (§5.5)
>
> ⚠ **`FE/ios/.gitignore` 가 이미 존재하며** `App/build`, `App/Pods`, `App/output`, `App/App/public`, `DerivedData`, `xcuserdata` 를 덮고 있다.
> 하지만 **서명 자산은 거기 없다.** 위 iOS 서명 블록은 반드시 `FE/.gitignore` 에 직접 추가할 것.
>
> ⚠ **`ios/App/Pods/` 를 커밋하지 않는다는 것은 CI가 `pod install` 을 반드시 돌려야 한다는 뜻**이다. §6.4의 CI 단계와 짝이다.

**③ `FE/android/app/build.gradle` 수정 (서명 블록 추가)**

```gradle
apply plugin: 'com.android.application'

// key.properties 로드 — 파일이 없으면 디버그 서명으로 폴백 (CI/타인 클론 대비)
def keystorePropertiesFile = rootProject.file("key.properties")
def keystoreProperties = new Properties()
def hasReleaseKey = keystorePropertiesFile.exists()
if (hasReleaseKey) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    namespace "com.bloodsworn.game"
    compileSdk rootProject.ext.compileSdkVersion

    defaultConfig {
        applicationId "com.bloodsworn.game"
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "0.1.0"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
        aaptOptions {
            ignoreAssetsPattern '!.svn:!.git:!.ds_store:!*.scc:.*:!CVS:!thumbs.db:!picasa.ini:!*~'
        }
    }

    signingConfigs {
        if (hasReleaseKey) {
            release {
                storeFile     file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias      keystoreProperties['keyAlias']
                keyPassword   keystoreProperties['keyPassword']
            }
        }
    }

    buildTypes {
        release {
            if (hasReleaseKey) {
                signingConfig signingConfigs.release
            }
            // ⚠ 7일 스코프 기본값: minify OFF.
            //    Phaser/React 리플렉션 관련 난독화 사고를 원천 차단한다. (§12-E)
            minifyEnabled false
            shrinkResources false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            debuggable false
        }
        debug {
            applicationIdSuffix ".debug"   // 릴리스 빌드와 동시에 설치 가능
            versionNameSuffix "-debug"
            debuggable true
        }
    }

    // 빌드 재현성: 소스/타깃 자바 버전 명시
    // ★ 21 이다. 17 로 적으면 소스 레벨 21 로 컴파일된 :capacitor-android 를
    //   :app 이 읽지 못해 깨진다. 근거는 §6.0 표.
    // ⚠ 실제로는 이 블록을 손으로 넣을 필요가 없다 — `cap sync` 가 생성하는
    //   android/app/capacitor.build.gradle 이 이미 VERSION_21 을 넣어준다.
    //   (현재 저장소의 app/build.gradle 에 compileOptions 가 없는 이유다.)
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_21
        targetCompatibility JavaVersion.VERSION_21
    }

    packagingOptions {
        // 중복 라이선스 파일 충돌 예방
        resources.excludes += ['META-INF/LICENSE*', 'META-INF/NOTICE*']
    }
}
// ... (이하 repositories / dependencies 는 기존 그대로)
```

> ⚠ `applicationIdSuffix ".debug"` 를 넣으면 디버그 앱의 패키지가 `com.bloodsworn.game.debug` 가 된다.
> `strings.xml` 의 `custom_url_scheme` 과 불일치하지만 딥링크를 쓰지 않는 이번 주에는 문제 없다.
> 딥링크를 쓰게 되면 이 suffix를 제거할 것.

### 5.3 서명 검증

```powershell
$keyDir  = "$env:USERPROFILE\.android-keys\bloodsworn"
$keytool = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot\bin\keytool.exe"

# ① 키스토어 내용 + SHA-256 지문 확인 (Play Console에 등록된 지문과 대조용)
& $keytool -list -v -keystore "$keyDir\bloodsworn-upload.jks" -alias bloodsworn-upload

# ② AAB가 실제로 서명되었는지 확인 (AAB는 jarsigner 서명)
$jarsigner = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot\bin\jarsigner.exe"
& $jarsigner -verify -verbose -certs `
  "android\app\build\outputs\bundle\release\app-release.aab" | Select-String -Pattern "jar verified|CN="

# ③ APK라면 apksigner (build-tools 안에 있음)
$apksigner = "$env:LOCALAPPDATA\Android\Sdk\build-tools\35.0.0\apksigner.bat"
& $apksigner verify --print-certs "path\to\app-release.apk"
```
- `jar verified.` 가 나오면 성공. `no manifest` / `unsigned` 가 나오면 `signingConfig` 가 안 붙은 것이다.
- **Play Console 업로드 시 "이 앱 번들은 서명되지 않았습니다" 에러가 나면** → `key.properties` 경로 오타 또는
  `hasReleaseKey` 가 false로 평가된 경우다. `.\gradlew :app:signingReport` 로 확인.

### 5.4 백업 절차 (생성 직후 즉시 수행 — 미루지 말 것)

| # | 위치 | 내용 | 비고 |
|---|---|---|---|
| 1 | 로컬 `%USERPROFILE%\.android-keys\bloodsworn\` | `.jks` 원본 | 작업용 |
| 2 | 암호화 압축본을 클라우드(OneDrive/Drive) 비공개 폴더 | `.jks` + `key.properties` 를 7z AES-256 압축 | 압축 비밀번호는 키 비밀번호와 **다르게** |
| 3 | USB 또는 별도 물리 매체 | 2와 동일 압축본 | 오프라인 사본 |
| 4 | 비밀번호 관리자 | `storePassword` / `keyPassword` / `keyAlias` / SHA-256 지문 | 파일과 비밀번호는 **다른 곳에** |

```powershell
# 암호화 백업 (7-Zip 설치 시)
$keyDir = "$env:USERPROFILE\.android-keys\bloodsworn"
& "C:\Program Files\7-Zip\7z.exe" a -t7z -mhe=on -p `
  "$env:USERPROFILE\OneDrive\_keys\bloodsworn-key-backup-$(Get-Date -f yyyyMMdd).7z" `
  "$keyDir\*"
```
> `-mhe=on` 은 **파일명까지 암호화**한다. 이거 없으면 클라우드에 "bloodsworn-upload.jks"라는 이름이 그대로 노출된다.

**체크리스트 (Day 1 종료 시 전부 ✅ 여야 함)**
- [ ] `.jks` 생성 완료
- [ ] `key.properties` 작성 + `.gitignore` 반영 확인 (`git status` 에 안 뜨는지 눈으로 확인)
- [ ] `.\gradlew :app:signingReport` 로 release 항목에 지문이 뜸
- [ ] 백업 3중 완료
- [ ] 비밀번호 관리자 등록 완료

### 5.5 ★ iOS 서명 자산 — Mac 없이 만드는 법

> **이 절이 이 문서에서 두 번째로 중요하다** (첫 번째는 §5.0의 키스토어 경고).
> iOS 배포에서 실패의 대부분은 게임이 아니라 여기서 난다. 그리고 **Mac이 없으므로 로컬에서 재현할 수 없다.**

#### 5.5.0 왜 별도의 절차가 필요한가

Apple 문서와 대부분의 튜토리얼은 **Keychain Access(macOS 전용 앱)로 CSR을 만들라**고 안내한다.
Mac이 없으면 그 문장에서 막히고, 이 프로젝트는 정확히 거기서 막힌다(§A4: Windows, Mac 없음).

**해결: `openssl` 만으로 전부 만들 수 있다.** Keychain Access가 하는 일은 결국
"RSA 개인키를 만들고, 그걸로 CSR에 서명하고, 나중에 인증서와 묶어 `.p12` 로 내보내는 것"이며 전부 표준 암호 연산이다.
Apple 개발자 포럼에도 이 경로에 대한 스레드가 있다.

> **Windows에서 `openssl` 얻는 법:** Git for Windows에 동봉되어 있다 → **Git Bash를 열고 `openssl version`** 을 쳐 보면 나온다.
> 아래 명령은 전부 **Git Bash 기준**이다(§2.2 ④에서 이미 쓰는 것과 같은 셸).

#### 5.5.1 개인키 + CSR 생성 (Git Bash)

```bash
# 프로젝트 폴더 "밖"에 만든다 — Android 키스토어와 같은 이유 (git 혼입 원천 차단)
mkdir -p ~/.apple-keys/bloodsworn && cd ~/.apple-keys/bloodsworn

# 1) 개인키 생성
openssl genrsa -out distribution.key 2048

# 2) CSR 생성 (이 파일을 Apple 포털에 올린다)
openssl req -new -key distribution.key -out distribution.csr \
  -subj "/emailAddress=<Apple ID 메일>/CN=<이름>/C=KR"
```

#### 5.5.2 Apple Developer Portal에서 배포 인증서 받기

```
Apple Developer Portal → Certificates, Identifiers & Profiles → Certificates → [+]
  → "Apple Distribution" (또는 App Store and Ad Hoc) 선택
  → 위에서 만든 distribution.csr 업로드
  → distribution.cer 다운로드
```

#### 5.5.3 `.cer` → `.p12` (CI가 먹는 형식)

```bash
cd ~/.apple-keys/bloodsworn

# 3) .cer → .pem
openssl x509 -inform der -in distribution.cer -out distribution.pem

# 4) .pem + 개인키 → .p12.  반드시 암호를 건다 (CI 시크릿으로 암호도 함께 넣는다)
openssl pkcs12 -export -inkey distribution.key -in distribution.pem -out distribution.p12
```

> **암호 없는 `.p12` 를 만들지 말 것.** CI 로그·아티팩트에 노출되는 순간 그대로 쓸 수 있는 서명 수단이 된다.
> 암호 규칙은 §5.1의 키스토어 비밀번호 규칙(16자 이상)을 그대로 적용한다.

#### 5.5.4 프로비저닝 프로파일

```
Apple Developer Portal → Identifiers 에서 App ID 등록 (com.bloodsworn.game)  ← §2.0에서 이미 했어야 한다
  → Profiles → [+] → "App Store Connect" (배포용) 선택
  → 위 App ID + 위에서 만든 배포 인증서 선택
  → .mobileprovision 다운로드
```
- **Mac이 필요 없다.** 전부 웹 포털에서 끝난다.
- 프로파일은 **App ID와 인증서에 묶여 있다.** 인증서를 재발급하면 **프로파일도 다시 만들어야 한다.**
- ⚠ 프로파일 만료 기간은 **확인 필요(2026-08-10 기준 미확인)**. 7일 프로젝트 내에서는 문제되지 않는다.

#### 5.5.5 App Store Connect API 키 (`.p8`)

```
App Store Connect → Users and Access → Integrations(또는 Keys) → App Store Connect API
  → [+] 로 키 생성 → AuthKey_XXXXXXXXXX.p8 다운로드
  → 화면에 표시되는 Issuer ID 와 Key ID 를 함께 기록
```

**이게 왜 필수인가 — 대안이 없다**

| 인증 방식 | 문제 |
|---|---|
| Apple ID + 비밀번호 | **2FA 때문에 CI에서 비대화식으로 못 쓴다** |
| Apple ID + 앱 암호(app-specific password) | 2FA·다중 provider 상황에서 문제 보고가 있다 |
| **ASC API 키 (`.p8` + Issuer ID + Key ID)** | ★ **2FA를 우회할 수 있는 유일한 방법.** CI 표준 |

> **즉 `.p8` 이 없으면 CI에서 업로드 자체가 불가능하다.** 서명이 되어도 올릴 수가 없다.
> 이 셋(`.p8` / Issuer ID / Key ID)은 **한 세트로 묶어** 비밀번호 관리자에 저장한다. 하나만 있으면 쓸모가 없다.

#### 5.5.6 CI에 넣는 시크릿 4종

바이너리 파일은 **base64로 인코딩해서** 시크릿 값으로 넣는다(줄바꿈 없이).

```bash
cd ~/.apple-keys/bloodsworn
base64 -w0 distribution.p12          > p12.b64
base64 -w0 profile.mobileprovision   > profile.b64
base64 -w0 AuthKey_XXXXXXXXXX.p8     > p8.b64
# macOS/BSD base64 에는 -w0 이 없다. CI 문서의 예제를 따를 것.
```

| # | 시크릿 이름(예) | 값 | 비고 |
|---|---|---|---|
| 1 | `IOS_DIST_P12_BASE64` | `distribution.p12` 의 base64 | 배포 인증서 + 개인키 |
| 2 | `IOS_DIST_P12_PASSWORD` | §5.5.3에서 건 암호 | 1과 반드시 세트 |
| 3 | `IOS_PROVISION_PROFILE_BASE64` | `.mobileprovision` 의 base64 | App ID·인증서에 묶임 |
| 4 | `ASC_KEY_P8_BASE64` + `ASC_ISSUER_ID` + `ASC_KEY_ID` | API 키 3요소 | 업로드 전용 |

> ⚠ **시크릿을 출력하는 CI 스텝을 만들지 말 것.** `echo $IOS_DIST_P12_PASSWORD` 한 줄이 로그에 남으면 끝이다.
> 대부분의 CI는 시크릿을 자동 마스킹하지만, **base64로 조각내 출력하면 마스킹을 빠져나간다.**

#### 5.5.7 🔴 커밋 금지 — §5.0과 같은 강도

> **`.key` · `.csr` · `.cer` · `.pem` · `.p12` · `.p8` · `.mobileprovision` 은 절대 커밋하지 않는다.**
> 이 프로젝트는 §6.4 때문에 **소스를 GitHub 원격 저장소에 push한다.** 저장소가 private이어도 마찬가지다 —
> 공개 전환 실수, 협업자 추가, 포크 한 번이면 그대로 유출이다.
>
> `FE/.gitignore` 의 iOS 블록(§5.2 ②)이 이걸 막는다. **`git status` 에 안 뜨는지 눈으로 확인하고 나서 첫 push를 한다.**
> 이미 push했다면 **그 인증서·키는 포털에서 폐기(revoke)하고 새로 만든다.** 히스토리에서 지우는 것으로는 부족하다.

#### 5.5.8 백업 (생성 직후 즉시 — §5.4와 동일 절차)

| # | 위치 | 내용 |
|---|---|---|
| 1 | 로컬 `~/.apple-keys/bloodsworn/` | 원본 전량 |
| 2 | 7z AES-256 (`-mhe=on`) 암호화 압축본 → 클라우드 비공개 폴더 | 1과 동일 |
| 3 | 비밀번호 관리자 | `.p12` 암호 / Issuer ID / Key ID / Apple ID |

> `.p8` 은 §5.2의 주석대로 **받는 즉시** 2·3번에 넣는다. 다운로드 창을 닫고 나서 찾지 말 것.

**체크리스트 (§0.1 관통 리허설 시작 전 전부 ✅ 여야 함)**
- [ ] Apple Developer Portal에 App ID `com.bloodsworn.game` 등록
- [ ] `distribution.p12` 생성 + 암호 기록
- [ ] App Store 배포용 `.mobileprovision` 다운로드
- [ ] `AuthKey_*.p8` + Issuer ID + Key ID 확보
- [ ] 4종 전부 base64로 CI 시크릿에 등록
- [ ] `git status` 에 서명 파일이 하나도 안 뜸
- [ ] 백업·비밀번호 관리자 등록 완료

---

## 6. 릴리스 빌드 절차 (명령어 단위)

### 6.0 사전 환경 확인 (Day 1 1회)

```powershell
node -v          # v20 이상 권장 (Vite 7 요구사항)
npm -v
java -version    # ★ JDK 21 이어야 한다. 17 이면 빌드가 죽는다 — 아래 근거
adb version
echo $env:JAVA_HOME
echo $env:ANDROID_HOME     # 보통 C:\Users\<user>\AppData\Local\Android\Sdk
```

#### ★ JDK 21 이 필요한 이유 (2026-08-12 실측 정정)

**이 문서는 원래 "JDK 17 을 쓰라"고 단언했다. 틀렸다.** 왜 그렇게 적혀 있었는지부터 알아야 다시 헷갈리지 않는다.

| 무엇이 | 최소 요구 JDK | 근거 파일 |
|---|---|---|
| Gradle 8.11.1 자체 | 8 이상 (정식 지원 상한 21) | `android/gradle/wrapper/gradle-wrapper.properties` |
| AGP 8.10.1 자체 | **17** | `android/build.gradle` |
| **`:capacitor-android` 모듈** | **21** | `FE/node_modules/@capacitor/android/capacitor/build.gradle` 의 `compileOptions` → `sourceCompatibility JavaVersion.VERSION_21` |
| `:app`, `:capacitor-cordova-android-plugins` | **21** | `android/app/capacitor.build.gradle`, `android/capacitor-cordova-android-plugins/build.gradle` — 둘 다 `VERSION_21`. `cap sync` 가 생성하므로 손으로 못 내린다 |

즉 **원래 서술이 본 것은 "AGP/Gradle 툴체인"이고, 실제로 발목을 잡는 것은 "Capacitor 7 이 요구하는 소스 레벨"이다.**
AGP·Gradle 만 놓고 보면 17 이 맞다. 그래서 그럴듯해 보였고 오래 살아남았다.
하지만 이 프로젝트는 Capacitor 7 을 쓰므로 **JDK 17 로 빌드하면 이렇게 죽는다**:

```
> Task :capacitor-android:compileDebugJavaWithJavac FAILED
  error: invalid source release: 21
```

> ⚠ **`invalid source release: 21` 과 `Unsupported class file major version` 은 정반대 방향의 에러다.**
> 앞의 것은 **JDK 가 낮아서** 21 소스를 못 컴파일하는 것이고, 뒤의 것은 **JDK 가 Gradle 이 감당 못 할 만큼 높을 때** 난다.
> Gradle 8.11.1 은 JDK 21 을 정식 지원하므로 이 조합에서 뒤의 에러는 나지 않는다. §12-B

**이 PC 의 검증된 설정** (2026-08-12 디버그 APK 빌드 + 에뮬레이터 전투 진입까지 확인)

```powershell
# PowerShell — 세션 한정
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot"
$env:PATH      = "$env:JAVA_HOME\bin;$env:PATH"
# 영구 설정
[Environment]::SetEnvironmentVariable("JAVA_HOME","C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot","User")
```
```bash
# Git Bash — 세션마다 export 한다
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.12.8-hotspot"
export ANDROID_HOME="/c/Users/741u7/AppData/Local/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
```

**검증된 빌드 명령** (Git Bash, `FE/` 에서)
```bash
npm run build && npx cap sync android && cd android && ./gradlew.bat assembleDebug
# 산출물: FE/android/app/build/outputs/apk/debug/app-debug.apk
```

- ⚠ **Android Studio 내장 JBR 을 그대로 쓰지 마라.** Studio 2024.x 계열의 JBR 은 JDK 17 이라 위 에러에 그대로 걸린다.
  Studio 로 빌드해야 한다면 `File → Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK` 를 **21** 로 바꾼다.
- ⚠ **`JAVA_HOME` 을 바꿨는데 안 먹으면 `.\gradlew --stop`** 을 안 한 것이다. 데몬이 옛 JDK 로 살아 있다. §12-B
- JDK 를 더 올리는 것(24 등)은 검증하지 않았다. Gradle 8.11.1 의 정식 지원 상한이 21 이므로 **21 에 고정한다.**

**CI 는 어떤가 (2026-08-12 점검)**

| 파일 | Android 를 빌드하나 | JDK 지정 | 상태 |
|---|---|---|---|
| `codemagic.yaml` | ❌ iOS 전용 (`xcode-project build-ipa`) | 없음 | 문제 없음 |
| `.github/workflows/ios-testflight.yml` | ❌ iOS 전용 (`xcodebuild`) | 없음 | 문제 없음 |

**즉 현재 CI 에는 JDK 버전 문제가 없다.** Gradle 을 도는 CI 잡 자체가 없기 때문이다.
Android 릴리스는 §6.2 대로 이 PC 에서 굽는다.

> ⚠ **나중에 Android CI 를 붙이는 사람에게** — 러너의 기본 JDK 를 믿지 마라. 반드시 21 을 명시한다.
> ```yaml
> - uses: actions/setup-java@v4
>   with: { distribution: temurin, java-version: '21' }
> ```
> Codemagic 이라면 워크플로 `environment:` 에 `java: 21`. 명시하지 않으면 러너 기본값이 17 로
> 떨어지는 날 `invalid source release: 21` 로 릴리스가 막힌다.
> 그때 `versionCode` 주입 방법은 §11.1 (`ANDROID_VERSION_CODE`) 을 볼 것.

> **iOS에는 이 절에 대응하는 로컬 확인 항목이 없다.** Xcode 16+ / CocoaPods / macOS는 **전부 CI 이미지 안에 있고**,
> 이 PC에는 설치할 수도 없다. 로컬에서 확인할 수 있는 것은 **Node 20+ 하나뿐**이며 그건 위 `node -v` 로 이미 본다.
> **iOS 환경 확인 = 첫 CI 빌드 로그를 읽는 것**이다(§6.4.5). 이 비대칭이 iOS 작업을 Day 1~2로 앞당기는 이유다.

### 6.1 A코스 — 디버그 빌드로 실기기 테스트 (Day 2부터 매일)

```powershell
cd "C:\Users\741u7\OneDrive\바탕 화면\PJT20260810\FE"

# 0) 폰 준비: 설정 → 휴대전화 정보 → 빌드번호 7회 탭 → 개발자 옵션 → USB 디버깅 ON
#    USB 연결 후 폰에 뜨는 "USB 디버깅을 허용하시겠습니까?" → 항상 허용 체크 → 확인
adb devices        # 'device' 로 떠야 함. 'unauthorized' 면 위 팝업 미승인 상태

# 1) 웹 빌드 + 네이티브 동기화
npm run build
npx cap sync android

# 2) 디버그 APK 빌드
cd android
.\gradlew assembleDebug

# 3) 설치 (-r: 재설치, -t: 테스트 앱 허용)
adb install -r -t app\build\outputs\apk\debug\app-debug.apk

# 4) 바로 실행
adb shell am start -n com.bloodsworn.game.debug/com.bloodsworn.game.MainActivity

# 5) 로그 보기 (WebView 콘솔 + 크래시)
adb logcat -c
adb logcat *:E chromium:V Capacitor:V AndroidRuntime:E
```

**한 방 스크립트** — `FE/scripts/dev-device.ps1` 로 저장해두면 매번 이거 하나만 돌리면 된다:
```powershell
# FE/scripts/dev-device.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

npm run build
npx cap sync android
Set-Location "$root\android"
.\gradlew assembleDebug
adb install -r -t "app\build\outputs\apk\debug\app-debug.apk"
adb shell am start -n com.bloodsworn.game.debug/com.bloodsworn.game.MainActivity
Write-Host "설치 완료. logcat: adb logcat *:E chromium:V" -ForegroundColor Green
```

**Chrome DevTools로 실기기 WebView 디버깅 (매우 중요)**
1. 폰을 USB로 연결한 채 앱 실행
2. PC Chrome에서 `chrome://inspect/#devices` 접속
3. `com.bloodsworn.game.debug` 항목의 **inspect** 클릭 → 실기기 화면을 그대로 DevTools로 디버깅
> 디버그 빌드(`debuggable true`)에서만 목록에 뜬다. **릴리스 빌드는 안 뜬다.**
> "실기기에서만 나는 버그"는 대부분 여기서 5분 안에 잡힌다.

### 6.2 B코스 — 릴리스 AAB 생성 (Day 6~7)

> **선행 조건 2가지**
> 1. **JDK 21** 이어야 한다(§6.0). 17 이면 `:capacitor-android:compileDebugJavaWithJavac` 에서 죽는다.
> 2. `versionCode` 는 **건드리지 않는다.** 아래 `bundleRelease` 가 `version.properties` 를 자동으로 +1 한다(§11.1 T243).
>    빌드 로그의 `[T243] versionCode N -> N+1` 줄을 확인하고, **끝난 뒤 그 파일을 커밋한다.**
>
> **한 방 명령** — 아래 2~6단계를 묶은 npm 스크립트가 있다. JDK 21 검사까지 먼저 해준다.
> ```powershell
> npm run release:aab      # = npm run build && npx cap sync android && gradlew bundleRelease
> npm run release:apk      # 릴리스 APK 가 필요할 때
> ```
> 두 스크립트의 실체는 `FE/tools/gradle.mjs` 다.


```powershell
cd "C:\Users\741u7\OneDrive\바탕 화면\PJT20260810\FE"

# 1) 클린 (패키지명 변경 후 첫 빌드라면 필수)
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Set-Location android
.\gradlew clean
Set-Location ..

# 2) 웹 빌드
npm run build

# 3) 산출물 확인 (index.html 이 dist 루트에 있는지)
Get-ChildItem dist | Select-Object Name, Length

# 4) 네이티브 동기화
npx cap sync android

# 5) 동기화 검증 — 이 폴더에 dist 내용이 들어와 있어야 한다
Get-ChildItem android\app\src\main\assets\public | Select-Object Name

# 6) 릴리스 AAB 빌드
Set-Location android
.\gradlew bundleRelease

# 7) 결과 확인
$aab = "app\build\outputs\bundle\release\app-release.aab"
Get-Item $aab | Select-Object FullName, @{n='MB';e={"{0:N2}" -f ($_.Length/1MB)}}, LastWriteTime

# 8) 서명 검증
& "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot\bin\jarsigner.exe" -verify $aab
```

**참고: 릴리스 APK도 필요하다면** (Play를 거치지 않고 지인에게 직접 전달하거나, 디바이스 팜에 올릴 용도)
```powershell
.\gradlew assembleRelease
# → app\build\outputs\apk\release\app-release.apk
```

### 6.3 C코스 — AAB를 APK로 변환해 로컬 검증 (bundletool)

Play Console에 올리기 **전에** AAB가 실제로 설치·실행되는지 확인한다.
AAB는 그 자체로 설치할 수 없으므로 `bundletool` 로 기기용 APK 세트를 만든다.

```powershell
# 0) bundletool 다운로드 (1회) — https://github.com/google/bundletool/releases 의 bundletool-all-*.jar
$tools = "$env:USERPROFILE\tools"
New-Item -ItemType Directory -Force $tools | Out-Null
# 브라우저로 받아 $tools\bundletool.jar 로 저장하거나:
# Invoke-WebRequest -Uri "<릴리스 페이지에서 확인한 jar URL>" -OutFile "$tools\bundletool.jar"
$bt = "$tools\bundletool.jar"

cd "C:\Users\741u7\OneDrive\바탕 화면\PJT20260810\FE\android"
$aab    = "app\build\outputs\bundle\release\app-release.aab"
$keyDir = "$env:USERPROFILE\.android-keys\bloodsworn"

# 1) 연결된 기기에 딱 맞는 APK만 생성 (--connected-device)
java -jar $bt build-apks `
  --bundle="$aab" `
  --output="build\bloodsworn.apks" `
  --overwrite `
  --connected-device `
  --local-testing `
  --ks="$keyDir\bloodsworn-upload.jks" `
  --ks-key-alias=bloodsworn-upload
# → 키스토어/키 비밀번호를 물어본다. 비대화식으로 하려면 --ks-pass=pass:XXX --key-pass=pass:XXX

# 2) 기기에 설치
java -jar $bt install-apks --apks="build\bloodsworn.apks"

# 3) 실행
adb shell am start -n com.bloodsworn.game/com.bloodsworn.game.MainActivity

# 4) (참고) 다운로드 크기 추정 — 스토어에 표시될 대략적 용량
java -jar $bt get-size total --apks="build\bloodsworn.apks"
```
> `--local-testing` 플래그로 만든 APK 세트는 **반드시 `install-apks` 로 설치**해야 한다 (`adb install-multiple` 로 하면 로컬 테스트 메타데이터가 제대로 안 먹는다).
> 전 기기용 유니버설 APK가 필요하면 `--connected-device` 대신 `--mode=universal` 을 쓴다.

**이 검증에서 잡히는 대표 사고**
- 릴리스에서만 나는 흰 화면 (minify / base 경로)
- 릴리스 서명 누락
- `cap sync` 누락으로 옛날 `dist` 가 들어간 AAB

### 6.4 ★ D코스 — iOS 릴리스 빌드 (클라우드 macOS CI)

#### 6.4.0 🔴 선행 블로커 — git 원격 저장소

> **클라우드 macOS CI는 예외 없이 원격 저장소를 트리거로 잡는다.**
> **그런데 이 프로젝트는 현재 git 저장소조차 아니다.** iOS 경로 전체가 여기서 막힌다.
> 이것이 이번 배포 계획에서 **가장 앞에 있는 블로커**이며, Android에는 존재하지 않던 요구사항이다.

```bash
cd "/c/Users/741u7/OneDrive/바탕 화면/PJT20260810"
git init
# ⚠ 첫 커밋 전에 §5.2 ②의 .gitignore 가 반드시 자리잡고 있어야 한다.
#    키스토어·서명 자산이 첫 커밋에 섞이면 그 키들은 폐기하고 다시 만들어야 한다.
git status                 # 서명 파일이 하나도 안 보이는지 눈으로 확인
git add -A
git commit -m "chore: initial commit"
git branch -M main
git remote add origin https://github.com/<USER>/bloodsworn.git
git push -u origin main
```

> **저장소는 private으로 만든다.** 그래도 §5.5.7의 커밋 금지 규칙은 그대로 유효하다.
> ⚠ **OneDrive 동기화 폴더 안에서 git을 쓰는 문제**가 이제 "권장 개선"이 아니라 **필수**가 되었다.
> OneDrive가 `.git/` 내부 파일을 동기화 중에 잠그면 커밋·푸시가 실패하고, **iOS 배포 경로 전체가 멈춘다.**
> Android는 이 문제가 없어도 빌드가 됐지만 iOS는 안 된다. 대응은 `07-PROJECT-STRUCTURE-AND-CONVENTIONS.md` §6 참조.

#### 6.4.1 CI 제공자 선택 — Codemagic 권장

| 제공자 | 무료 | 유료 | 판정 |
|---|---|---|---|
| GitHub Actions | 개인 Free 플랜 private 저장소 **2,000분/월**이지만 **macOS는 10배 배수** → 실질 **약 200 macOS 분/월** | 2026-01-01 재가격 이후 표준 2코어 macOS **$0.062/분** | 분량이 빠듯 |
| **Codemagic** | **500 macOS M2 분/월** (Mac mini M2, 동시 빌드 1) | M2 **$0.095/분** / M4 $0.114/분 | ★ **선택** |
| Xcode Cloud | — | — | **탈락.** Xcode에서 설정하는 구조라 **Mac이 없으면 구성 자체가 불가능**하다 |

**왜 무료 분(minute) 수가 판정 기준인가**

iOS 첫 그린 빌드까지는 서명·프로파일·Podfile에서 시행착오가 반복되고, 1회 빌드가 10분 안팎이다.
**200분은 약 20회, 500분은 약 50회다.**
Mac이 없어 로컬 재현이 불가능하고 **CI 로그가 유일한 진단 수단**인 이 프로젝트에서,
**시행착오 횟수가 곧 성공 확률**이다. 20회와 50회는 성격이 다르다.

> ⚠ GitHub Actions 수치는 3자 출처다. 실제 채택 전 GitHub 공식 청구 문서로 재확인할 것.
> 어느 쪽을 쓰든 **§6.4.0의 원격 저장소는 공통 전제**다.

#### 6.4.2 CI가 반드시 수행해야 하는 단계 (골격)

이 표가 워크플로 파일보다 중요하다. **문법은 제공자마다 다르지만 단계는 같다.**

| # | 단계 | 왜 필요한가 | 빠뜨리면 |
|---|---|---|---|
| 1 | 저장소 체크아웃 | — | — |
| 2 | Node 20+ 설치 / `npm ci` | Capacitor 7 요구사항 | 의존성 해석 실패 |
| 3 | `npm run build` | CI가 `dist/` 를 **직접 다시 만든다.** `dist/` 는 커밋하지 않는다 | §12-A 흰 화면 |
| 4 | `npx cap sync ios` | `dist/` → `ios/App/App/public/` 복사 + 설정 반영 | 옛 웹 자산이 들어간 IPA |
| 5 | **`pod install`** | `Pods/` 는 커밋하지 않는다(§5.2 ②). Capacitor 7 iOS는 CocoaPods 필수 | `xcodebuild` 가 워크스페이스를 못 연다 |
| 6 | 서명 자산 주입 (`.p12`·프로파일을 base64에서 복원해 키체인/프로파일 디렉토리에 설치) | §5.5.6 | 서명 실패 (§10-A) |
| 7 | 빌드 번호 결정 | §6.4.4 | 업로드 거부 (§11.2) |
| 8 | `xcodebuild archive` | `.xcarchive` 생성 | — |
| 9 | `xcodebuild -exportArchive` (+ `ExportOptions.plist`) | `.ipa` 생성 | — |
| 10 | **fastlane `pilot` / `upload_to_testflight`** 로 업로드 (ASC API 키 인증) | CI 표준 경로 | — |
| 11 | `.ipa` 를 아티팩트로 보관 | 디바이스 팜 검증용(§13.1) | 재빌드로 분(minute) 낭비 |

> **왜 `xcrun altool` 을 1순위로 쓰지 않는가:** altool은 아직 존재하지만 `--upload-app` 대신 `--upload-package` 로
> 옮겨가는 중이고, 최신 Xcode에서 계정이 여러 provider에 걸쳐 있을 때 오작동 보고가 있다.
> **fastlane `pilot` 이 CI 표준 경로**이며 문서는 이쪽을 기본으로 삼는다.
> ⚠ **fastlane / altool의 정확한 최신 명령·옵션 조합은 확인 필요(2026-08-10 기준 미확인).**
> 이 문서는 **단계 골격만** 확정하고, 플래그는 실제 구축 시점에 각 도구의 공식 문서로 확정한다. **여기서 플래그를 지어내면 CI 왕복 1회를 그냥 버린다.**

#### 6.4.3 워크플로 파일 골격 (`codemagic.yaml`, 저장소 루트)

```yaml
# ⚠ 이것은 "단계 골격"이다. 키 이름·인덴트 규약은 채택 시점에
#    Codemagic 공식 문서로 확정할 것. 아래 ⚠ 표시 지점이 확정 대상이다.
workflows:
  ios-testflight:
    name: BLOODSWORN iOS -> TestFlight
    instance_type: mac_mini_m2
    max_build_duration: 30           # 분. 무한 대기로 무료분을 태우지 않기 위한 상한
    environment:
      node: 20                       # F: Capacitor 7 요구사항
      xcode: latest                  # ⚠ Capacitor 7은 Xcode 16.0 이상 요구. 'latest'가
                                     #   16 미만으로 떨어지지 않는지 첫 빌드 로그에서 확인
      vars:
        BUNDLE_ID: "com.bloodsworn.game"
        XCODE_WORKSPACE: "FE/ios/App/App.xcworkspace"
        XCODE_SCHEME: "App"
      groups:
        - apple_signing              # §5.5.6의 시크릿 4종을 담은 그룹
    triggering:
      events:
        - tag                        # 태그 push에만 돈다. 커밋마다 돌면 무료분이 녹는다
    scripts:
      - name: 웹 빌드
        script: |
          cd FE
          npm ci
          npm run build
          npx cap sync ios

      - name: CocoaPods
        script: |
          cd FE/ios/App
          pod install

      - name: 서명 자산 설치
        script: |
          # ⚠ .p12 / .mobileprovision 을 base64에서 복원해 설치하는 단계.
          #    Codemagic은 이 작업을 대신해 주는 내장 기능을 제공한다 →
          #    스크립트를 손으로 쓰기 전에 공식 문서의 코드사이닝 설정을 먼저 볼 것.

      - name: 빌드 번호 결정
        script: |
          # §6.4.4 참조

      - name: archive + export
        script: |
          # ⚠ 정확한 플래그 조합은 확정 대상. 뼈대는 아래 두 줄이다.
          # xcodebuild archive       -workspace "$XCODE_WORKSPACE" -scheme "$XCODE_SCHEME" ...
          # xcodebuild -exportArchive -exportOptionsPlist ExportOptions.plist ...

    artifacts:
      - FE/ios/App/build/**/*.ipa    # ⚠ 실제 출력 경로는 첫 빌드 로그에서 확정
      - /tmp/xcodebuild_logs/*.log   # ★ 로그는 반드시 아티팩트로 남긴다 (아래 참조)

    publishing:
      app_store_connect:
        # ⚠ ASC API 키 3요소로 인증. 키 이름은 공식 문서로 확정.
        submit_to_testflight: true
        # ★ App Store 정식 제출은 이번 주 대상이 아니다. 내부 TestFlight까지만. (§7.5)
```

> **★ 로그를 아티팩트로 남기는 것이 이 워크플로에서 가장 중요한 한 줄이다.**
> Mac이 없으므로 **CI 로그가 유일한 진단 수단**이다(§1.1). 빌드가 실패했는데 로그가 잘려 있으면
> 다음 시도는 추측으로 하게 되고, 추측 1회당 무료분 10분이 사라진다.

**`ExportOptions.plist` (저장소에 커밋한다 — 비밀이 아니다)**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>          <!-- ⚠ Xcode 버전에 따라 app-store / app-store-connect
                                              중 어느 이름을 받는지 확인 필요(2026-08-10 기준 미확인).
                                              틀리면 exportArchive가 바로 실패하며 로그에 유효값을 알려준다 -->
    <key>signingStyle</key>
    <string>manual</string>
    <key>teamID</key>
    <string>여기에_Team_ID</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>com.bloodsworn.game</key>
        <string>여기에_프로비저닝_프로파일_이름</string>
    </dict>
</dict>
</plist>
```

> 🔴 **`project.pbxproj` 의 `CODE_SIGN_STYLE` 이 현재 `Automatic` 이다** (Debug/Release 양쪽).
> Automatic 서명은 **Xcode가 Apple 계정에 로그인해 프로파일을 자동 관리하는 방식**이라 비대화식 CI와 맞지 않는다.
> §5.5에서 프로파일을 **손으로 만들었으므로 Manual이 맞다.** `ExportOptions.plist` 의 `signingStyle: manual` 과
> 프로젝트 설정이 어긋나면 서명 단계에서 실패한다(§10-A).
> ⚠ **`pbxproj` 를 직접 고칠지, `xcodebuild` 명령줄에서 `CODE_SIGN_STYLE=Manual` 로 덮을지는 첫 관통 리허설에서 결정한다.**
> **명령줄 덮어쓰기를 먼저 시도한다** — 파일을 안 건드리는 쪽이 되돌리기 쉽고, 실패해도 원인 후보가 하나 줄어든다.

#### 6.4.4 빌드 번호 자동 증가

`CFBundleVersion`(= `CURRENT_PROJECT_VERSION`)은 **App Store Connect에 이미 올라간 값과 같으면 업로드가 거부된다.**
Android `versionCode` 와 완전히 같은 성질이며(§11.1), Day 7 오후에 이 에러를 만나면 시간을 잃는 것도 똑같다.

**권장: 파일을 고치지 않고 `xcodebuild` 빌드 설정으로 덮어쓴다.**

```bash
# CI가 제공하는 빌드 카운터를 그대로 쓴다 (Codemagic: $BUILD_NUMBER 등 — ⚠ 변수명은 제공자 문서 확인)
# xcodebuild archive ... CURRENT_PROJECT_VERSION=$BUILD_NUMBER
```

| 방식 | 장점 | 단점 |
|---|---|---|
| **① `xcodebuild` 인자로 덮어쓰기** ← 권장 | 저장소를 안 건드린다. **CI가 저장소에 되커밋하는 루프가 없다** | ⚠ 정확한 인자 위치는 확인 필요 |
| ② `agvtool` / `PlistBuddy` 로 파일 수정 | Xcode 표준 도구 | 파일이 바뀌므로 되커밋하거나 매번 dirty. **되커밋 훅이 다시 빌드를 트리거하는 무한 루프** 사고가 유명하다 |
| ③ 손으로 올리기 | 확실함 | Day 7에 반드시 잊는다 |

> **`CFBundleShortVersionString`(= `MARKETING_VERSION`)은 자동 증가시키지 않는다.** 사람이 읽는 버전이고,
> Android `versionName` 과 **손으로 맞춰야** 두 스토어의 같은 릴리스가 같은 이름을 갖는다. (§11.2)

#### 6.4.5 첫 관통 리허설을 어떻게 판정하는가 (Day 1~2)

> **게임이 완성되지 않아도 된다.** 오히려 완성되지 않은 상태로 하는 것이 목적이다(§0.1).
> 판정 기준은 "게임이 재밌는가"가 아니라 **"파이프라인이 끝까지 뚫렸는가"** 다.

| # | 통과 조건 | 실패 시 보는 곳 |
|---|---|---|
| 1 | `git push` 로 CI가 트리거된다 | §6.4.0 |
| 2 | `pod install` 이 성공한다 | §10-B |
| 3 | `xcodebuild archive` 가 **서명까지** 성공한다 | §10-A |
| 4 | `.ipa` 아티팩트가 생성된다 | §10-B |
| 5 | App Store Connect가 업로드를 **수락**한다 | §10-C |
| 6 | 빌드 처리가 끝나 TestFlight에 **"테스트 가능"** 으로 뜬다 | §10-D |
| 7 | 내부 테스터(본인) 기기에 **설치되어 실행된다** | §10-E |

**7까지 갔으면 Day 7의 iOS 작업은 "태그 푸시 → CI → TestFlight 확인"으로 축소된다.**
5에서 멈춰도 큰 수확이다 — 서명이라는 최대 난관을 Day 2에 넘긴 것이기 때문이다.

---

## 7. 스토어 등록 절차 (Play Console · App Store Connect)

> §7.0~§7.4는 **Google Play**, §7.5는 **Apple App Store Connect** 다.
> 두 스토어의 Day 7 목표는 다르다: Play는 **내부 테스트 트랙 업로드**, Apple은 **TestFlight 내부 테스트 배포**.
> **양쪽 다 "심사에 막히지 않는 경로"만 골랐다는 점이 핵심**이며, 이유는 각각 §7.2와 §7.5.1에 있다.

### 7.0 확인 출처 (전부 2026-08-10 WebSearch/WebFetch로 직접 확인)

| 확인 항목 | 출처 |
|---|---|
| 신규 개인 계정 테스트 요건 | [App testing requirements for new personal developer accounts — Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en) |
| 타겟 API 레벨 요건 | [Target API level requirements for Google Play apps — Play Console Help](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en) |
| 스토어 자산 규격 | [Add preview assets to showcase your app — Play Console Help](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en) |
| 텍스트 길이 제한 | [Best practices for your store listing — Play Console Help](https://support.google.com/googleplay/android-developer/answer/13393723?hl=en) |
| 데이터 보안 양식 | [Provide information for Google Play's Data safety section — Play Console Help](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en) |
| AAB 의무화 | [Android App Bundle FAQ — Android Developers](https://developer.android.com/guide/app-bundle/faq) |
| bundletool 사용법 | [bundletool — Android Developers](https://developer.android.com/tools/bundletool) |

> **Apple 쪽 요건의 출처는 위 표에 넣지 않았다.** 2026-08-10에 별도 리서치로 확인했으나 **링크를 이 문서에서
> 재검증하지 않았기 때문**이다. 확인 강도가 다른 것을 같은 표에 섞으면 나중에 어느 쪽을 믿어야 할지 알 수 없게 된다.
> §7.5의 iOS 항목은 **본문에 신뢰도를 개별 표기**했고, 확인하지 못한 것은 전부 `⚠ 확인 필요(2026-08-10 기준 미확인)` 로 남겼다.

### 7.1 확인된 필수 요건 (2026-08-10 기준)

| # | 항목 | 확인 내용 |
|---|---|---|
| R1 | **패키지 포맷** | **AAB 필수.** 신규 앱은 2021-08부터, 기존 앱 업데이트는 2021-11부터 APK 업로드 불가. → 우리는 무조건 AAB. |
| R2 | **타겟 API 레벨** | **2026-08-31부터 신규 앱 및 앱 업데이트는 Android 16(API 36) 이상 타겟 필수.** 그 이전은 API 35(Android 15)가 하한. **2026-11-01까지 연장 신청 가능**(연장 신청 폼은 Play Console에 제공 예정이라고만 안내됨). |
| R3 | **개발자 등록비** | **$25 1회성.** 계정당 1회, 이후 앱 수 무제한. 환불 없음. |
| R4 | **신규 개인 계정 테스트 요건** | **2023-11-13 이후 생성된 개인 개발자 계정**은 프로덕션 접근 신청 전에 **폐쇄형 테스트(Closed testing)를 최소 12명의 테스터가 최근 14일 연속 옵트인한 상태**로 운영해야 한다. **조직(Organization) 계정과 그 이전 개인 계정은 면제.** 요건 충족 후 프로덕션 접근을 신청하면 **보통 7일 이내** 심사. |
| R5 | **내부 테스트** | 내부 테스트(Internal testing)는 **선택**이며 위 12/14 요건의 대상이 아니다. 폐쇄형 테스트가 필수. |
| R6 | **개인정보 처리방침** | 모든 앱에 필요. 데이터 미수집 앱도 **데이터 보안 양식 제출 + 처리방침 URL 제공**이 필요하며, 양식과 처리방침 내용이 **서로 일치**해야 한다(불일치가 반려 최다 원인). |
| R7 | **콘텐츠 등급** | IARC 설문 제출 필요. 미제출 시 스토어 등록정보를 완성할 수 없음. |

### 7.2 🔴 Play 프로덕션 — 7일 일정에 대한 치명적 리스크

```
Day 7 (2026-08-16) 에 Google Play에서 도달 가능한 최대치

  ✅ 앱 생성 · 스토어 등록정보 작성 · 콘텐츠 등급 · 데이터 보안 양식
  ✅ 내부 테스트 트랙에 AAB 업로드 → 테스터 링크로 즉시 설치 가능
  ❌ 프로덕션(일반 공개) 출시  ← 구조적으로 불가능

  이유: 신규 개인 계정 = 폐쇄형 테스트 12명 × 14일 연속 → 프로덕션 접근 신청 → 심사 7일
        최단 경로로도  14 + 7 = 21일  이상 필요.
```

> **Apple 쪽도 Day 7에 정식 출시는 안 된다.** 다만 **막히는 지점이 다르다.**
>
> | | Google Play | Apple App Store |
> |---|---|---|
> | Day 7 도달점 | 내부 테스트 트랙 | **TestFlight 내부 테스트** |
> | 그 지점의 관문 | 트랙 업로드 검토(수 분~수 시간) | **심사 없음.** 빌드 처리 성공 + 수출 규정 응답뿐 (§7.5.1) |
> | 정식 출시를 막는 것 | **계정 요건**(12명 × 14일) — 시간으로만 풀린다 | **심사** — 제출해야 시작된다 |
> | 이번 주에 하는 일 | 계정 요건 카운트를 **최대한 빨리 시작**시킨다 | 파이프라인을 **먼저 뚫어 둔다**(§0.1) |
>
> 즉 Play는 "기다려야 하는 문제", Apple은 "뚫어야 하는 문제"다. **대응 방식이 반대이므로 같은 칸에 넣어 관리하지 않는다.**

**따라서 일정은 이렇게 재정의한다:**

| 마일스톤 | 날짜 | 내용 |
|---|---|---|
| M1 | **Day 1 (08-10)** | Play Console 계정 생성 + $25 결제 + 신원 확인 제출. **계정 승인 자체가 수일 걸릴 수 있는 최대 병목.** |
| M2 | **Day 7 (08-16)** | Play 내부 테스트 트랙 업로드 완료 **+ TestFlight 내부 테스트 배포 완료** → **"출시했다"의 실질적 달성점** |
| M3 | Day 7+1 (08-17) | 폐쇄형 테스트 트랙 생성 + 테스터 12명 모집 시작 (지인/커뮤니티) |
| M4 | Day 7+15 (08-31) | 12명 × 14일 연속 충족 → 프로덕션 접근 신청 |
| M5 | Day 7+22 전후 (09-07) | 심사 통과 시 프로덕션 출시 |

> ⚠ **M4(08-31)가 R2의 targetSdk 36 마감일과 정확히 겹친다.**
> → **지금(Day 1)부터 `targetSdkVersion = 36` 으로 빌드해두면 이 함정을 통째로 회피한다.** §7.3

**리스크 완화책**
1. **테스터 12명은 Day 1부터 모집을 시작한다.** 코드가 없어도 "8월 17일에 링크 드릴게요" 로 미리 확보.
   테스터는 **Google 계정 이메일**이 필요하고, **옵트인 링크를 눌러 실제로 설치·유지**해야 카운트된다.
   중간에 옵트아웃하면 14일이 리셋된다.
2. Play Console 계정 신원 확인이 Day 3까지 안 끝나면 → **iOS/TestFlight 단독 출시로 전환**하고 Play는 후속 과제로 분리한다.
   Apple Developer Program은 **이미 가입이 완료**되어 있어 계정 승인 대기 리스크가 없으므로, 이 폴백은 실제로 성립한다.
   ⚠ 단 이 폴백은 **TestFlight 내부 테스터(App Store Connect 사용자)에게만** 닿는 경로다. 불특정 다수에게 공개되지 않는다.
   **"심사도 계정도 없이 즉시 공개할 수 있는 경로"는 이번 배포 계획에 존재하지 않는다** — 이 점은 숨기지 말고 `16-RISKS-AND-SCOPE-CUTS.md` 에서 정면으로 다룬다.
3. 조직(Organization) 계정으로 등록하면 12/14 요건이 면제되지만, **사업자 등록·D-U-N-S 번호 등 추가 확인이 필요**하며
   7일 안에 끝난다는 보장이 없다 → ⚠ 조직 계정 등록에 걸리는 실제 소요일은 **확인 필요(2026-08-10 기준 미확인)**. 권장하지 않는다.

### 7.3 targetSdk 36 대응 (권장 선반영)

`FE/android/variables.gradle` 수정:
```gradle
ext {
    minSdkVersion = 23
    compileSdkVersion = 36     // 35 → 36
    targetSdkVersion = 36      // 35 → 36
    // ... 이하 동일
}
```
> ⚠ **AGP 8.10.1 / Gradle 8.11.1 조합이 `compileSdk 36` 을 경고 없이 지원하는지는 확인 필요(2026-08-10 기준 미확인).**
> 빌드 시 `compileSdk 36 requires Android Gradle Plugin X.Y.Z or higher` 경고/에러가 뜨면 AGP를 상향한다.
> **Day 1에 이 빌드를 한 번 통과시켜 두는 것이 Day 7 사고를 막는다.**
> API 36 타겟에서는 **엣지 투 엣지 강제 적용** 등 동작 변경이 있을 수 있으므로,
> §3.2의 세이프 인셋(`env(safe-area-inset-*)`) 처리를 실기기에서 반드시 눈으로 확인할 것.

### 7.4 등록 절차 (순서대로)

```
[1] 계정 생성        → Play Console 가입, $25 결제, 신원 확인 서류 제출
        ↓ (승인 대기: 수 시간 ~ 수일)
[2] 앱 만들기        → 앱 이름 / 기본 언어 / 앱 or 게임 / 무료 or 유료 / 선언 동의
        ↓
[3] 대시보드 과제 처리 (순서 무관, 전부 완료해야 출시 가능)
     ├ 앱 액세스 권한       : "모든 기능을 제한 없이 사용 가능" 선택 (로그인 없음)
     ├ 광고                : "광고 포함 안 함" 선택
     ├ 콘텐츠 등급 (IARC)   : 설문 제출 → 등급 즉시 발급
     ├ 타겟층 및 콘텐츠     : 연령대 선택 (13세 이상 권장 — 유혈 표현)
     ├ 뉴스 앱             : 아니오
     ├ 데이터 보안          : 수집·공유 없음으로 제출 (§9.3)
     ├ 정부 앱             : 아니오
     ├ 금융 기능           : 없음
     └ 스토어 등록정보      : 이름/설명/그래픽 (§8)
        ↓
[4] 내부 테스트 트랙  → 테스터 이메일 목록 생성 → AAB 업로드 → 출시 검토 → 롤아웃
        ↓ (검토: 보통 수 분 ~ 수 시간)
[5] 옵트인 링크 배포  → 테스터가 링크 클릭 → Play 스토어에서 설치
        ↓
[6] 폐쇄형 테스트 트랙 → 12명 × 14일 연속 (§7.2)
        ↓
[7] 프로덕션 접근 신청 → 심사 (보통 7일 이내) → 프로덕션 출시
```

**각 단계에서 요구하는 자료**

| 단계 | 필요 자료 |
|---|---|
| [1] 계정 | 신용카드($25), 신분증(신원 확인), 주소·전화번호, 공개 개발자 이름 |
| [2] 앱 만들기 | 앱 이름(30자 이내), 기본 언어(한국어), 카테고리 |
| [3] 콘텐츠 등급 | 이메일 주소, 카테고리(게임), 폭력/유혈/공포 문항 응답 |
| [3] 데이터 보안 | 수집·공유 항목 선언, **개인정보 처리방침 URL** |
| [3] 스토어 등록정보 | 앱 이름 / 짧은 설명(80자) / 자세한 설명(4000자) / 앱 아이콘(512×512) / 피처 그래픽(1024×500) / 스크린샷 ≥2장 / 카테고리 / 연락처 이메일 |
| [4] 내부 테스트 | 서명된 AAB, 출시명, 출시 노트, 테스터 이메일 목록(Google 계정) |
| [7] 프로덕션 신청 | 폐쇄형 테스트 진행 내역, 테스터 피드백 요약, 프로덕션 준비 상태 서술 |

> **연락처 이메일은 스토어에 공개된다.** 개인 메일을 쓰기 싫으면 프로젝트용 Gmail을 따로 만든다.
> **콘텐츠 등급 설문은 정직하게 답한다.** BLOODSWORN은 유혈·언데드·공포 요소가 있다.
> 과소 신고는 나중에 앱 정지 사유가 되며, 정직하게 답해도 등급이 하나 올라갈 뿐 출시에 문제 없다.
>
> **예상 등급 — Google Play IARC: ESRB Teen / PEGI 12 / GRAC 12+ 또는 15+.**
> Apple 쪽 예상 등급과 서술자 응답은 §7.5.4에 있다. **양 스토어에 같은 내용으로 답한다** — 한쪽만 낮게 신고할 이유가 없고,
> 두 스토어의 신고 내용이 다르면 그 자체가 나중에 문제가 된다.

---

### 7.5 App Store Connect 절차 (iOS)

#### 7.5.1 심사 게이트 — 어떤 규칙이 어디를 막는가

**이 표가 iOS 일정 전체의 근거다.**

| 게이트 | 심사 | 적용 규칙 |
|---|---|---|
| **TestFlight 내부** (App Store Connect 사용자 100명) | **심사 없음.** 빌드 처리 후 수 분 내 배포 | 없음. 유일한 관문은 **빌드 처리 성공 + 수출 규정 응답** |
| TestFlight 외부 (10,000명) | 버전당 첫 빌드에 **Beta App Review** | 전체 가이드라인 |
| App Store 제출 | 전체 심사 | 전체 가이드라인 |

> **결론: Day 7 목표(내부 TestFlight)는 심사에 막히지 않는다.**
> 그래서 iOS를 7일 안에 넣을 수 있는 것이고, **외부 TestFlight와 App Store 제출은 이번 주 대상이 아니다.**
>
> ⚠ **Apple 문서 간 충돌이 있다.** TestFlight 개요 페이지는 "그룹에 첫 빌드를 추가하면 App Review로 보내진다"고
> 내부/외부 구분 없이 서술한다. 반면 내부 테스터 페이지에는 심사 언급이 없고, 실무 통념은 "내부는 심사 없음"이다.
> → **하루 여유를 남긴다.** Day 7 당일에 처음 업로드하지 않는다(§0.1이 이 리스크도 함께 없앤다).

#### 7.5.2 내부 TestFlight 배포에 실제로 필요한 것 — 필수 5가지

| # | 항목 | 언제 | 비고 |
|---|---|---|---|
| 1 | Apple Developer Program 활성 + **Account Holder가 최신 계약에 서명**되어 있을 것 | Day 1 | 가입은 완료됨. **계약 서명 여부는 별개**이니 콘솔에서 확인할 것 |
| 2 | App Store Connect **앱 레코드** | Day 1 | Platforms / App Name / Primary Language / **Bundle ID** / SKU / User Access (§7.5.5) |
| 3 | 처리 완료된 **서명 빌드** | Day 1~2 관통 리허설 | §5.5 + §6.4 |
| 4 | **수출 규정 응답** | Day 1 | `Info.plist` 에 키를 넣어 매번 묻지 않게 한다 (아래) |
| 5 | 내부 테스터 그룹 (App Store Connect 사용자 1명 이상) | Day 1 | §7.5.6 |

**4번 — `Info.plist` 에 수출 규정 응답을 박아 넣는다 (`FE/ios/App/App/Info.plist`)**

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```
- 이 키가 없으면 업로드마다 App Store Connect에서 수출 규정을 묻고, **미응답 상태에서는 "Missing Compliance"로 배포가 막힌다.**
- **BLOODSWORN은 오프라인 게임이므로 답이 명확하다** — 서버 없음, 계정 없음, 통신 없음(§9). 고민할 여지가 없다.
- **Day 7에 이걸로 막히면 순수한 낭비다.** 한 줄이므로 §3.5의 `Info.plist` 수정과 **같이 처리한다.**

#### 7.5.3 내부 TestFlight에 **불필요**한 것 (App Store 정식 제출에만 필요)

> 이 목록의 가치는 "안 해도 되는 일을 Day 7에 하지 않게 하는 것"이다.

스크린샷 · 앱 설명 · 키워드 · 부제 · 지원/마케팅 URL · 저작권 ·
**개인정보 처리방침 URL**(외부 TestFlight는 필요) · **App Privacy 질문지** ·
가격 및 판매 지역 · 카테고리 · 심사 연락처 · Beta App Description(외부 TestFlight만)

> ★ **내부 TestFlight에는 App Store 스크린샷이 필요 없다.** 따라서 **iOS 스크린샷은 Day 7 목표에 걸리지 않는다.**
> Day 7 경로에 남는 이미지 작업은 **앱 아이콘 1024 무알파 처리 하나뿐**이다(§8.5).
> ⚠ App Store 제출용 스크린샷의 **필수 최소 장수**와 **iPhone 전용 앱에서 iPad 스크린샷이 필요한지는 확인 필요(2026-08-10 기준 미확인)**.
> Day 7 이후 과제이므로 지금 확정하지 않는다.

#### 7.5.4 연령 등급 — ⚠ 이번 리서치에서 나온 가장 큰 일정 리스크

**등급 체계가 2025년에 개편되었다: 4+ / 9+ / 13+ / 16+ / 18+.** 기존 **12+ 와 17+ 는 폐지**되었고,
**2026-01-31까지 신규 문항에 대한 응답이 의무화**되었다.

| 항목 | 값 | 근거 |
|---|---|---|
| BLOODSWORN 예상 등급 | **13+** | Apple 기준상 9+는 "가끔의 만화적/판타지 폭력", 13+는 "**빈번한** 만화적/판타지 폭력". 서바이버즈 장르는 정의상 빈번하다 |
| `Cartoon or Fantasy Violence` | **Frequent** | 위와 같음 |
| `Realistic Violence` | None | 픽셀아트 판타지 |
| `Horror-Fear Themes` | Infrequent 또는 Frequent | 언데드·흡혈귀 소재 |
| `Loot Boxes` | **None** | 단 **유료·재화 기반 랜덤 상자를 넣으면 뒤집힌다.** 이번 주 스코프에 없다 |
| 광고 · UGC · 웹 접근 | 전부 None | §9와 일치 |

> 🔴 **왜 이게 일정 리스크인가:** 연령 등급은 원래 **제출용** 항목이라 §7.5.3의 "불필요" 목록에 들어갔어야 한다.
> 그런데 **2026-01-31 이후 미응답 시 "제출 시 중단"이 발생**하며, **그 중단이 TestFlight 업로드에도 걸리는지는 확인되지 않았다.**
> → ⚠ **확인 필요(2026-08-10 기준 미확인).** 확인하는 데 드는 비용보다 **그냥 채우는 비용이 더 싸다.**
> → **Day 1에 10분 들여 그냥 채운다.** 답은 위 표에 이미 다 있다.

> **축소 신고 금지.** 양 스토어 모두 삭제·정지 사유다. **13+는 상업적으로 손해가 없다.**
> 그리고 등급은 **올릴 수는 있어도 내릴 수 없다.**

#### 7.5.5 앱 레코드 생성 (Day 1)

```
App Store Connect → 나의 앱 → [+] → 신규 앱

  Platforms       : iOS
  App Name        : BLOODSWORN: 피의 서약        ← Play와 통일 (§8.3)
  Primary Language: 한국어
  Bundle ID       : com.bloodsworn.game          ← ★ §5.5.4에서 등록한 App ID가 목록에 떠야 한다
  SKU             : bloodsworn-001               ← 내부 식별자. 공개되지 않는다. 아무 값이나 가능하되 변경 불가
  User Access     : Full Access
```

> 🔴 **Bundle ID 드롭다운에 `com.bloodsworn.game` 이 없다면 §5.5.4의 App ID 등록을 안 한 것이다.**
> 여기서 스캐폴드 기본값이나 임시 ID를 골라 진행하면 §2.0의 되돌릴 수 없는 사고가 된다. **반드시 되돌아가서 등록하고 온다.**
>
> **앱 레코드는 빌드 업로드보다 먼저 존재해야 한다.** 순서가 바뀌면 업로드가 갈 곳이 없다.

#### 7.5.6 업로드 → 빌드 처리 → 내부 테스터

```
[1] 태그 push → CI가 .ipa 생성 → fastlane pilot 업로드   (§6.4)
        ↓
[2] App Store Connect가 빌드를 접수 → "처리 중(Processing)"
        ↓  ⚠ 소요 시간은 확인 필요(2026-08-10 기준 미확인). 즉시일 때도, 오래 걸릴 때도 있다
[3] 처리 완료 → TestFlight 탭에 빌드가 나타남
        ↓
[4] 수출 규정 응답 확인 (§7.5.2의 4번을 넣었다면 이 단계가 자동 통과)
        ↓
[5] 내부 테스터 그룹에 빌드 할당 → 테스터에게 알림
        ↓
[6] 테스터가 TestFlight 앱에서 설치
```

**내부 테스터의 조건과 한도**

| 항목 | 값 |
|---|---|
| 인원 | **100명** |
| 테스터당 기기 | **30대** |
| 빌드 만료 | **90일** |
| UDID 등록 | **불필요** (외부와 달리 기기를 미리 등록하지 않는다) |
| **자격 요건** | ★ **App Store Connect 사용자여야 한다** (Account Holder / Admin / App Manager / Developer / Marketing) |
| 실행 가능 기기 | iPhone, **iPad**, **Apple Silicon Mac** (Mac 허용은 그룹별 토글이며 **기본 꺼짐**) |
| 테스터 보상 | **금지** (가이드라인 2.2) |

> 🔴 **"아무 지인이나 초대"가 안 된다는 것이 Android 내부 테스트와의 결정적 차이다.**
> Play 내부 테스트는 Google 계정 이메일만 있으면 되지만, **TestFlight 내부 테스터는 App Store Connect에 사용자로 추가**해야 한다.
> 즉 **초대할 사람마다 팀 구성원으로 등록**하는 절차가 앞에 붙는다. Day 7 오후에 처음 알면 시간을 잃는다.
> **최소 조건은 본인 1명**이므로 Day 7 성공 판정에는 지장이 없다(§13.4).
>
> ⚠ **`.ipa` 를 시뮬레이터로 실행할 수 없다.** 아키텍처가 아니라 **플랫폼**이 다르기 때문이다
> (`arm64-apple-ios` vs `arm64-apple-ios-simulator`). Mac이 있어도 이 `.ipa` 는 시뮬레이터에서 안 돈다.
> **이 프로젝트는 시뮬레이터를 포기한다.** 대체 검증 경로는 §13.1에 있다.

#### 7.5.7 가이드라인 4.2(최소 기능) — WebView 래핑에 대한 방어

WebView로 감쌌다는 사실 자체는 거절 사유가 **아니다.** 문제가 되는 것은 "웹사이트를 앱인 척 포장한 것"이다.

| 방어 | 이 프로젝트의 상태 | 근거 |
|---|---|---|
| **완전 오프라인** | ★ 가장 강력한 방어. 서버·계정·통신 없음 | §9 |
| `server.url` 이 릴리스에 **없을 것** | 원격 URL 로드가 정확히 4.2.2 "web clipping" 패턴 | §3.4 |
| 러버밴드 스크롤 / 텍스트 선택 핸들 / 롱프레스 콜아웃 제거 | **§3.3의 CSS 리셋이 이미 상당 부분 처리하고 있다** | §3.3 |
| 데모 계정 제공 (가이드라인 2.1) | 불필요 — 계정 자체가 없다 | §9 |
| **"기기에서 테스트했는가"** | 실질적으로 이게 관문이다 | §13.1의 iOS 검증 경로 |

> **이 절은 Day 7 목표(내부 TestFlight)에는 적용되지 않는다**(§7.5.1). App Store 정식 제출 때를 위한 사전 정리다.
> 그럼에도 지금 적어 두는 이유는, 위 항목 대부분이 **나중에 고치면 비싼 구조적 결정**이기 때문이다.

---

## 8. 스토어 등록 자산 규격표

> **§8.1~§8.4는 Google Play, §8.5는 iOS(App Store)다.**
> **Day 7 목표(내부 TestFlight)에 필요한 iOS 자산은 앱 아이콘 하나뿐**이며, 나머지는 정식 제출용이다(§7.5.3).

### 8.1 Google Play 그래픽 자산 (2026-08-10 확인)

| 자산 | 크기 | 포맷 | 용량 | 개수 | 비고 |
|---|---|---|---|---|---|
| **앱 아이콘** | **512 × 512 px** | **32비트 PNG (알파 포함)** | **≤ 1024 KB** | 1 (필수) | 스토어 표시용. 런처 아이콘(`mipmap`)과 별개 |
| **피처 그래픽** | **1024 × 500 px** | **JPEG 또는 24비트 PNG (알파 없음)** | ⚠ 상한 확인 필요 | 1 (필수) | 가로 배너. **알파 채널 금지** |
| **휴대전화 스크린샷** | 최소 변 320 px / 최대 변 3840 px, **최대 변 ≤ 최소 변 × 2** | JPEG 또는 24비트 PNG (알파 없음) | ⚠ 상한 확인 필요 | **최소 2장** (전 기기 유형 합산), 최대 8장 | **권장: 1080p 이상 4장 이상, 가로 16:9 → 최소 1920×1080** |
| **태블릿 스크린샷** | 1080 ~ 7680 px, 가로 16:9 | 동일 | — | 유형당 최소 4장 | 태블릿 타겟팅 시 |
| **동영상(유튜브)** | — | YouTube URL | — | 선택 | 7일 스코프에서는 **생략** |

> **BLOODSWORN은 가로 고정 게임이므로 스크린샷은 전부 가로 16:9로 만든다.**
> 논리 해상도 640×360 → **1920×1080 (×3 정수배)** 로 캡처하면 픽셀아트가 뭉개지지 않는다.
> 정수배 스케일링이 아닌 크기(예: 1600×900)로 저장하면 도트가 흐려져 스토어에서 품질이 나빠 보인다.
>
> **경고:** 스크린샷을 640×360 원본으로 올리면 "최소 변 320px" 은 만족하지만 스토어에서 확대되어 흐리게 보인다.
> 반드시 1920×1080로.

**스크린샷 8장 구성안 (정본 기준 — 게임의 셀링 포인트 순서)**

| # | 화면 | 캡처 포인트 | 오버레이 카피(한) |
|---|---|---|---|
| 1 | PACT 카드 3장 | 축복+대가가 한눈에 보이게, 대가는 붉은 잉크 | 모든 축복에는 대가가 따른다 |
| 2 | **각성 발동 순간** | 심홍 플래시 + 각성 이름 대형 타이포 + 충격파 | 저주를 세 번 견디면, 저주가 너를 위해 싸운다 |
| 3 | 최대 밀도 전투 (03:00) | 적 80체+ 화면을 가득 | 6분. 새벽까지 버텨라 |
| 4 | 보스 「여명의 처형인」 | 1:1 구도, 붉은 텔레그래프 인디케이터 | 여명이 너를 처형하러 온다 |
| 5 | 각성 임박 카드 | 금빛 맥동 테두리 + "이 계약으로 각성한다" | 이 계약으로 각성한다 |
| 6 | 인간성 UI 클로즈업 | 심장 5개 중 3개가 검게 | 인간성은 돌아오지 않는다 |
| 7 | 성소(Sanctum) | 영구 업그레이드 6종 | 죽어도 강해진다 |
| 8 | 타이틀 화면 | 로고 + 태그라인 | BLOODSWORN / 피의 서약 |

> **1·2번이 전환율을 결정한다.** 시간이 없으면 1·2·3 세 장만 제대로 만들고 나머지는 나중에 추가한다(최소 2장 요건 충족).
> 각성 순간 캡처는 정본 `04-PACT-SYSTEM.md` §5.2가 말한 대로 **"이게 게임의 대표 스크린샷이 된다."**

### 8.2 텍스트 규격 (2026-08-10 확인)

| 항목 | 제한 | 노출 위치 |
|---|---|---|
| 앱 이름 | **30자 이내** | 검색 결과, 아이콘 아래 |
| 짧은 설명 | **80자 이내** | 스토어 상단, 검색 결과 |
| 자세한 설명 | **4000자 이내** | 스토어 "자세히 보기" |

### 8.3 실제 문안 초안 — 한국어

**앱 이름 (30자 이내)**
```
BLOODSWORN: 피의 서약
```
*(20자. 한국어 검색 대응 + 영문 브랜드 병기)*

**짧은 설명 (80자 이내)**
```
모든 축복에는 대가가 따른다. 6분 안에 새벽까지 살아남는 가로형 로그라이트 서바이버.
```
*(46자)*

대안 (태그라인 우선형):
```
새벽까지 버텨라. 대가는 나중에 치른다. 저주 3중첩이 최강의 힘으로 뒤집히는 6분 서바이버.
```
*(50자)*

**자세한 설명 (4000자 이내)**
```
■ 모든 축복에는 대가가 따른다

카르낙 수도원 지하, 봉인묘.
천 년 동안 잠들어 있던 태초의 흡혈귀 「녹턴」의 무덤이 오늘 밤 안에서부터 깨졌다.
서약기사단은 전멸했다. 남은 것은 단 한 명 — 가슴이 꿰뚫린 채 성촉 앞에 쓰러진 에일라.

사슬 아래에서 목소리가 들려온다.

  "거래하지. 내 피를 주마. 대신 —— 조금씩만 가져가겠다."

성촉은 새벽빛이 닿는 순간 다시 타오른다.
즉, 새벽까지만 버티면 된다. 단 6분.


■ 레벨업이 딜레마가 되는 서바이버

레벨업할 때마다 「계약서」 3장이 제시된다.
각 계약서에는 축복(Blessing)과 대가(Toll)가 한 쌍으로 묶여 있다.

  ✦ 축복 — 화염탄 Lv.2 → Lv.3, 투사체 +1
  ✖ 대가 — [근시] 모든 무기 사거리 -18%
  · 인간성 -6

강한 축복일수록 대가가 무겁다.
Epic 등급 계약은 저주를 한 번에 두 겹 얹는다.
"이걸 골라도 되나?" — 매 레벨업 5초의 진짜 고민이 이 게임의 전부다.


■ ★ 각성 — 저주가 힘으로 뒤집히는 순간

같은 계열의 대가가 3중첩되면 「각성」이 발동한다.
저주가 정반대의 강력한 능력으로 뒤집힌다.

  · 허약 ×3 → 「불사의 껍질」   치명타마다 회복. 죽어도 1회 부활.
  · 둔족 ×3 → 「중력의 군주」   느려짐이 사라지고, 주변 모든 적이 대신 느려진다.
  · 근시 ×3 → 「접촉의 광기」   가까운 적에게 주는 피해 2배.
  · 탐욕 ×3 → 「탐욕의 왕관」   경험치가 폭주하고 오브가 적을 관통한다.
  · 암야 ×3 → 「어둠의 눈」     보이지 않는 적에게 주는 피해 1.8배.
  · 갈증 ×3 → 「진조의 갈증」   처치할 때마다 피가 터지고, 멈추면 죽는다.

플레이어는 처음엔 손해를 피하려 한다.
그러다 어느 순간, 손해를 일부러 모으기 시작한다.
그 전환점이 이 게임의 아하 모먼트다.


■ 인간성 — 돌아오지 않는 것

계약할 때마다 인간성이 깎인다. 회복 수단은 없다.
인간성이 0이 되면 「완전 흡혈귀화」— 모든 능력이 상승하지만 모든 대가가 두 배가 된다.

당신이 어떤 존재로 새벽을 맞이하는지에 따라 엔딩이 갈린다.

  · 엔딩 A 「인간」   — 아직 사람인 채로 살아남았다
  · 엔딩 B 「서약자」 — 봉인은 지켰다. 거울 속 얼굴이 낯설 뿐이다
  · 엔딩 C 「진조」   — 녹턴이 웃으며 사슬 앞의 자리를 비켜준다


■ 특징

  · 한 판 6분. 출퇴근 시간에 딱 맞는 초단편 로그라이트
  · 가로 화면 · 한 손 조작. 공격은 전자동, 당신은 움직이기만 하면 된다
  · 축복 22종 × 대가 6계열 = 132가지 계약 조합. 매판 다른 빌드
  · 각성 6종 + 최종 각성. 저주를 어떻게 몰아줬는가가 곧 당신의 빌드
  · 16비트 픽셀아트 고딕 다크 판타지. 심홍과 청록, 두 광원의 대비
  · 성소(Sanctum) 영구 강화 6종 — 죽어도 다음 판이 강해진다
  · 인터넷 연결 불필요. 계정 없음. 광고 없음. 데이터 수집 없음


새벽까지 버텨라. 대가는 나중에 치른다.
```

### 8.4 실제 문안 초안 — 영어

**App name (≤30 chars)**
```
BLOODSWORN: The Blood Pact
```
*(26 chars)*

**Short description (≤80 chars)**
```
Every blessing has its toll. Survive 6 minutes until dawn. Roguelite survivor.
```
*(77 chars)*

**Full description (≤4000 chars)**
```
■ EVERY BLESSING HAS ITS TOLL

Beneath Carnac Abbey lies the Sealed Tomb, where the first vampire — NOCTURNE —
has slept in chains for a thousand years. Tonight the seal broke from the inside.

The Oathsworn Order is dead. One knight remains: Eila, run through the chest,
collapsed before the sacred candle. From beneath the chains, a voice:

  "Let's make a deal. I'll give you my blood. In exchange — I'll only take a little.
   A little at a time."

The candles refill the moment dawn's light touches them.
So you only have to last until dawn. Six minutes.


■ A SURVIVOR WHERE LEVELING UP IS A DILEMMA

Every level-up offers three CONTRACTS. Each pairs a Blessing with a Toll.

  ✦ BLESSING — Emberbolt Lv.2 → Lv.3, +1 projectile
  ✖ TOLL     — [MYOPIA] All weapon range -18%
  · Humanity -6

The stronger the blessing, the heavier the toll.
Epic contracts stack the curse twice at once.
"Can I really take this?" — five seconds of genuine hesitation, every single level.


■ ★ AWAKENING — WHEN THE CURSE TURNS

Stack the same toll three times and it AWAKENS, inverting into its opposite.

  · FRAIL  ×3 → HUSK ETERNAL     Heal on every crit. Revive once on death.
  · SLOW   ×3 → LORD OF WEIGHT   Your slowness ends; the world slows instead.
  · MYOPIA ×3 → TOUCH MADNESS    Double damage to anything close enough to touch.
  · GREED  ×3 → CROWN OF AVARICE Runaway XP. Orbs pierce and wound.
  · BLIND  ×3 → EYE OF NYX       1.8x damage to everything you cannot see.
  · HUNGER ×3 → TRUE THIRST      Every kill detonates in blood. Stop, and you die.

At first you avoid the damage. Then, at some point, you start collecting it
on purpose. That turn is what this game is about.


■ HUMANITY — THE THING THAT DOES NOT COME BACK

Every contract costs humanity. There is no way to restore it.
At zero, you undergo full vampiric ASCENSION: every stat rises, every toll doubles.

What you have become by dawn decides your ending.

  · ENDING A "HUMAN"     — you survived, and you are still a person
  · ENDING B "OATHSWORN" — the seal held. The face in the mirror is a stranger's.
  · ENDING C "TRUEBLOOD" — Nocturne smiles, and steps aside from the chains.


■ FEATURES

  · 6-minute runs. A roguelite built for a commute, not an evening
  · Landscape, one-handed. Attacks are fully automatic — you only move
  · 22 blessings x 6 toll lines = 132 contract combinations. A new build every run
  · 6 awakenings plus a final one. Your build is which curse you chose to carry
  · 16-bit pixel art gothic dark fantasy. Crimson and teal, two light sources
  · 6 permanent Sanctum upgrades — every death makes the next run stronger
  · No internet required. No account. No ads. No data collection.


Last until dawn. You can pay for it later.
```

> **스토어 문안 정책 주의:** Play 메타데이터 정책은 제목/설명에 **과도한 이모지·특수문자·대문자 남용·성능 주장**을 제한한다.
> 위 초안의 `■ ✦ ✖ ·` 정도의 구분 기호는 통상 허용되지만, ⚠ 정확한 허용 범위는 **확인 필요(2026-08-10 기준 미확인)**.
> 반려되면 `■` 를 `[ ]` 나 줄바꿈으로 바꿔 재제출한다.

### 8.5 iOS(App Store) 자산 규격

#### 8.5.1 앱 아이콘 — Android와 다른 점이 하나 있고, 그게 거부 사유다

| 항목 | Google Play | **App Store** |
|---|---|---|
| 크기 | 512 × 512 | **1024 × 1024** |
| 알파 채널 | **포함(32비트 PNG)** | 🔴 **없어야 한다. 투명도가 있으면 거부된다** |
| 넣는 곳 | Play Console 스토어 등록정보 | `FE/ios/App/App/Assets.xcassets/AppIcon.appiconset/` |

> 🔴 **알파 채널 유무가 정확히 반대다.** Play용으로 만든 512 아이콘을 그대로 확대해 쓰면
> 알파가 살아 있어 **거부된다.** 그리고 이 거부는 CI가 아니라 **App Store Connect가 업로드 이후에** 알려준다 —
> 즉 왕복이 한 번 더 든다.

**새 이미지를 만들지 않는다.** `15-IMAGE-PROMPTS-FOR-CODEX.md` 의 아이콘 원본을 **후처리**한다.

```bash
# ImageMagick — 알파를 제거하고 정본 배경색으로 평탄화한 뒤 1024로 맞춘다
magick icon-source.png -resize 1024x1024 \
  -background "#0b0710" -alpha remove -alpha off \
  -define png:color-type=2 icon-1024-noalpha.png

# 검증 — 결과가 'sRGB' 이고 'srgba'/'RGBA' 가 아니어야 한다
magick identify -verbose icon-1024-noalpha.png | grep -i "colorspace\|Alpha\|Geometry"
```
- `-alpha remove` 만 하고 `-alpha off` 를 빼면 **알파 채널이 전부 불투명한 상태로 남는다.** 채널 자체가 사라져야 한다.
- 배경색은 정본 레터박스 색 `#0b0710` 으로 평탄화한다(`03-GDD-CORE.md` §2.1). 흰색으로 평탄화하면 아이콘 모서리가 뜬다.
- ⚠ ImageMagick이 없다면 다른 도구를 써도 되지만, **"알파 채널이 없는지"를 반드시 검증**한 뒤 넣는다. 눈으로는 구분되지 않는다.

#### 8.5.2 App Store 스크린샷 규격 (정식 제출용 — Day 7 대상 아님)

| 항목 | 값 |
|---|---|
| 리드 사이즈 (2026) | 6.9인치 **세로 1320×2868** → **가로는 치수를 뒤집어 2868×1320** |
| 6.9인치 계열 허용 세로 | 1260×2736 / 1290×2796 / 1320×2868 (가로는 각각 뒤집는다) |
| 정밀도 | 🔴 **1픽셀만 틀려도 App Store Connect가 거부한다** |

> **BLOODSWORN은 가로 고정이므로 `2868 × 1320` 으로 만든다.**
>
> **문제: 이 크기는 논리 해상도 640×360의 정수배가 아니다.**
> `2868 ÷ 640 = 4.48`, `1320 ÷ 360 = 3.667` — 어느 쪽도 정수가 아니다.
> Play 스크린샷에서 쓴 "1920×1080 정수배 캡처"(§8.1) 전략을 그대로 쓸 수 없다.
>
> **대응: 정수배로 렌더한 뒤 레터박스로 채운다.** 게임 자체가 `Scale.FIT` 레터박스이므로 결과물이 실제 화면과 일치한다.
> ```
>   캔버스 640×360 × 3배 = 1920×1080   (정수배 → 도트가 뭉개지지 않는다)
>   최종 프레임          = 2868×1320
>   좌우 여백 = (2868 − 1920) / 2 = 474 px   ← #0b0710 으로 채운다
>   상하 여백 = (1320 − 1080) / 2 = 120 px   ← 동일
> ```
> 비정수배(예: 4.48배)로 늘리면 픽셀아트가 흐려져 스토어에서 품질이 나빠 보인다. **정수배 + 레터박스가 정답이다.**

> ⚠ **필수 최소 장수**와 **iPhone 전용 앱에서 iPad 스크린샷이 필요한지**는 **확인 필요(2026-08-10 기준 미확인)**.
> **내부 TestFlight에는 스크린샷이 아예 불필요**하므로(§7.5.3) Day 7 이후에 확정한다.
> 내용 구성은 §8.1의 8장 구성안을 그대로 재사용한다 — 같은 게임이므로 셀링 포인트가 달라질 이유가 없다.

---

## 9. 개인정보 처리방침

### 9.1 필요한가?

**필요하다.** 확인 결과(2026-08-10), 광고·분석·계정이 전혀 없어도
① **개인정보 처리방침 URL** 을 스토어 등록정보에 제공해야 하고,
② **데이터 보안(Data safety) 양식**을 반드시 제출해야 하며,
③ **양식의 선언 내용과 처리방침 본문이 서로 일치**해야 한다. (불일치가 반려 최다 원인)

BLOODSWORN은 서버 없음 / 계정 없음 / 광고 없음 / 분석 없음 / **기기 내 로컬 저장만** 사용하므로
**"데이터 수집·전송 없음"** 으로 일관되게 선언하면 된다.

**Apple 쪽 요건 — Play와 필요 시점이 다르다**

| 항목 | 내부 TestFlight (Day 7 목표) | 외부 TestFlight | App Store 정식 제출 |
|---|---|---|---|
| 개인정보 처리방침 URL | **불필요** | **필요** | **필요** |
| App Privacy 질문지 | **불필요** | ⚠ 확인 필요(2026-08-10 기준 미확인) | **필요** |

> **그럼에도 Day 1에 만든다.** Play가 어차피 요구하고(§7.1 R6), 만드는 데 15분이며,
> **iOS 쪽에서 필요해지는 시점에는 이미 다른 일로 바쁘기 때문**이다.
> 하나의 URL을 양 스토어가 공유한다 — 스토어별로 따로 만들 이유가 없다.
>
> **App Privacy 질문지도 답은 Play 데이터 보안 양식과 같다**(§9.3): 수집·추적 없음.
> **두 스토어에 다르게 답하지 않는다.** 같은 앱이므로 다를 수가 없고, 다르면 그 자체가 문제다.

> ⚠ 주의: `package.json` 에 `firebase` 의존성이 남아 있다. **실제로 초기화·호출하지 않으면** 데이터 수집이 아니지만,
> 코드에 `initializeApp()` 이 한 줄이라도 살아 있으면 **기기 식별자·앱 이벤트가 전송되어 선언과 불일치**가 된다.
> **Day 6에 `grep -r "firebase" FE/src` 로 0건임을 반드시 확인할 것.** 안전하게는 의존성 자체를 제거한다.

### 9.2 무료 호스팅 방법 — GitHub Pages (권장, 10분)

```bash
# 1) GitHub에 공개 저장소 생성: bloodsworn-privacy
# 2) 로컬에서
mkdir bloodsworn-privacy && cd bloodsworn-privacy
git init
# 아래 §9.4 HTML을 index.html 로 저장
git add index.html
git commit -m "Add privacy policy"
git branch -M main
git remote add origin https://github.com/<USER>/bloodsworn-privacy.git
git push -u origin main

# 3) GitHub 저장소 → Settings → Pages → Source: "Deploy from a branch"
#    → Branch: main / (root) → Save
# 4) 몇 분 후 https://<USER>.github.io/bloodsworn-privacy/ 로 접속 가능
```

**대안**

| 방법 | 장점 | 단점 |
|---|---|---|
| **GitHub Pages** | 무료·영구·HTTPS·커스텀 도메인 가능 | GitHub 계정 필요 |
| GitHub Gist (raw) | 30초 | ⚠ raw URL이 Play 심사에서 유효한 처리방침 URL로 인정되는지 **확인 필요(2026-08-10 기준 미확인)**. 권장 안 함 |
| Notion 공개 페이지 | 편집 쉬움 | URL이 지저분, Notion 정책 변경 리스크 |
| Cloudflare Pages / Netlify | 무료·빠름 | 계정 생성 필요 |

> **결론: GitHub Pages.** URL이 깔끔하고 무료이며 사라지지 않는다.
> Play Console에 등록한 처리방침 URL이 **404가 되면 앱이 정지될 수 있다.** 사라질 수 있는 호스팅은 쓰지 않는다.
>
> **부가 이유: GitHub 계정이 어차피 필요해졌다.** §6.4.0 때문에 소스용 원격 저장소를 만들어야 하므로
> "GitHub 계정 필요"라는 유일한 단점이 이번 주에는 단점이 아니다.
> ⚠ 단 **처리방침 저장소는 소스 저장소와 분리한다.** 소스 저장소는 private이어야 하고(§5.5.7),
> 처리방침은 public이어야 한다. 한 저장소에 섞으면 둘 중 하나가 반드시 틀린 상태가 된다.

### 9.3 데이터 보안 양식 응답안

| 문항 | 응답 |
|---|---|
| 앱이 사용자 데이터를 수집하거나 공유합니까? | **아니요** |
| 전송 중 데이터가 암호화됩니까? | (수집 없음 선택 시 비활성) |
| 사용자가 데이터 삭제를 요청할 수 있습니까? | (수집 없음 선택 시 비활성) |
| 앱이 독립적인 보안 검토를 받았습니까? | 아니요 (선택 사항) |
| 개인정보 처리방침 URL | `https://<USER>.github.io/bloodsworn-privacy/` |

> **게임 진행도(`bloodsworn.save.v1`)는 "수집"이 아니다.** 기기 밖으로 전송되지 않기 때문이다.
> 이 점을 처리방침 본문에도 명시해 양식과 일치시킨다.
>
> ⚠ **저장 위치가 플랫폼마다 다르다는 점을 처리방침 본문에 반영해야 한다.**
> iOS에서는 `localStorage` 외에 `@capacitor/preferences`(내부적으로 `UserDefaults`)에도 같은 값을 쓴다(§12-H).
> **둘 다 기기 안이므로 "수집 없음" 선언은 그대로 유효**하지만, 본문이 `localStorage` 만 언급하면
> **본문과 실제 동작이 어긋난다.** 불일치는 반려 최다 원인이므로 §9.4의 §3 항목을 아래처럼 써 둔다.

### 9.4 처리방침 전문 초안 (한/영 병기 HTML)

아래를 `index.html` 로 저장해 GitHub Pages에 올린다.
**`[여기에 연락처 이메일]` 과 `[YYYY-MM-DD]` 두 곳만 바꾸면 완성이다.**

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BLOODSWORN 개인정보 처리방침 / Privacy Policy</title>
<style>
  body{max-width:760px;margin:0 auto;padding:32px 20px;
       font-family:system-ui,-apple-system,"Segoe UI","Malgun Gothic",sans-serif;
       line-height:1.75;color:#1a1a1a;background:#fff}
  h1{font-size:1.6rem;border-bottom:2px solid #8B0F1D;padding-bottom:8px}
  h2{font-size:1.15rem;margin-top:2em;color:#8B0F1D}
  hr{margin:3em 0;border:0;border-top:1px solid #ddd}
  .meta{color:#666;font-size:.9rem}
  code{background:#f4f4f4;padding:2px 5px;border-radius:3px;font-size:.9em}
</style>
</head>
<body>

<h1>BLOODSWORN (피의 서약) 개인정보 처리방침</h1>
<p class="meta">최종 수정일: [YYYY-MM-DD] · 앱 패키지: <code>com.bloodsworn.game</code></p>

<h2>1. 요약</h2>
<p><strong>BLOODSWORN은 어떠한 개인정보도 수집, 저장, 전송, 공유하지 않습니다.</strong>
이 앱은 완전한 오프라인 단일 플레이 게임이며, 서버를 운영하지 않고 사용자 계정을 만들지 않습니다.</p>

<h2>2. 수집하지 않는 정보</h2>
<p>본 앱은 다음을 포함한 어떠한 정보도 수집하지 않습니다.</p>
<ul>
  <li>이름, 이메일 주소, 전화번호 등 식별 정보</li>
  <li>위치 정보</li>
  <li>연락처, 사진, 파일, 캘린더 등 기기 내 개인 데이터</li>
  <li>광고 식별자(AAID), 기기 식별자, IP 주소</li>
  <li>사용 분석(애널리틱스), 충돌 보고서, 행동 로그</li>
  <li>결제 정보 (앱 내 결제 기능이 없습니다)</li>
</ul>

<h2>3. 기기 내 로컬 저장</h2>
<p>본 앱은 게임 진행 상황(획득 골드, 영구 업그레이드 단계, 해금 상태, 옵션 설정)을
사용자의 기기 내부 저장소에만 저장합니다.
Android에서는 앱 내부 WebView의 <code>localStorage</code>(키: <code>bloodsworn.save.v1</code>)를 사용하며,
iOS에서는 동일한 값을 앱 전용 설정 저장소(<code>UserDefaults</code>)에 함께 보관합니다.</p>
<p>이 데이터는 <strong>기기 밖으로 전송되지 않으며</strong>, 개발자를 포함한 누구도 접근할 수 없습니다.
앱을 삭제하면 이 데이터도 함께 삭제됩니다.</p>

<h2>4. 네트워크 사용</h2>
<p>본 앱은 정상적인 게임 플레이 중 인터넷에 연결하지 않습니다.
Android 매니페스트에 <code>INTERNET</code> 권한이 선언되어 있으나, 이는 Android WebView 기반 앱의
표준 구성 요소이며 외부 서버와의 통신에 사용되지 않습니다.
iOS 버전 역시 어떠한 외부 서버와도 통신하지 않습니다.</p>

<h2>5. 제3자 서비스</h2>
<p>본 앱은 광고 네트워크, 분석 도구, 소셜 로그인, 푸시 알림, 클라우드 저장 등
어떠한 제3자 SDK 또는 서비스도 사용하지 않습니다.</p>

<h2>6. 아동의 개인정보</h2>
<p>본 앱은 개인정보를 수집하지 않으므로 아동을 포함한 어떤 연령대의 개인정보도 수집하지 않습니다.
다만 본 게임은 유혈 및 공포 표현을 포함하므로 스토어에 표시된 연령 등급을 참고하시기 바랍니다.</p>

<h2>7. 권리와 데이터 삭제</h2>
<p>수집하는 데이터가 없으므로 열람·정정·삭제를 요청할 대상 데이터가 존재하지 않습니다.
기기에 저장된 게임 진행 데이터는 앱을 삭제하거나 앱 정보 &gt; 저장공간 &gt; 데이터 삭제를 통해
사용자가 직접 언제든지 삭제할 수 있습니다.</p>

<h2>8. 변경 고지</h2>
<p>본 방침이 변경될 경우 이 페이지에 갱신된 내용과 최종 수정일을 게시합니다.
데이터 수집이 시작되는 변경이 있을 경우, 앱 업데이트 및 Play 스토어 데이터 보안 섹션을 통해
변경 사항을 고지합니다.</p>

<h2>9. 문의</h2>
<p>개인정보 처리방침에 대한 문의: <a href="mailto:[여기에 연락처 이메일]">[여기에 연락처 이메일]</a></p>

<hr>

<h1>BLOODSWORN — Privacy Policy (English)</h1>
<p class="meta">Last updated: [YYYY-MM-DD] · Package: <code>com.bloodsworn.game</code></p>

<h2>1. Summary</h2>
<p><strong>BLOODSWORN does not collect, store, transmit, or share any personal data.</strong>
It is a fully offline single-player game with no servers and no user accounts.</p>

<h2>2. Information We Do Not Collect</h2>
<ul>
  <li>Name, email address, phone number, or any identifier</li>
  <li>Location data</li>
  <li>Contacts, photos, files, calendar, or other on-device personal data</li>
  <li>Advertising ID (AAID), device identifiers, or IP address</li>
  <li>Usage analytics, crash reports, or behavioural logs</li>
  <li>Payment information (the app contains no in-app purchases)</li>
</ul>

<h2>3. Local On-Device Storage</h2>
<p>The app stores game progress (gold earned, permanent upgrade levels, unlocks, option settings)
exclusively in your device's local storage. On Android this is the in-app WebView's
<code>localStorage</code> (key <code>bloodsworn.save.v1</code>); on iOS the same values are also kept
in the app's private settings store (<code>UserDefaults</code>).
This data <strong>never leaves your device</strong> and is not accessible to the developer or anyone else.
Uninstalling the app removes it.</p>

<h2>4. Network Usage</h2>
<p>The app does not connect to the internet during normal gameplay. The <code>INTERNET</code>
permission declared in the Android manifest is a standard component of WebView-based Android apps
and is not used to communicate with any external server. The iOS build likewise communicates
with no external server.</p>

<h2>5. Third-Party Services</h2>
<p>The app uses no third-party SDKs or services of any kind: no ad networks, no analytics,
no social login, no push notifications, no cloud saves.</p>

<h2>6. Children's Privacy</h2>
<p>Because the app collects no personal data, it collects no data from children either.
Note that this game contains depictions of blood and horror themes; please refer to the
content rating shown on the store listing.</p>

<h2>7. Your Rights and Data Deletion</h2>
<p>As no data is collected, there is no collected data to access, correct, or delete.
Local game progress can be deleted at any time by uninstalling the app or via
App info &gt; Storage &gt; Clear data.</p>

<h2>8. Changes to This Policy</h2>
<p>If this policy changes, the updated text and revision date will be posted on this page.
If a future version begins collecting data, that change will be disclosed through an app update
and through the Google Play Data Safety section.</p>

<h2>9. Contact</h2>
<p>Questions about this policy: <a href="mailto:[여기에 연락처 이메일]">[여기에 연락처 이메일]</a></p>

</body>
</html>
```

> **처리방침 본문이 데이터 보안 양식과 일치해야 한다**는 요건을 위 문서는 만족한다:
> 양식 "수집/공유 없음" ↔ 본문 §1·§2 "수집하지 않음", 로컬 저장은 §3에서 "수집이 아님"을 명시.

---

## 10. iOS 배포 트러블슈팅 (CI · 서명 · 업로드)

> **§12는 게임이 기기에서 도는 동안의 문제, 이 §10은 "빌드가 TestFlight까지 못 가는" 문제**를 다룬다.
> 두 문제는 진단 수단이 완전히 다르다 — §12는 화면을 보고 판단하지만, **§10은 볼 수 있는 것이 CI 로그뿐**이다.

### 10.0 진단 원칙 — Mac이 없다는 전제에서 출발한다

Android 트러블슈팅(§12)은 "재현 → 관찰 → 수정"이 5분 루프다. `chrome://inspect` 로 실기기 콘솔을 열 수 있고,
`gradlew` 를 몇 번이든 다시 돌릴 수 있다. **iOS는 이 루프가 존재하지 않는다.**

| | Android | iOS |
|---|---|---|
| 1회 왕복 | 1~3분 (로컬) | **10분 안팎 (CI 큐 대기 + 빌드)** |
| 왕복 비용 | 0 | **무료 빌드 분(minute)을 소모한다** (§6.4.1) |
| 관찰 수단 | logcat · DevTools · 실기기 | **CI 로그 + App Store Connect 화면** |
| 시도 횟수 | 사실상 무제한 | **약 50회** (Codemagic 500분 기준) |

**여기서 나오는 3가지 운영 규칙**

1. **한 번에 한 가지만 바꾼다.** 두 개를 동시에 고치면 어느 쪽이 원인이었는지 영원히 모른다.
   Android에서는 다시 돌리면 되지만 여기서는 그 "다시"가 10분이다.
2. **로그를 반드시 아티팩트로 남긴다** (§6.4.3). 로그가 잘려 있으면 다음 시도는 추측이 된다.
3. **로그를 끝까지 읽고 나서 고친다.** 로그를 반쯤 읽고 짐작으로 고치는 것이 이 프로젝트에서 가장 비싼 습관이다.

> **그리고 이 모든 것이 §0.1(Day 1~2 관통 리허설)의 근거다.**
> 아래 A~E는 **전부 Day 1~2에 만나야 하는 문제**다. Day 7에 만나면 남은 왕복 횟수가 없다.

### 10-A. 서명 실패 (`xcodebuild archive` 단계)

**가장 흔하고, 가장 먼저 만나고, 가장 오래 붙잡는 문제다.**

| 증상 유형 | 원인 후보 | 확인·해결 |
|---|---|---|
| 서명 ID를 찾을 수 없다는 취지의 실패 | `.p12` 가 CI 키체인에 설치되지 않았거나 암호가 틀림 | §5.5.6의 시크릿 2종이 **세트로** 맞는지 확인. base64에 줄바꿈이 섞이면 복원이 깨진다 |
| 프로파일을 찾을 수 없다는 취지의 실패 | `.mobileprovision` 미설치, 또는 **번들 ID 불일치** | 프로파일은 App ID에 묶여 있다. `com.bloodsworn.game` 이 아닌 프로파일이면 무조건 실패 |
| 인증서와 프로파일이 맞지 않는다는 취지의 실패 | 인증서를 재발급했는데 **프로파일을 다시 안 만듦** | §5.5.4 — 인증서 재발급 시 프로파일도 재생성이 필요하다 |
| `signingStyle` 관련 실패 | `project.pbxproj` 의 `CODE_SIGN_STYLE = Automatic` 과 `ExportOptions.plist` 의 `manual` 이 충돌 | §6.4.3의 🔴 항목. 명령줄 `CODE_SIGN_STYLE=Manual` 덮어쓰기를 먼저 시도 |
| Team ID 관련 실패 | `ExportOptions.plist` 의 `teamID` 오타 | Apple Developer 계정 페이지의 Team ID와 문자 단위로 대조 |

> **먼저 확인할 것 (로그를 열기 전에 30초):**
> 1. `git status` 에 서명 파일이 안 뜨는가 → 뜨면 §5.5.7 위반이며 그 인증서는 폐기 대상이다.
> 2. CI 시크릿 4종이 **전부** 등록되어 있는가 → 3종만 넣고 시작하는 경우가 흔하다.
> 3. base64 인코딩에 줄바꿈이 없는가 → 이게 원인일 때 로그는 "파일이 깨졌다"가 아니라 **"암호가 틀렸다"** 로 나온다.
>
> **⚠ 서명 관련 로그 메시지의 정확한 문구는 Xcode 버전마다 다르다(2026-08-10 기준 미확인).**
> 문구를 외우려 하지 말고 **위 원인 후보를 순서대로 소거**하는 편이 빠르다.

**폴백:** 세 번 시도해도 안 뚫리면, **원인을 좁히는 빌드**를 한 번 쓴다 —
서명 없이 `xcodebuild build` 만 돌려 **"게임 코드는 컴파일되는가"** 를 먼저 확정한다.
컴파일이 되면 문제는 100% 서명 쪽이며, 그때부터 `.p12` 를 새로 만드는 것이 재시도보다 빠르다.

### 10-B. `pod install` 실패 / 빌드 산출물 없음

| 증상 | 원인 | 해결 |
|---|---|---|
| `pod install` 이 `Podfile` 을 못 찾음 | 작업 디렉토리가 `FE/ios/App` 이 아님 | `Podfile` 은 `FE/ios/App/Podfile` 에 있다 (§6.4.2 5단계) |
| Capacitor pod 경로 해석 실패 | `npm ci` 가 안 돌았거나 `node_modules` 부재 | `Podfile` 이 `../../node_modules/@capacitor/ios` 를 **상대경로로 참조**한다. **`npm ci` 가 `pod install` 보다 먼저** 와야 한다 |
| `xcodebuild` 가 워크스페이스를 못 엶 | `pod install` 을 건너뜀 | `.xcworkspace` 를 열어야지 `.xcodeproj` 를 열면 안 된다. `Pods/` 는 커밋하지 않으므로(§5.2 ②) CI가 매번 만들어야 한다 |
| 배포 타겟 관련 실패 | `Podfile` 의 `platform :ios, '14.0'` 과 `IPHONEOS_DEPLOYMENT_TARGET` 불일치 | **양쪽 다 14.0** 이어야 한다. 현재 스캐폴드는 양쪽 모두 14.0으로 일치한다 |
| `.ipa` 가 안 생김 (에러는 없음) | 아티팩트 경로 패턴이 틀림 | §6.4.3의 `artifacts` 경로는 **첫 빌드 로그에서 실제 출력 경로를 확인해 확정**한다 |
| Xcode 버전 부족 | CI 이미지의 Xcode가 16.0 미만 | Capacitor 7은 **Xcode 16.0 이상**을 요구한다. `environment.xcode` 를 명시적으로 올린다 |

> **Capacitor 8로 올려서 해결하려 하지 말 것.** 8이 이미 나와 있으나 **이번 주에 올리지 않는다.**
> 7일 스코프에서 메이저 업그레이드는 순수 리스크다 — 지금 문제는 툴체인 설정이지 Capacitor 버전이 아니다.

### 10-C. 업로드 거부 (App Store Connect가 받아주지 않음)

빌드는 성공했는데 업로드가 튕기는 단계다. **거부 사유는 대체로 메일이나 CI 로그로 통보된다.**

| 증상 유형 | 원인 후보 | 해결 |
|---|---|---|
| 인증 실패 | ASC API 키 3요소(`.p8` / Issuer ID / Key ID) 중 하나가 틀림 | 셋은 **한 세트**다. 하나만 바꿔 끼우는 식으로 시도하지 말 것 (§5.5.5) |
| 번들 ID를 아는 앱이 없다는 취지 | **App Store Connect 앱 레코드 미생성** | §7.5.5. 앱 레코드가 빌드보다 먼저 존재해야 한다 |
| 빌드 번호 중복 | `CFBundleVersion` 이 이미 올라간 값과 같음 | §6.4.4. Android `versionCode` 와 완전히 같은 성질이다 |
| 아이콘 관련 거부 | **1024 아이콘에 알파 채널이 있음** | §8.5.1. 이 거부는 빌드가 아니라 **업로드 후**에 온다 |
| 기기 요구사항 관련 거부 | `Info.plist` 의 `UIRequiredDeviceCapabilities = armv7` | §3.5의 ⚠ 항목. **첫 번째 용의자로 볼 것** |
| 수출 규정 미응답 ("Missing Compliance") | `ITSAppUsesNonExemptEncryption` 없음 | §7.5.2의 4번. 이건 업로드는 되고 **배포가 막힌다** |

> ⚠ **`xcrun altool` 로 우회하려 하지 말 것.** altool은 계정이 여러 provider에 걸쳐 있을 때 오작동 보고가 있고,
> 옵션 체계도 이동 중이다(§6.4.2). **fastlane `pilot` 에서 난 문제를 altool로 덮으면 원인만 흐려진다.**

### 10-D. 빌드 처리(Processing) 무한 대기

업로드는 수락되었는데 TestFlight에 빌드가 안 나타나는 상태다.

| 확인 | 판단 |
|---|---|
| App Store Connect의 **활동/빌드** 탭에 빌드가 보이는가 | 안 보이면 **업로드가 실제로는 실패**한 것이다 → §10-C로 돌아간다 |
| "처리 중" 상태로 보이는가 | 기다린다. ⚠ **정상 소요 시간은 확인 필요(2026-08-10 기준 미확인)** — 즉시일 때도, 오래 걸릴 때도 있다 |
| 메일이 왔는가 | Apple은 처리 실패 시 **메일로 사유를 보낸다.** 콘솔만 새로고침하지 말고 **메일함을 볼 것** |
| 빌드가 나타났는데 "규정 준수 누락"이 뜨는가 | §7.5.2의 4번 (`ITSAppUsesNonExemptEncryption`) |

> 🔴 **여기서 "기다리는 것" 외에 할 수 있는 일이 없다는 사실이, Day 7에 처음 업로드하면 안 되는 결정적 이유다.**
> 처리 시간을 통제할 수단이 존재하지 않는다. §0.1에서 이미 한 번 통과시켜 두면
> **적어도 "얼마나 걸리는지"를 알고 Day 7 시간표를 짤 수 있다.**
>
> ⚠ 그리고 §7.5.1의 Apple 문서 간 충돌(내부 테스터도 심사 대상인가)이 남아 있다.
> 만약 심사로 넘어갔다면 이건 "무한 대기"가 아니라 **심사 대기**이며 성격이 다르다.
> **하루 여유를 남겨 둔 이유가 이것이다.**

### 10-E. TestFlight 설치·실행 문제

빌드가 TestFlight에 떴는데 테스터가 못 받거나, 받았는데 안 도는 단계다.

| 증상 | 원인 | 해결 |
|---|---|---|
| 테스터에게 빌드가 안 보임 | **App Store Connect 사용자가 아님** | 내부 테스터는 팀 구성원이어야 한다 (§7.5.6). Play 내부 테스트와 다른 지점 |
| 그룹에 빌드를 할당하지 않음 | 빌드는 자동으로 배포되지 않는다 | TestFlight 탭에서 내부 그룹에 빌드를 할당 |
| Apple Silicon Mac에서 안 보임 | **그룹별 토글이 기본 꺼짐** | 필요하면 켠다. iPhone/iPad는 기본 허용 |
| 설치는 되는데 즉시 종료 | 빌드 자체 문제 | §12-H |
| **흰 화면** | 웹 자산 누락 / 경로 문제 | **§12-A와 §12-H.** ⚠ iOS는 WebView 콘솔을 볼 수단이 없으므로, **먼저 Android에서 같은 커밋이 정상인지 확인**해 문제를 iOS 고유 영역으로 좁힌다 |
| **소리가 안 남** | 무음 스위치 | **§12-H. 버그가 아닐 가능성이 매우 높다.** 코드를 보기 전에 스위치부터 본다 |
| 90일 뒤 빌드가 사라짐 | TestFlight 빌드 만료 | 정상 동작이다 (§7.5.6). 새 빌드를 올린다 |

> **"흰 화면"과 "소리 안 남"은 iOS 고유 문제가 아닐 수 있다.**
> 진단 순서는 항상 **①같은 커밋이 Android에서 정상인가 → ②정상이면 iOS 고유 → ③아니면 공통 버그** 다.
> Android가 무료로 제공하는 이 대조군을 쓰지 않으면, 볼 수 없는 플랫폼에서 추측만 하게 된다.

---

## 11. 버전 관리 규칙

### 11.1 Android — `versionCode` / `versionName`

| 항목 | 규칙 | 예 |
|---|---|---|
| `versionCode` | **정수. Play에 업로드할 때마다 무조건 +1.** 절대 감소 불가, 재사용 불가 | `1 → 2 → 3 …` |
| `versionName` | 사람이 읽는 버전. `MAJOR.MINOR.PATCH` | `0.1.0` (내부 테스트) → `1.0.0` (프로덕션) |

**단일 진실원천은 `FE/android/version.properties` 다.** `app/build.gradle` 이 이 파일을 읽는다.
`build.gradle` 을 열어 숫자를 고치는 일은 없다.

```properties
versionCode=1
versionName=1.0.0
```

#### ★ T243 — `versionCode` 자동 증가 (2026-08-12 구현 완료)

**이 자동화의 존재 이유는 하나다. "손으로 올리다 잊는 것"을 막는 것.**
Day 7 오후에 `versionCode` 를 안 올린 AAB 를 올리면 Play Console 이 즉시 거부하고,
그때부터 빌드를 다시 굽는 시간이 통째로 날아간다.

**어디서 도는가** — `FE/android/app/build.gradle` 최상단 `[T243]` 블록(설정 단계에서 1회 실행).
iOS 는 CI 가 이 일을 한다(`codemagic.yaml` 의 "빌드 번호 결정" 스텝 → `agvtool new-version -all $BUILD_NUMBER`,
`.github/workflows/ios-testflight.yml` → `agvtool new-version -all ${{ github.run_number }}`).
Android 는 릴리스 AAB 를 로컬에서 굽는 구조라 CI 카운터가 없으므로 **Gradle 이 같은 역할을 맡는다.**

**동작 규칙**

| 상황 | versionCode | 이유 |
|---|---|---|
| `assembleDebug`, `installDebug`, Android Studio Gradle sync, `gradlew tasks` | **그대로** | 개발 중 하루 50번 빌드해도 번호가 튀면 안 된다 |
| `bundleRelease` / `assembleRelease` / `installRelease` / `publish…Release` | **저장값 +1** 후 `version.properties` 에 되쓰기 | 릴리스 산출물 = 업로드 후보다 |
| `-PskipVersionBump` 를 준 릴리스 빌드 | **그대로** | 같은 번호로 빌드를 재현해야 할 때의 탈출구 |
| 환경변수 `ANDROID_VERSION_CODE=N` (또는 `-PandroidVersionCode=N`) | `N > 저장값` 이면 `N`, **아니면 저장값 +1** | 나중에 Android CI 를 붙일 때 CI 빌드 카운터를 그대로 주입하는 자리. 카운터가 리셋돼도 절대 내려가지 않는다 |

```powershell
# 릴리스 빌드 — 아무것도 안 해도 올라간다
.\gradlew bundleRelease
#  > [T243] versionCode 1 -> 2 (릴리스 태스크 자동 증가) — version.properties 가 갱신됐다. ★ 이 변경을 커밋하라.

# 같은 번호로 다시 굽기(디버깅용)
.\gradlew bundleRelease -PskipVersionBump

# CI 카운터 주입 (Android CI 를 붙이는 날)
$env:ANDROID_VERSION_CODE = "57"; .\gradlew bundleRelease
```

**🔴 반드시 지켜야 하는 것 — 바뀐 `version.properties` 를 커밋한다.**
커밋하지 않으면 다음 릴리스 빌드가 같은 값에서 다시 시작해 결국 같은 에러로 돌아온다.
`version.properties` 는 비밀이 아니므로 커밋 대상이다(키스토어와 다르다).

**⚠ 빌드가 실패해도 올린 값은 되돌리지 않는다.** `versionCode` 에 구멍(1, 2, 5 …)이 나는 것을 Play 는 허용한다.
되돌리려다 같은 값을 두 번 쓰는 쪽이 훨씬 위험하다.

**⚠ `gradlew build` 는 자동 증가에 걸리지 않는다.** 태스크 이름에 `Release` 가 없기 때문이다.
업로드용 산출물은 항상 `bundleRelease` 로 만든다.

**7일 프로젝트 권장 매핑**

| 단계 | versionName | versionCode |
|---|---|---|
| Day 6 첫 릴리스 빌드 검증 | `0.1.0` | 1 |
| Day 7 내부 테스트 업로드 | `0.1.1` | 2 |
| Day 7 재업로드(수정) | `0.1.2` | 3 |
| 폐쇄형 테스트 시작 | `0.2.0` | 4 |
| 프로덕션 출시 | `1.0.0` | 10 |

> 표는 "이렇게 되면 좋다"는 예시고, 실제 값은 자동 증가가 만든다. **표에 맞추려고 숫자를 내리지 마라.**

> **`versionCode` 를 올리지 않고 재업로드하면 Play Console이 즉시 거부한다.**
> "이미 versionCode 2를 사용하는 APK가 있습니다" — T243 은 정확히 이 문장을 안 보기 위한 장치다.

### 11.2 iOS — `CFBundleShortVersionString` / `CFBundleVersion`, 그리고 Android와의 동기화

**두 플랫폼의 버전 개념은 1:1로 대응한다.** 이름만 다르다.

| 역할 | Android | iOS | 실제로 값을 갖고 있는 곳 |
|---|---|---|---|
| 사람이 읽는 버전 | `versionName` | `CFBundleShortVersionString` | **`project.pbxproj` 의 `MARKETING_VERSION`** |
| 업로드마다 +1 하는 정수 | `versionCode` | `CFBundleVersion` | **`project.pbxproj` 의 `CURRENT_PROJECT_VERSION`** |
| 같은 값 재업로드 | 거부 | 거부 | — |
| 감소 | 불가 | 불가 | — |

> 🔴 **`Info.plist` 를 고쳐도 버전은 바뀌지 않는다.** 스캐폴드의 `Info.plist` 는
> `<string>$(MARKETING_VERSION)</string>` / `<string>$(CURRENT_PROJECT_VERSION)</string>` 처럼 **변수를 참조**하고 있고,
> 실제 값은 `project.pbxproj` 에 있다(§2.1 ⑨ 주석). 이걸 모르면 "분명히 올렸는데 업로드가 거부된다"에 갇힌다.
> 현재 스캐폴드 값은 `MARKETING_VERSION = 1.0`, `CURRENT_PROJECT_VERSION = 1` 이다.

**동기화 규칙 — 사람이 읽는 버전만 맞추고, 정수는 각자 간다**

| 항목 | 규칙 | 이유 |
|---|---|---|
| `versionName` = `MARKETING_VERSION` | ★ **항상 같은 값으로 손으로 맞춘다** | 같은 릴리스가 두 스토어에서 다른 이름을 가지면, 테스터 제보를 어느 빌드에 매칭할지 알 수 없게 된다 |
| `versionCode` ≠ `CURRENT_PROJECT_VERSION` | **일치시키려 애쓰지 않는다** | 두 스토어의 업로드 횟수는 어차피 달라진다. iOS는 CI 시행착오 때문에 훨씬 빨리 증가한다(§6.4.4). 억지로 맞추면 한쪽에서 "이미 사용된 번호" 에러가 난다 |

**7일 프로젝트 권장 매핑 (§11.1 표의 iOS 대응)**

| 단계 | `versionName` = `MARKETING_VERSION` | Android `versionCode` | iOS `CURRENT_PROJECT_VERSION` |
|---|---|---|---|
| Day 1~2 관통 리허설 | `0.0.1` | — (업로드 안 함) | CI 빌드 카운터 (1, 2, 3 …) |
| Day 6 릴리스 리허설 | `0.1.0` | 1 | 계속 증가 |
| Day 7 업로드 | `0.1.1` | 2 | 계속 증가 |
| 프로덕션 / App Store 출시 | `1.0.0` | 10 | 계속 증가 |

> **관통 리허설 빌드에 `0.0.1` 을 쓰는 이유:** 이건 게임이 아니라 **파이프라인 테스트 빌드**다.
> `0.1.0` 을 쓰면 나중에 RELEASES.md에서 "실제 게임 빌드"와 구분되지 않는다.
>
> ⚠ **`MARKETING_VERSION` 을 내리지 않는다.** 관통 리허설에서 `0.0.1` 을 올린 뒤 Day 6에 `0.1.0` 으로 가는 것은 증가이므로 문제없다.
> 반대로 가면 App Store Connect가 거부한다.

### 11.3 빌드마다 기록할 항목

`docs/RELEASES.md` 또는 노션/메모에 매 업로드마다 다음을 남긴다.

```markdown
## v0.1.1 — 2026-08-16 15:40
- git commit  : a1b2c3d          ← ★ 양 플랫폼 공통. 이게 두 빌드를 묶는 유일한 끈이다
- git tag     : v0.1.1

### Android
- 트랙        : 내부 테스트 (versionCode 2)
- AAB 크기    : 28.4 MB
- targetSdk   : 36 / minSdk 23
- 서명        : bloodsworn-upload (SHA-256: AB:CD:…)
- 실기기 확인 : Galaxy S21 (Android 14) OK / Pixel 6a OK

### iOS
- 트랙        : TestFlight 내부 테스트 (CFBundleVersion 17)
- IPA 크기    : 31.2 MB
- 배포 타겟   : iOS 14.0
- CI          : Codemagic 빌드 #17 / 소요 9분 / 잔여 무료분 약 380분
- 서명        : Apple Distribution (프로파일: BLOODSWORN AppStore)
- 실기기 확인 : iPhone 13 (iOS 18) OK — TestFlight 설치 후 1런 완주

- 변경 사항   :
  - 각성 연출 충격파 추가
  - HUNGER 드레인 하한 버그 수정
- 알려진 문제 : 20:9 Android 기기에서 대시 버튼이 세이프 인셋에 겹침
```

**필수 기록 항목 체크리스트**
- [ ] `versionName` (양 플랫폼 공통) / Android `versionCode` / iOS `CFBundleVersion`
- [ ] 업로드 트랙 (Play 내부·폐쇄·프로덕션 / TestFlight 내부·외부)
- [ ] git commit 해시 (**이게 없으면 "그때 그 빌드"를 재현할 수 없다**)
- [ ] AAB 크기 · IPA 크기
- [ ] targetSdk / minSdk / iOS 배포 타겟
- [ ] 서명 키 별칭 (Android) · 사용한 프로비저닝 프로파일 (iOS)
- [ ] **CI 빌드 번호 + 소요 시간 + 잔여 무료분** ← iOS 전용. **남은 시행착오 횟수가 곧 남은 안전마진**이다(§10.0)
- [ ] 변경 사항 (출시 노트에 그대로 복붙 가능하게)
- [ ] 실기기 확인 결과 (기종 + OS 버전) — **Android/iOS 각각**
- [ ] 알려진 문제 (어느 플랫폼인지 명시)

> **한 커밋에서 두 산출물이 나오므로 기록도 한 항목 아래에 묶는다.**
> Android와 iOS를 별도 파일로 관리하면 "이 iOS 빌드가 어느 Android 빌드와 같은 코드인가"를 잃어버린다.
> §10-E의 진단 순서(Android를 대조군으로 쓰는 것)가 그 정보에 의존한다.

---

## 12. 트러블슈팅

> **§12는 "게임이 기기에서 도는 동안"의 문제**다. 빌드가 TestFlight까지 가지 못하는 문제는 **§10**에 있다.
> A~G는 Android를 기준으로 쓰였지만 **대부분 iOS에도 그대로 적용된다**(같은 웹 코드가 같은 방식으로 돌기 때문).
> **iOS에만 존재하는 실패 모드는 §12-H에 따로 모았다.**

### A. 흰 화면 (가장 흔함)

| 증상 | 원인 | 해결 |
|---|---|---|
| `npm run preview` / 브라우저 미리보기에서 흰 화면, 콘솔에 `Failed to load resource: assets/index-xxx.js 404` | `base` 가 `'/'` (절대경로) | `vite.config.js` → `base: './'` (§4.2) |
| 앱에서 흰 화면, logcat에 `net::ERR_FILE_NOT_FOUND` | `cap sync` 를 안 했거나 `dist` 가 비어 있음 | `npm run build && npx cap sync android` 재실행 후 `android/app/src/main/assets/public/` 확인 |
| 앱에서 흰 화면, 콘솔 에러 없음 | React 렌더 실패 (import 에러) | `chrome://inspect` 로 실기기 DevTools 열어 콘솔 확인 |
| 빌드 자체가 실패 | `GameManager.js` 가 존재하지 않는 `AudienceRoomScene.js` import | 정본 `03-GDD-CORE.md` §2.1 경고 — 해당 import 및 `AUDIENCE_LAYOUT` 제거 |
| **iOS(TestFlight)에서만 흰 화면** | CI가 `cap sync ios` 를 건너뛰었거나 `dist/` 를 안 만듦 | **먼저 같은 커밋의 Android 빌드를 확인**해 문제를 iOS로 좁힌다(§10-E). 그다음 CI 로그에서 §6.4.2의 3·4단계 출력을 본다 |

**진단 순서 (3분 안에 원인 확정)**
```powershell
# 1. dist가 실제로 만들어졌나
Get-ChildItem dist\index.html, dist\assets | Select-Object -First 5 Name
# 2. dist/index.html 의 script src가 상대경로인가 → "./assets/..." 여야 함
Select-String -Path dist\index.html -Pattern 'src=|href='
# 3. 네이티브로 복사되었나
Get-ChildItem android\app\src\main\assets\public\index.html
# 4. 실기기 콘솔
adb logcat -c; adb logcat chromium:V *:S
```

### B. Gradle / JDK 버전 불일치

| 에러 메시지 | 원인 | 해결 |
|---|---|---|
| ★ `error: invalid source release: 21` — `:capacitor-android:compileDebugJavaWithJavac FAILED` | **JDK 17 이하로 빌드했다.** Capacitor 7 모듈이 소스 레벨 21 을 요구한다(`node_modules/@capacitor/android/capacitor/build.gradle`) | **JDK 21 로 전환** (§6.0). Android Studio 내장 JBR 이 17 인 것이 최다 원인이다 |
| `Android Gradle plugin requires Java 17 to run. You are currently using Java 11` | JDK 11 | JDK 21 설치 (§6.0) |
| `Unsupported class file major version 65/67/68` | Gradle 이 감당 못 하는 **상위** JDK. ⚠ **Gradle 8.11.1 + JDK 21 조합에서는 나지 않는다** — 이게 보이면 JDK 24 등을 잡은 것이다 | JDK 21 로 되돌린다 (§6.0) |
| `compileSdk 36 requires Android Gradle Plugin 8.x.x or higher` | AGP 버전 부족 | `android/build.gradle` 의 `com.android.tools.build:gradle` 버전 상향 |
| `SDK location not found` | `ANDROID_HOME` 미설정 | `android/local.properties` 에 `sdk.dir=C\:\\Users\\741u7\\AppData\\Local\\Android\\Sdk` |
| `Could not resolve all files… google()` | 오프라인/프록시 | 네트워크 확인. `--offline` 플래그 제거 |

```powershell
# Gradle이 실제로 어떤 JDK를 쓰는지 확인 (진실의 근원)
cd "C:\Users\741u7\OneDrive\바탕 화면\PJT20260810\FE\android"
.\gradlew -version
.\gradlew --stop      # 데몬 종료 후 재시작하면 JAVA_HOME 변경이 반영된다
```
> **JAVA_HOME을 바꿨는데 안 먹으면 `gradlew --stop` 을 잊은 것이다.** Gradle 데몬이 옛 JDK로 살아 있다.
> 대안: `android/gradle.properties` 에 `org.gradle.java.home=C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.12.8-hotspot` 명시.
> 🔴 **여기에 Android Studio 의 `jbr` 을 적지 마라.** Studio 2024.x 의 JBR 은 JDK 17 이라 `invalid source release: 21` 로 죽는다(§6.0).

### C. `cap sync` 후 에셋 누락

| 증상 | 원인 | 해결 |
|---|---|---|
| 이미지/사운드만 404 | 에셋이 `public/` 이 아니라 `src/` 에 있고 import 안 됨 | Phaser가 런타임에 `load.image('key','assets/x.png')` 로 부르는 파일은 **반드시 `FE/public/` 아래**에 둔다. `src/assets/` 는 import된 것만 번들에 들어간다 |
| 대문자/소문자 차이로 404 | Windows는 대소문자 무시, Android WebView는 구분 | 파일명을 전부 소문자 + 하이픈으로 통일 |
| `cap sync` 가 옛날 dist를 복사 | `npm run build` 를 안 함 | 항상 `npm run build && npx cap sync android` 를 한 세트로 |
| 한글 파일명 에셋이 안 열림 | URL 인코딩 문제 | **에셋 파일명에 한글·공백 금지** |
| `assets/public` 이 통째로 비어 있음 | `capacitor.config.json` 의 `webDir` 불일치 | `"webDir": "dist"` 확인 |

```powershell
# sync 결과를 항상 눈으로 확인하는 습관
npx cap sync android
Write-Host "--- 복사된 파일 수 ---"
(Get-ChildItem -Recurse "android\app\src\main\assets\public" -File).Count
Write-Host "--- dist 파일 수 ---"
(Get-ChildItem -Recurse "dist" -File).Count
# 두 숫자가 같아야 정상
```

### D. WebView에서 오디오 무음

**원인:** 모바일 WebView/브라우저는 **사용자 제스처 이전의 오디오 재생을 차단**한다.
Phaser의 `WebAudioSoundManager` 는 `AudioContext` 가 `suspended` 상태로 시작한다.

**해결 — 타이틀 화면의 첫 탭에서 명시적 resume**
```js
// 타이틀 "게임 시작" 버튼 핸들러 (React 또는 Phaser)
function unlockAudio(scene) {
    const sm = scene.sound;
    if (sm.locked) {
        sm.once('unlocked', () => scene.sound.play('bgm_ambient', { loop: true }));
    }
    if (sm.context && sm.context.state === 'suspended') {
        sm.context.resume();
    }
}
```
Phaser config에도:
```js
audio: { disableWebAudio: false },   // WebAudio 유지 (HTML5 Audio 폴백은 지연이 크다)
```
> **이 첫 터치 unlock 처리는 iOS에도 그대로 필요하다. 절대 삭제하지 말 것.**
> iOS WKWebView의 자동재생 제한은 Android WebView보다 오히려 엄격하다.
> **단, iOS에서 소리가 안 날 때 원인이 이것뿐이라고 가정하지 말 것** — §12-H의 무음 스위치가 먼저다.

| 추가 증상 | 원인 | 해결 |
|---|---|---|
| 앱을 백그라운드 → 복귀 시 무음 | `AudioContext` 가 suspended로 남음 | `document.visibilitychange` 에서 `context.resume()` |
| **iOS에서만 무음** | 🔴 **하드웨어 무음 스위치일 가능성이 가장 높다** | **코드를 보기 전에 §12-H를 먼저 읽을 것** |
| 특정 SFX만 무음 | 동시 재생 수 초과 / 파일 디코딩 실패 | OGG/MP3 두 포맷 제공 또는 mp3 통일 |
| BGM 첫 재생만 끊김 | 대용량 파일 디코딩 지연 | `PreloadScene` 에서 미리 `load.audio` (정본 §10) |

### E. 릴리스 빌드에서만 발생하는 문제

| 증상 | 원인 | 해결 |
|---|---|---|
| 디버그는 되는데 릴리스에서 흰 화면 | ProGuard/R8 난독화가 Capacitor 브릿지 클래스 제거 | **`minifyEnabled false` 유지 (§5.2 기본값).** 7일 스코프에서 minify로 얻는 수 MB보다 리스크가 크다 |
| minify를 꼭 켜야 한다면 | keep 규칙 누락 | `android/app/proguard-rules.pro` 에 아래 추가 |
| 릴리스에서 `console.log` 관련 크래시 | Vite가 제거하지 않음(기본은 남김) | 문제 없음. 신경 쓰이면 `build.minify: 'esbuild'` 기본값 유지 |
| 릴리스 APK가 설치 안 됨 (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`) | 이미 설치된 디버그 앱과 서명 충돌 | `adb uninstall com.bloodsworn.game` 후 재설치. `applicationIdSuffix ".debug"` 를 쓰면 애초에 안 겹침 |

```proguard
# FE/android/app/proguard-rules.pro — minify를 켤 경우 최소 keep 규칙
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class com.bloodsworn.game.** { *; }
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
-dontwarn com.getcapacitor.**
```

### F. 실기기에서 터치 이벤트 미작동

| 증상 | 원인 | 해결 |
|---|---|---|
| 조이스틱 드래그가 안 먹고 화면이 스크롤됨 | CSS `touch-action` 미설정 | `touch-action: none` (§3.3). **1순위 원인** |
| 첫 탭만 먹고 이후 무반응 | React 오버레이가 Phaser 캔버스를 덮음 | 오버레이에 `pointer-events: none`, 버튼에만 `pointer-events: auto` |
| 멀티터치(이동+대시 동시)가 안 됨 | Phaser 기본 포인터 수가 2 | `this.input.addPointer(2);` 로 포인터 확장 (총 3~4개) |
| 롱프레스 시 텍스트 선택/컨텍스트 메뉴 | 기본 브라우저 동작 | `-webkit-touch-callout:none; user-select:none` (§3.3) |
| 터치 좌표가 어긋남 | `Scale.FIT` 레터박스 오프셋을 직접 계산 | 좌표는 반드시 Phaser의 `pointer.worldX/worldY` 또는 `camera.getWorldPoint()` 로 얻는다. `event.clientX` 직접 사용 금지 |
| 화면 가장자리 터치가 시스템 제스처로 먹힘 | Android 제스처 내비게이션 | 조이스틱/대시 버튼을 **가장자리에서 최소 24dp 안쪽**에 배치. 정본 §3.3의 "히트박스 1.5배"와 함께 적용 |
| 대시 버튼이 작아서 안 눌림 | 히트박스 부족 | 정본 `03-GDD-CORE.md` §3.3 — **시각 크기의 1.5배** 히트박스 |

```js
// Phaser Scene create() 에서
this.input.addPointer(2);              // 멀티터치 지원 (기본 1 + 추가 2 = 3)
this.game.canvas.style.touchAction = 'none';
```

### G. 기타 자주 나오는 것

| 증상 | 해결 |
|---|---|
| `adb devices` 에 `unauthorized` | 폰의 USB 디버깅 허용 팝업 확인. 안 뜨면 `adb kill-server; adb start-server` |
| `adb` 명령이 없음 | `$env:Path += ";$env:LOCALAPPDATA\Android\Sdk\platform-tools"` |
| Play Console: "서명되지 않은 번들" | `key.properties` 경로 오타. `\` 를 `/` 로 (§5.2) |
| Play Console: "versionCode가 이미 사용됨" | `versionCode` +1 (§11.1) |
| Play Console: "targetSdkVersion이 요구 수준 미만" | `variables.gradle` 의 `targetSdkVersion` 상향 (§7.3) |
| 폰트가 안 나옴 (한글 깨짐) | 웹폰트를 `public/fonts/` 에 두고 `@font-face` 로 로드. 시스템 폰트 의존 금지 |
| 빌드가 매우 느림 | `android/gradle.properties` 에 `org.gradle.jvmargs=-Xmx4096m`, `org.gradle.parallel=true`, `org.gradle.caching=true` |
| App Store Connect 관련 에러 | §10-C |
| CI가 안 돌거나 서명이 실패 | §10-A / §10-B |

### H. ★ iOS 전용 실패 모드 (Android에는 존재하지 않는다)

> **이 절의 존재 이유:** 아래 두 가지는 **Android에서 아무리 테스트해도 절대 발견되지 않는다.**
> 그리고 둘 다 "버그처럼 보이지만 버그가 아니거나, 코드에서 원인을 찾을 수 없는" 종류라
> **모르면 존재하지 않는 버그를 몇 시간씩 쫓게 된다.**

#### H1. 🔴 소리가 안 난다 → **하드웨어 무음 스위치부터 확인한다**

| 사실 | 내용 |
|---|---|
| iOS 기본 오디오 세션 카테고리 | **`Ambient`** |
| `Ambient` 의 성질 | **하드웨어 무음 스위치를 존중한다** → 스위치가 켜져 있으면 **소리가 나지 않는다** |
| Android | **이 실패 모드가 없다.** 시스템 볼륨만 따른다 |
| 무음에서도 소리를 내려면 | 카테고리를 **`Playback`** 으로 바꿔야 한다 → **네이티브(`AppDelegate.swift`) 코드 수정 필요** |
| ⚠ 단서 | **WKWebView가 AVAudioSession 카테고리 설정을 무시한다는 WebKit 버그 보고가 존재한다.** 동작이 iOS 버전에 따라 다를 수 있다 |

**결정: 7일 스코프에서는 기본 동작(무음 스위치 존중)을 유지한다.**

**왜 고치지 않는가**
1. **게임에서는 존중이 오히려 올바른 동작이다.** 사용자가 무음으로 해 뒀는데 소리가 나는 앱은 그 자체로 불만 사유다.
2. 고치려면 네이티브 Swift 코드를 건드려야 하는데, **Mac이 없어 그 수정을 로컬에서 검증할 수 없다.**
   CI 왕복 1회 이상을 쓰고도 위 ⚠ 때문에 **먹는다는 보장이 없다.**
3. 즉 **비용과 리스크가 이득보다 크다.**

**대신 반드시 해야 할 일**
- ✅ **`13-QA-TEST-PLAN.md` 에 "iOS에서 소리가 안 나면 무음 스위치부터 확인" 항목을 넣는다.**
- ✅ 테스터에게 전달하는 안내문에도 한 줄 넣는다.
- ✅ 이 문서 §12-D의 "iOS에서만 무음" 행이 여기를 가리키게 한다 (이미 반영됨).

> **이 한 줄을 안 적어 두면, Day 7 오후에 "iOS 오디오가 깨졌다"고 판단하고 존재하지 않는 버그를 쫓게 된다.**
> 그 시간에 잃을 것은 오디오가 아니라 **업로드 마감**이다.

#### H2. 🔴 세이브가 사라진다 → `localStorage` 는 iOS에서 영구 저장이 아니다

| 사실 | 출처 |
|---|---|
| Capacitor 공식: `localStorage` 는 **transient**이며 "데이터가 결국 소실될 것을 앱이 전제해야 한다" | capacitorjs.com/docs/guides/storage |
| **저장공간이 부족하면 OS가 WebView의 로컬 저장소를 회수한다.** IndexedDB도 iOS에서 같은 위험 | 위 문서 |
| Capacitor 공식: "모바일 OS가 `window.localStorage` 의 데이터를 주기적으로 지울 수 있으므로 **이 API를 대신 사용하라**" → `@capacitor/preferences` | capacitorjs.com/docs/apis/preferences |
| `@capacitor/preferences` 는 iOS에서 `UserDefaults`, Android에서 `SharedPreferences` 를 쓴다 | 위 문서 |
| `UserDefaults` 는 앱 컨테이너의 plist에 저장되어 **WebKit 저장소 회수 대상이 아니고**, 백업에도 포함된다 | 위 문서 + Apple 백업 문서 |
| Safari ITP의 "7일 미사용 시 저장소 삭제"는 **Safari 사용일 기준**이며 WKWebView는 자체 카운터를 가져 앱 실행 시마다 리셋된다 → 정기 실행 앱에는 사실상 미적용 | webkit.org/blog/10218 등. ⚠ **Apple 미문서화. 신뢰도 중** |
| Preferences는 로컬 DB 용도가 아니다. 대량·고빈도·복잡쿼리면 SQLite 권장 — **수 KB JSON 세이브는 Preferences 적정 범위** | capacitorjs.com/docs/apis/preferences |

**결정: `@capacitor/preferences` 를 도입한다. 단 전면 교체가 아니라 write-through 방식.**

```
부팅   : Preferences에서 읽는다 → 없으면 localStorage에서 읽어 마이그레이션
저장   : localStorage에 동기 기록(핫 캐시) + Preferences에 write-through(비동기)
```

| 항목 | 내용 |
|---|---|
| 왜 전면 교체가 아닌가 | **Preferences API는 비동기**라 동기 `localStorage` 의 드롭인 대체가 아니다. 게임 루프 중 저장 지점을 전부 async로 바꾸는 것은 7일 스코프에서 위험하다 |
| 비용 | **약 30줄 + 플러그인 1개** |
| Android 영향 | 없다. `SharedPreferences` 로 동작하며 기존 동작을 해치지 않는다 |
| 플러그인 최소화 방침과의 충돌 | **이 하나만 예외로 인정한다** (§3.4). 근거는 위 표 — "안 쓰면 세이브가 사라질 수 있다"는 것은 취향 문제가 아니다 |
| 개인정보 처리방침 | **본문을 함께 고쳐야 한다.** 저장 위치가 하나 늘었기 때문 (§9.3) |

> ⚠ **`iosScheme` 을 첫 배포 후에 바꾸면 이 조치와 무관하게 세이브가 전량 유실된다.**
> `capacitor://localhost` 라는 **origin에 묶여 있기 때문**이다. §3.4의 경고와 짝이다.
>
> **관련 문서:** `06-TECH-DESIGN.md` §11.2/§12의 "`@capacitor/preferences` 미도입" 결정,
> 그리고 `16-RISKS-AND-SCOPE-CUTS.md` R16의 "Capacitor 플러그인을 아예 쓰지 않는다"는 리스크 소거 근거가
> **이 결정으로 바뀐다.** 두 문서에서 함께 갱신되어야 한다.

#### H3. 그 밖에 iOS에서만 확인해야 하는 것

| 항목 | 확인 내용 | 근거 |
|---|---|---|
| 홈 인디케이터 제스처 | 하단 가장자리 스와이프가 게임 입력을 먹지 않는가 | ⚠ 가로에서 하단 인셋 보고값은 **iOS 버전에 따라 다르다(확정값 없음)**. 기존 "하단 24 논리px" 규칙이 어느 경우든 충분히 보수적이므로 **그대로 유지**한다 |
| 상단 가장자리 터치 | ⚠ 최근 iOS에서 **가로 상단 가장자리에 `safe-area-inset-top` 이 0으로 보고되는 터치 데드존**이 보고되고 있다 | **상단 가장자리에 탭 대상을 두지 않는다.** 자세한 인셋 계약은 `10-UIUX-LANDSCAPE.md` §3.3 |
| 앱 전환 후 복귀 | 게임 상태·오디오·세이브가 유지되는가 | §12-D의 `visibilitychange` resume + 위 H2 |
| 좌우 세이프 인셋 | iOS는 **좌우 인셋을 대칭으로 보고**한다 (노치가 한쪽에만 있어도 양쪽 같은 값) | `10-UIUX-LANDSCAPE.md` §3.3 |
| 저전력 모드 | 프레임이 떨어지는가 | ⚠ 확인 필요(2026-08-10 기준 미확인). Day 7 이후 과제 |

---

## 13. Day 7 배포 타임라인 (Android + iOS)

### 13.0 순서 최적화의 원칙

> **"내가 통제할 수 없는 대기 시간"을 가장 먼저 시작한다.**
> 코드는 Day 7 새벽에도 고칠 수 있지만, Play Console 신원 확인과 12명×14일은 돈으로도 시간으로도 줄일 수 없다.

**iOS가 들어오면서 원칙이 하나 늘었다.**

> **"내가 로컬에서 재현할 수 없는 것"을 두 번째로 먼저 시작한다.**
> iOS는 대기가 문제가 아니라 **왕복 비용**이 문제다(§10.0). 1회 10분, 총 약 50회.
> **시행착오 예산은 Day 1에 가장 많고 Day 7에 0이다.** 그래서 §0.1의 관통 리허설을 Day 1~2로 앞당긴다.

| | 성격 | 대응 |
|---|---|---|
| Play 계정 승인 · 12명×14일 | **기다려야 하는 것** | 최대한 일찍 **시작**시킨다 |
| iOS 서명 · CI · 업로드 | **뚫어야 하는 것** | 시행착오 예산이 남아 있을 때 **끝낸다** |

**Day 1에 반드시 끝내야 하는 것 (코드보다 먼저)**

| # | 작업 | 이유 | 소요 |
|---|---|---|---|
| 1 | **Play Console 계정 생성 + $25 결제 + 신원 확인 제출** | 승인까지 수 시간~수일. **Android 일정의 최상위 병목** | 30분 + 대기 |
| 2 | 🔴 **`git init` + GitHub 원격 저장소 생성 + 최초 푸시** (§6.4.0) | **이게 없으면 iOS 경로 전체가 시작조차 되지 않는다.** 현재 프로젝트는 git 저장소가 아니다 | 30분 |
| 3 | **서명 키스토어 생성 + 3중 백업** (§5.4) | 잃으면 프로젝트 종료 (§5.0) | 20분 |
| 4 | 🔴 **iOS 서명 자산 4종 확보** (§5.5) | Mac 없이 openssl로 만든다. **iOS 실패의 최대 원인이 여기다** | 60분 |
| 5 | **Apple Developer Portal App ID 등록 + App Store Connect 앱 레코드 생성** (§7.5.5) | 빌드 업로드보다 **먼저 존재해야** 한다. 무료·선착순·영구 | 20분 |
| 6 | **앱 ID/이름 변경 전량 반영 — Android + iOS** (§2) | 업로드 후엔 **양쪽 다** 영구 변경 불가 | 40분 |
| 7 | **`Info.plist` 일괄 수정** — 가로 고정(§3.5) + `ITSAppUsesNonExemptEncryption`(§7.5.2) | 같은 파일이므로 한 번에 처리한다. 나중에 하면 반드시 하나를 빠뜨린다 | 15분 |
| 8 | **targetSdk 36으로 빌드 1회 통과** (§7.3) | 08-31 마감 회피 + AGP 문제 조기 발견 | 30분 |
| 9 | **가로 고정 + 전체화면 설정 반영 후 Android 실기기 1회 실행** (§3) | "화면이 세로로 나온다"를 Day 7에 발견하면 끝 | 40분 |
| 10 | ⚠ **연령 등급 응답 — Apple + Play 양쪽** (§7.5.4, §7.4) | **미응답이 TestFlight 업로드를 막는지 확인되지 않았다.** 확인하는 것보다 채우는 게 싸다. 답은 §7.5.4에 이미 있다 | 10분 |
| 11 | **개인정보 처리방침 GitHub Pages 배포** (§9) | 10분이면 끝나는데 Day 7엔 반드시 잊는다 | 15분 |
| 12 | **테스터 명단 작성 + 사전 요청** (Play 12명 / TestFlight 내부) | 폐쇄형 테스트 D-day를 앞당김. **TestFlight 내부 테스터는 ASC 사용자 등록이 선행**(§7.5.6) | 30분 |
| 13 | **이미지 생성 의뢰 1차** (`15-IMAGE-PROMPTS-FOR-CODEX.md`) | 아이콘은 Day 7 필수물. **iOS는 1024 무알파 후처리만 추가**(§8.5.1) | 30분 |

> **합계 약 6시간.** iOS 추가 전(8개 항목, 약 3시간 반)보다 **2시간 반 늘었다.** 숨기지 않고 적는다.
>
> ⚠ **`11-ROADMAP-7DAYS.md` §1의 D0는 같은 작업을 "약 5.2시간"으로 적는다. 모순이 아니다.**
> 두 목록의 범위가 다르다 — 로드맵의 D0는 **개발 시작 전에 끝내야 하는 것**만 세고,
> 이 표의 9(Android 실기기 확인)·13(이미지 의뢰) 같은 항목은 로드맵에서 **Day 1 블록 안**에 배치되어 있다.
> **일정을 짤 때는 로드맵 §1(약 5.2h)을 기준으로 삼고, 이 표는 "배포 관점에서 Day 1에 빠지면 안 되는 것"의 점검표로 쓴다.**
>
> **넘칠 때 미룰 수 있는 것 / 없는 것**
>
> | 미룰 수 있다 | 미룰 수 없다 |
> |---|---|
> | 12(테스터 명단) → Day 2 오전 | **2** — 미루면 iOS가 Day 1~2 관통 리허설을 시작할 수 없다 |
> | 13(이미지 의뢰) → Day 1 저녁 | **4·5** — 관통 리허설의 전제 조건 |
> | 9(Android 실기기 확인) → Day 2 | **1** — 대기 시간이 걸려 있다 |
> | | **10** — 10분짜리인데 막히면 Day 7 전체가 멈춘다 |
>
> **1·2·4·5·10을 Day 1에 못 끝내면 그날은 실패한 것이다.** 나머지는 조정 가능하다.

### 13.1 Day 1~6 사전 준비 체크포인트

| Day | 배포 관련 필수 작업 | 완료 판정 |
|---|---|---|
| **Day 1** | 위 13개 항목 | Play Console 앱 생성 + **App Store Connect 앱 레코드 생성**까지 완료 |
| **Day 1~2** | 🔴 **★ iOS 파이프라인 수직 관통 리허설** (§0.1, §6.4.5) | **§6.4.5의 7단계 판정표를 통과** — 빈 껍데기라도 TestFlight에서 설치되어 실행됨 |
| **Day 2** | Android 실기기 디버그 설치 루틴 확립 (`dev-device.ps1`) | 명령 1개로 폰에 설치됨 |
| **Day 3** | 스토어 문안 한/영 확정 (§8.3, §8.4) | Play Console에 붙여넣기만 하면 되는 상태 |
| **Day 4** | 아이콘·피처그래픽 1차 수령 → Android 런처 아이콘 교체(`mipmap-*`) + **iOS 1024 무알파 아이콘 배치**(§8.5.1) | 양 플랫폼 런처/홈 화면에 BLOODSWORN 아이콘이 뜸 |
| **Day 5** | Play 콘텐츠 등급 설문 + 데이터 보안 양식 제출 | 대시보드 과제 초록 체크 |
| **Day 6** | **Android 릴리스 AAB 1회 전 과정 리허설**(§6.2 + §6.3 bundletool 검증) | 서명된 AAB가 실기기에서 실행됨 |
| **Day 6** | **iOS 릴리스 태그 1회 리허설** — 실제 게임 코드로 CI 한 바퀴 | TestFlight에 새 빌드가 뜨고 설치됨 |
| Day 6 | firebase 잔재 확인 (`grep firebase FE/src` → 0건) | 데이터 보안 선언과 일치 |

> **Day 6의 "리허설"이 이 일정 전체에서 가장 중요한 항목이다.**
> Day 7에 처음 릴리스 빌드를 시도하면, §12의 문제 중 최소 2개는 반드시 만난다.
> **iOS는 그 리허설을 두 번 한다** — Day 1~2에 빈 껍데기로 한 번(툴체인 검증), Day 6에 실제 코드로 한 번(콘텐츠 검증).
> 두 번 하는 이유는 **실패했을 때 원인이 툴체인인지 게임인지 구분하기 위해서**다.
> Mac이 없어 관찰 수단이 CI 로그뿐이므로, 변수를 미리 분리해 두지 않으면 진단이 불가능하다.

#### 13.1.1 iOS 실기기 검증 경로 — 시뮬레이터를 포기한다

**결정: 시뮬레이터를 쓰지 않는다.**

| 이유 | 설명 |
|---|---|
| 애초에 못 쓴다 | **`.ipa` 는 시뮬레이터에서 실행되지 않는다.** 아키텍처가 아니라 **플랫폼**이 다르다 (`arm64-apple-ios` vs `-ios-simulator`). `npx cap build ios` 는 시뮬레이터 산출물을 만들 수 없다(export method에 없다) |
| 쓰려면 비용이 든다 | CI 산출물을 **하나 더** 만들어야 한다 = 빌드 분(minute) 추가 소모 |
| 정작 중요한 걸 못 본다 | **실제 저장소 회수 동작**(§12-H2)과 **실제 터치감·프레임**은 시뮬레이터로 검증할 수 없다 |

**대체 경로**

```
CI가 만든 .ipa
   ├─▶ AWS Device Farm (무료분)  → 크래시 · 부팅 · 세이브 유지 · 레이아웃 검증
   └─▶ TestFlight               → 사람이 실제로 가진 iPhone에서 플레이 (★ 최종 판정)
```

| 서비스 | 무료 | 최저 유료 | 용도 |
|---|---|---|---|
| **AWS Device Farm** ← 권장 | **최초 1,000 디바이스분** | **$0.17/분, 구독 없음** | 브라우저에서 실기기를 직접 조작 |
| TestMu AI (구 LambdaTest) | 있음(분량 미확인) | $39/월 | 대안 |
| BrowserStack App Live | 30분 | $150/월(5인 최소) | 무료분이 너무 적다 |
| Sauce Labs | 28일 | 실기기 $199/월 | ⚠ **"Live $39"는 가상기기 전용 — 함정** |

> ⚠ **AWS Device Farm은 us-west-2 기준이라 한국에서는 스트리밍 지연이 크다.**
> → **디바이스 팜은 크래시·부팅·세이브 유지·레이아웃 검증용으로만 쓰고, "손맛" 판정에는 쓰지 않는다.**
> 조작 감각·프레임 체감은 **반드시 TestFlight로 실제 iPhone에서** 본다.
>
> **개발자가 iPhone을 소유할 의무는 없다** (Apple 규정에 그런 조항이 없다 — 신뢰도 중, 부재 증명).
> iPhone이 없다면 위 두 경로 중 디바이스 팜만 남으며, **그 상태로 출고하는 것은 리스크다.**
> `16-RISKS-AND-SCOPE-CUTS.md` 에 "iOS 실기기 미검증 상태 출고" 리스크로 등록되어야 한다.
>
> **클라우드 Mac은 이번 주에 쓰지 않는다.** (Scaleway M1-M €0.11/hr·24시간 최소 → 세션당 약 €2.64 /
> AWS EC2 Mac $0.650/hr·24시간 최소 / MacinCloud $1/hr·25시간 선불 / MacStadium $109/월)
> **필요해지는 경우는 "CI 로그로도 도저히 원인을 못 찾을 때" 하나뿐**이며, 그 판단은 Day 3 이후에 한다.

### 13.2 Day 7 (2026-08-16) 시간표

**설계 원칙 — iOS를 먼저 쏘고, 기다리는 동안 Android를 한다.**

iOS는 업로드 후 **빌드 처리 대기**가 있고 그 시간을 통제할 수 없다(§10-D).
Android는 업로드 검토가 있지만 그동안 할 일이 없다. **따라서 iOS 태그를 오전에 먼저 푸시하고,
CI가 도는 동안 Android 작업을 진행한다.** 이렇게 하면 두 대기가 겹쳐진다.

```
┌─ 오전 ────────────────────────────────────────────────────────────┐
│                                                                    │
│ 09:00–09:30  코드 프리즈 (Feature Freeze)                          │
│              ▸ 이 시점 이후 신규 기능 추가 금지. 버그 수정만.       │
│              ▸ git commit + tag: v0.1.1-rc1                        │
│              ▸ 미완성 기능은 "구현"이 아니라 "숨김"으로 처리        │
│                                                                    │
│ 09:30–10:30  최종 QA (Android 실기기)                              │
│              ▸ 런 1회 완주 (6분) × 2회 — 크래시 없음 확인          │
│              ▸ 각성 최소 1회 발동 확인                              │
│              ▸ 결과 화면 → 재시작 3초 이내 (정본 Pillar 3)          │
│              ▸ 앱 종료 후 재실행 시 세이브 유지 확인                │
│              ▸ 소리 나옴 확인 (§12-D)                              │
│              ▸ 가로 고정 + 전체화면 확인                            │
│                                                                    │
│ 10:30–10:50  ★ iOS 릴리스 태그 푸시 → CI 시작  ← 오늘 가장 먼저 쏜다│
│              ▸ MARKETING_VERSION 0.1.1 확인 (§11.2)                │
│              ▸ git tag v0.1.1 && git push --tags                   │
│              ▸ CI 로그를 열어두고 다음 작업으로 넘어간다            │
│              ▸ ⚠ 여기서 실패하면 §10-A/B. Day 1~2에 관통했다면      │
│                실패 확률이 크게 낮다 — 그게 §0.1의 목적이다         │
│                                                                    │
│ 10:50–11:50  스크린샷 촬영 (§8.1의 8장 구성안, Android 기기)       │
│              ▸ adb로 1920×1080 캡처:                               │
│                adb exec-out screencap -p > shot1.png               │
│              ▸ 최소 3장(카드/각성/전투)은 반드시 확보               │
│              ▸ ⚠ 각성 순간 캡처가 어려우면 디버그 키로 강제 발동    │
│              ▸ iOS 스크린샷은 만들지 않는다 — 내부 TestFlight       │
│                에는 불필요하다 (§7.5.3)                             │
│                                                                    │
│ 11:50–12:20  Android 버전 확정 + 릴리스 빌드                       │
│              ▸ versionCode +1, versionName 0.1.1                   │
│              ▸ npm run build && npx cap sync android               │
│              ▸ .\gradlew bundleRelease                             │
│              ▸ jarsigner -verify 로 서명 확인                       │
│                                                                    │
├─ 점심 (12:20–13:00) — 빌드 돌려놓고 먹는다 ─────────────────────────┤
│                                                                    │
├─ 오후 ────────────────────────────────────────────────────────────┤
│                                                                    │
│ 13:00–13:40  ★ bundletool 로 AAB 실기기 검증 (§6.3)                │
│              ▸ 여기서 문제가 나오면 오후 전체가 흔들린다            │
│              ▸ 통과하면 이후는 사실상 사무 작업                     │
│                                                                    │
│ 13:40–14:40  ★ iOS — App Store Connect 확인 및 TestFlight 배포     │
│              ▸ CI 결과 확인. 실패했으면 §10의 A~C 순서로 진단       │
│              ▸ 빌드 처리 완료 확인 (§10-D)                         │
│              ▸ 수출 규정 응답 자동 통과 확인 (§7.5.2)              │
│              ▸ 내부 테스터 그룹에 빌드 할당                         │
│              ▸ 본인 기기 TestFlight에 설치 → 1런 완주               │
│              ▸ ✅ 여기까지 되면 iOS는 끝이다                        │
│              ▸ ⚠ 처리 대기가 길어지면 그대로 두고 아래로 내려간다.  │
│                기다리는 것 외에 할 수 있는 일이 없다 (§10-D)        │
│                                                                    │
│ 14:40–15:40  Play Console 스토어 등록정보 입력                     │
│              ▸ 앱 이름 / 짧은 설명 / 자세한 설명 (§8.3 복붙)        │
│              ▸ 아이콘 512×512, 피처그래픽 1024×500 업로드           │
│              ▸ 스크린샷 업로드 (최소 2, 목표 4~8)                   │
│              ▸ 개인정보 처리방침 URL 입력                           │
│              ▸ 연락처 이메일 / 카테고리(게임>액션)                  │
│                                                                    │
│ 15:40–16:20  Play Console 대시보드 잔여 과제 (§7.4의 [3])          │
│              ▸ Day 5에 안 끝냈다면 여기서 전부 처리                 │
│              ▸ 앱 액세스 / 광고 없음 / 콘텐츠 등급 / 타겟층          │
│                                                                    │
│ 16:20–17:00  ★ Play 내부 테스트 트랙 업로드                        │
│              ▸ 테스터 이메일 목록 생성 (본인 + 지인)                │
│              ▸ app-release.aab 업로드                              │
│              ▸ 출시명 "0.1.1 (2)", 출시 노트 작성                   │
│              ▸ 검토 후 출시 → 옵트인 링크 확보                      │
│              ▸ ⚠ 업로드 검토에 수 분~수 시간. 여유를 남겨야 함      │
│                                                                    │
│ 17:00–17:40  양 스토어 설치 확인                                   │
│              ▸ Play: 본인 계정으로 옵트인 → 실제 설치 확인          │
│              ▸ iOS: 13:40 슬롯이 대기로 끝났다면 여기서 마무리      │
│              ▸ 이게 성공해야 진짜 끝                                │
│                                                                    │
│ 17:40–18:30  마무리                                                │
│              ▸ 폐쇄형 테스트 트랙 생성 + 테스터 12명 초대 발송      │
│                (Day 8부터 14일 카운트가 시작되게)                   │
│              ▸ RELEASES.md 기록 — Android/iOS 양쪽 (§11.3)         │
│              ▸ 키스토어 + iOS 서명 자산 백업 최종 확인 (§5.4, §5.5.8)│
│              ▸ 남은 CI 무료분 기록                                  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

> **iOS 슬롯이 오전(10:30)과 오후(13:40) 두 곳으로 쪼개진 것이 이 시간표의 핵심이다.**
> 한 덩어리로 두면 "CI가 도는 10분"과 "빌드 처리 대기"에 사람이 묶인다.
> **쏘는 것과 확인하는 것을 분리하면 그 시간이 Android 작업으로 채워진다.**

### 13.3 무엇이 먼저 막히는가 (리스크 순위)

| 순위 | 리스크 | 발생 시점 | 영향 | 사전 방어 |
|---|---|---|---|---|
| **1** | **git 원격 저장소 부재 / OneDrive가 git을 방해** | Day 1 | 🔴 **iOS 경로 전면 불가** | Day 1 최우선(§6.4.0). `07` §6의 OneDrive 대응을 **필수로 격상** |
| **2** | Play Console 계정 신원 확인 미승인 | Day 1~7 내내 | **Play 배포 전면 불가** | Day 1 최우선 처리. 미승인 시 **iOS/TestFlight 단독으로 전환**(§7.2) |
| **3** | **iOS 서명 자산 확보 실패 / CI 서명 단계 반복 실패** | Day 1~2 | **iOS 배포 불가** | §5.5를 Day 1에. 실패 시 §10-A의 소거법. **CI 무료분 잔량을 매번 기록** |
| **4** | 릴리스 빌드에서만 흰 화면 / 크래시 | Day 7 11:50 | 오후 전체 소진 | **Day 6 리허설**(§13.1)로 하루 앞당겨 발견 |
| **5** | **iOS 빌드 처리 무한 대기 / 내부 TestFlight가 심사로 넘어감** | Day 7 13:40 | 당일 배포 확인 불가 | ⚠ Apple 문서 간 충돌(§7.5.1). **Day 1~2 관통으로 실제 소요를 미리 측정**해 둔다 |
| **6** | **연령 등급 미응답이 TestFlight 업로드를 막음** | Day 1~7 | iOS 배포 중단 | ⚠ 확인되지 않은 사안(§7.5.4). **Day 1에 10분 들여 채워 회피** |
| **7** | 아이콘/피처그래픽 미완성 | Day 7 14:40 | Play 등록정보 완성 불가 | **Day 4까지 수령**(문서 15). 임시 단색 아이콘이라도 준비 |
| **8** | **iOS 아이콘 알파 채널로 업로드 거부** | Day 7 13:40 | 재빌드 + 재업로드 | §8.5.1. **Day 4에 무알파 검증까지 끝낸다** |
| **9** | targetSdk 미달 반려 | Day 7 16:20 | 재빌드 + 재업로드 | Day 1에 36으로 빌드 통과시켜 둠 |
| **10** | 키스토어 비밀번호 분실 / iOS `.p8` 분실 | Day 7 11:50 | **치명적** | Day 1 비밀번호 관리자 등록 (§5.4, §5.5.8) |
| **11** | **CI 무료 빌드 분 소진** | Day 5~7 | iOS 재시도 불가 | 태그 트리거만 사용(§6.4.3). 잔량을 RELEASES.md에 기록(§11.3) |
| **12** | 가로 고정이 실기기에서 안 먹음 | Day 7 09:30 | QA 전체 재실행 | Day 1 Android 실기기 확인 + Day 1~2 iOS 관통에서 확인 |
| **13** | 개인정보 처리방침 URL 없음 | Day 7 14:40 | Play 등록정보 저장 불가 | Day 1 GitHub Pages 배포 |
| **14** | **iOS 실기기 없이 출고** | Day 7 | 검증되지 않은 빌드 배포 | §13.1.1. 디바이스 팜으로 최소 검증. `16-RISKS` 에 리스크로 등록 |
| **15** | AAB/IPA 용량 초과 / 로딩 지연 | Day 7 13:00 | UX 저하 | Day 5에 §4.4 크기 측정 |
| **16** | Play 내부 테스트 업로드 검토 지연 | Day 7 17:00 | 당일 설치 확인 불가 | 16:20까지 업로드 완료(마감 여유 2시간) |
| **17** | 스크린샷 규격 미달(640×360 원본 사용) | Day 7 14:40 | 재촬영 | 1920×1080 캡처 습관 |

> **1~3위가 전부 새로 생긴 리스크이거나 성격이 바뀐 리스크다.** iOS를 넣은 대가가 여기에 그대로 드러난다.
> 그리고 **1~3위는 전부 Day 1~2에 결판난다.** 그래서 §0.1이 이 문서의 첫 원칙이다.

### 13.4 Day 7 "최소 성공" 정의

> 다음 3개가 되면 **Day 7은 성공**이다. 나머지는 보너스다.
>
> 1. **서명된 AAB가 존재하고 Android 실기기에서 실행됨이 검증되었다.**
> 2. **Play Console 내부 테스트 트랙에 업로드가 완료되었다.**
> 3. **TestFlight 내부 테스트에 iOS 빌드가 배포되어 최소 1대의 기기에 설치되었다.**
>
> 정식 출시(Play 프로덕션 / App Store 공개)는 **양쪽 다 Day 7에 불가능**하다(§7.2). 이것을 실패로 정의하지 않는다.

**부분 성공의 정의 — 무엇이 남으면 그래도 성공인가**

| 상황 | 판정 | 근거 |
|---|---|---|
| 3번이 "TestFlight에 빌드가 떴으나 처리 대기 중" 에서 멈춤 | **성공으로 친다** | 처리 시간은 통제 불가능하다(§10-D). 업로드가 수락된 시점에 사람이 할 일은 끝났다 |
| 3번이 "IPA는 만들어졌으나 업로드 실패" | **부분 성공** | 서명이라는 최대 난관은 넘었다. 남은 것은 §10-C의 소거법이며 Day 8에 이어서 한다 |
| 3번이 "CI 서명 단계에서 실패" | **iOS 실패** | Day 1~2 관통 리허설을 안 했거나 실패한 상태로 왔다는 뜻이다 |
| 1·2번은 되고 3번이 전부 실패 | **Android 단독 출시로 전환** | 이번 주의 실질 목표는 달성된다. iOS는 후속 과제로 분리 |
| 3번은 되고 1·2번이 실패 (Play 계정 미승인 등) | **iOS 단독 출시로 전환** | Apple 계정은 이미 승인되어 있어 이 폴백이 실제로 성립한다(§7.2) |

> ⚠ **한 가지는 분명히 해 둔다.**
> 배포 경로가 2개(Play 내부 테스트 / TestFlight 내부 테스트)이므로 **보험 구조 자체는 유지된다.**
> 그러나 **두 경로 모두 계정·서명·심사 인프라에 의존한다.**
> **"심사도 계정도 없이 즉시 공개할 수 있는, 마찰 0의 최후 폴백"은 이번 배포 계획에 존재하지 않는다.**
> 이건 실제 리스크 증가이며, `16-RISKS-AND-SCOPE-CUTS.md` 에서 정면으로 다뤄야 한다.

---

## 14. 관련 문서

| 문서 | 내용 |
|---|---|
| `01-CONCEPT-AND-STORY.md` | 정본 — 컨셉·세계관·appId/appName 결정 근거 |
| `03-GDD-CORE.md` | 정본 — 화면 규격(640×360 / landscape), Scene 구성 |
| `04-PACT-SYSTEM.md` | 정본 — PACT/각성 (스토어 문안의 근거) |
| `15-IMAGE-PROMPTS-FOR-CODEX.md` | 아이콘·피처그래픽·스크린샷 오버레이 등 **배포 필수 이미지의 생성 프롬프트**. iOS 아이콘은 여기 산출물의 **후처리**로 만든다 (§8.5.1) |
| `11-ROADMAP-7DAYS.md` | 7일 일정 전체. **§0.1의 수직 관통 원칙과 §13.0의 Day 1 13개 항목이 여기에 반영되어야 한다** |
| `06-TECH-DESIGN.md` | Capacitor 통합 · 오디오 · 저장. **§12-H의 두 결정(무음 스위치 / `@capacitor/preferences`)이 여기에 반영되어야 한다** |
| `07-PROJECT-STRUCTURE-AND-CONVENTIONS.md` | 디렉토리 구조 · **Git 운영(§6.4.0의 원격 저장소 · OneDrive 대응)** · `.gitignore`(§5.2 ②) · npm 스크립트 |
| `10-UIUX-LANDSCAPE.md` | 세이프 인셋 계약. **iOS 가로 인셋(§12-H3)의 최종 수치는 이 문서가 정본** |
| `13-QA-TEST-PLAN.md` | 디바이스 매트릭스 · 릴리스 게이트. **§13.1.1의 iOS 검증 경로와 §12-H1의 무음 스위치 항목이 여기에 반영되어야 한다** |
| `16-RISKS-AND-SCOPE-CUTS.md` | 리스크 레지스터. **§13.3의 1~3·5·6·11·14번과 §13.4 말미의 "마찰 0 폴백 부재"가 여기에 등록되어야 한다** |
