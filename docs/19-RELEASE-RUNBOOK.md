# 19. 릴리스 실행 런북 — Day 7 배포

> **문서 지위: 실행 문서.** 설계를 설명하지 않는다. **위에서부터 그대로 따라 하면 배포가 끝난다.**
> 근거 문서: `14-BUILD-AND-DEPLOY.md`(왜 그렇게 하는가) / `13-QA-TEST-PLAN.md` §8(무엇을 통과해야 하는가)
> 대상 태스크: T701~T708 · T710~T716 · T720~T725 · T740 · T741 · T750~T753
> 최종 수정: 2026-08-11

---

## 0. 먼저 읽어라

### 0.1 Day 7 의 "출시"가 무엇인지

| 트랙 | Day 7 목표 | 심사 | 이번 주 가능? |
|---|---|---|---|
| **Play 내부 테스트** | AAB 업로드 + 테스터 설치 | 없음 | ✅ |
| **TestFlight 내부 테스트** | 빌드 처리 완료 + 내부 테스터 배포 | **없음** | ✅ |
| Play 프로덕션 | — | 있음 | ❌ **구조적으로 불가능** (테스터 12명 × 14일 + 심사 7일 = 21일+) |
| App Store 공개 | — | 있음 | ❌ 이번 주 범위 밖 |

> 🚨 **하나만 된다면 Android 다.** iOS 는 Apple 계정·서명·CI·빌드 처리에 의존하는 마찰이 높은 경로다.
> iOS 가 무너져도 Play 내부 테스트 업로드는 반드시 끝낸다.

### 0.2 🔴 코드에 이미 반영된 것 / 사람이 해야 하는 것

**이미 끝났다 (코드 커밋 상태로 존재):**

| 태스크 | 내용 | 파일 |
|---|---|---|
| T701 | appId `com.bloodsworn.game` / appName `BLOODSWORN` | `FE/capacitor.config.json` |
| T702 | `applicationId` · `namespace` · Java 패키지 디렉토리 이동 | `FE/android/app/build.gradle`, `.../java/com/bloodsworn/game/` |
| T703 | 앱 표시 이름 4개 문자열 | `FE/android/app/src/main/res/values/strings.xml` |
| T704 | `<title>` · package name | `FE/index.html`, `FE/package.json` |
| T705 | **가로 고정 + 전체화면 + 컷아웃** | `AndroidManifest.xml`, `styles.xml`, `colors.xml`, `MainActivity.java` |
| T706 | `base: './'` + phaser 청크 분리 | `FE/vite.config.js` |
| T707 | iOS 번들 식별자 (Debug/Release 2곳) | `FE/ios/App/App.xcodeproj/project.pbxproj` |
| T708 | iOS 가로 2종 + 전체화면 + **수출 규정 키** | `FE/ios/App/App/Info.plist` |
| T710·711·714·715 | 아이콘·적응형·피처그래픽·스플래시·iOS 무알파 아이콘 **28개 생성 완료** | `FE/tools/build-icons.mjs` |
| T243 | **Android `versionCode` 자동 증가** — 릴리스 태스크에서만 +1. 손으로 올리지 않는다 | `FE/android/app/build.gradle` `[T243]` 블록, `FE/android/version.properties` |
| T713 | 스토어 문안 | `docs/store/listing-ko.md`, `listing-en.md` |
| T724(문안) | 개인정보 처리방침 HTML | `privacy/index.html` |
| T750~753(정의) | iOS CI 2종 | `codemagic.yaml`, `.github/workflows/ios-testflight.yml` |

**사람이 해야 한다 (§13 에 순서대로 정리했다):** 키스토어 생성 · Apple 인증서 발급 ·
CI 시크릿 등록 · GitHub Pages 게시 · 스크린샷 촬영 · Play Console/ASC 입력.

### 0.3 ⚠ 시작 전에 결정해야 하는 것 하나 — 버전 번호

문서 간 값이 충돌한다. **첫 업로드 전에 정하고, 이후 바꾸지 마라.**

| | 안 A (현재 코드에 반영됨) | 안 B (`14` §11.1) |
|---|---|---|
| `versionName` / `MARKETING_VERSION` | **`1.0.0`** | `0.1.1` |
| `versionCode` | **`1`** | `2` |
| git 태그 | **`v1.0.0`** (`12` T741) | `v0.1.1` |
| 근거 | 백로그 T741 이 명시 | 내부테스트는 0.1.x, 프로덕션에서 1.0.0 |

> 🔴 **되돌릴 수 없는 방향이 하나뿐이다.** `versionCode` 도 `MARKETING_VERSION` 도 **낮출 수 없다.**
> 안 A 로 올리면 이후 0.x 를 쓸 수 없다(실무상 문제는 없다). 안 B 로 시작하면 나중에 1.0.0 으로 올릴 수 있다.
> ★ **T243 이후 `versionCode` 는 손으로 안 건드려도 된다.** 저장값 `1` 에서 첫 `bundleRelease` 를 돌리면
> 자동으로 `2` 가 된다(§6.2). 아래 표에서 정할 것은 사실상 `versionName` / `MARKETING_VERSION` 뿐이다.
> **안 B 를 고르려면 아래 파일 2곳만 고치면 된다:**
> ```
> FE/android/version.properties        versionCode=2 / versionName=0.1.1
> FE/ios/App/App.xcodeproj/project.pbxproj   MARKETING_VERSION = 0.1.1;  (2곳)
> ```
> 결정: ☐ 안 A(v1.0.0) ☐ 안 B(v0.1.1) ← **여기에 표시하고 진행하라.**

### 0.4 소요 시간

| 단계 | 시간 | 언제 |
|---|---|---|
| §1 사전 블로커 | 30분 | **Day 7 이전에 반드시** |
| §2 Android 키스토어 | 20분 | Day 7 이전 |
| §3 iOS 서명 자산 | **60~90분** | **Day 7 이전 — 여기가 최대 리스크 구간** |
| §4 CI 시크릿 | 20분 | Day 7 이전 |
| §5 처리방침 게시 | 15분 | Day 7 이전 가능 |
| §6~§9 Day 7 본작업 | 5시간 | Day 7 |
| §10 릴리스 게이트 | 1시간 | Day 7 |

> ★ **§1~§5 를 Day 7 당일에 하지 마라.** 전부 "Apple/Google 의 응답을 기다리는" 단계가 섞여 있어
> 하루가 그냥 날아갈 수 있다. Day 7 에는 §6 부터 시작할 수 있어야 한다.

---

## 1. 사전 블로커 — 지금 당장 (30분)

### 1.1 🔴 `.gitignore` 구멍 2개 메우기

openssl 이 만드는 `.csr` / `.pem` 이 루트 `.gitignore` 에 **빠져 있다.** §3 에서 이 파일들을 만들기
**전에** 막아야 한다. git 히스토리에 한 번 들어가면 이후 커밋으로 지워도 영원히 남는다.

```bash
cd "/c/Users/741u7/OneDrive/바탕 화면/PJT20260810"
cat >> .gitignore <<'GITEOF'

# openssl 로 CSR 을 만들면 .csr / .pem 확장자가 나온다.
# 위쪽 *.certSigningRequest 는 macOS Keychain 이 뽑는 확장자라 이걸 못 잡는다.
*.csr
*.pem
GITEOF
git check-ignore -v distribution.csr distribution.pem   # 두 줄 다 출력되면 성공
```

`FE/.gitignore` 는 vite 기본 템플릿 그대로다. 루트 규칙이 하위 전체에 적용되므로 **기능상 문제는 없지만**,
`FE/` 만 따로 떼어 쓸 가능성에 대비해 같은 블록을 넣어 두면 좋다(선택).

### 1.2 git 원격 저장소 — iOS CI 의 선행 블로커

원격이 없으면 **CI 가 아예 돌지 않는다.** 이미 있다면 건너뛴다.

```bash
cd "/c/Users/741u7/OneDrive/바탕 화면/PJT20260810"
git status                    # ⚠ 서명 파일이 한 줄도 보이지 않는지 눈으로 확인
git remote -v                 # origin 이 있으면 OK
# 없다면:
git remote add origin https://github.com/JH201421228/bloodsworn.git
git push -u origin main
```

> 🔴 **소스 저장소는 private 이어야 한다.** 개인정보 처리방침은 별도의 **public** 저장소에 올린다(§5).
> 한 저장소에 섞으면 둘 중 하나가 반드시 틀린 상태가 된다.

### 1.3 계정 상태 확인

- [ ] **Google Play Console** — 가입 + $25 결제 + 신원 확인 **승인 완료**. (승인에 수 시간~수일 걸린다)
- [ ] **Apple Developer Program** — 가입 완료 (확인됨).
      🔴 **Account Holder 가 최신 계약(Agreements)에 서명**되어 있는지 확인.
      App Store Connect → 계약/세금/금융 거래. **서명이 안 돼 있으면 빌드 업로드가 조용히 거부된다.**

### 1.4 Apple 연령 등급 문항 — 10분, 미루지 마라

App Store Connect → 앱 → 연령 등급. 2025년에 체계가 개편되어 **4+ / 9+ / 13+ / 16+ / 18+** 다(12+ · 17+ 폐지).

| 서술자 | 응답 |
|---|---|
| Cartoon or Fantasy Violence | **Frequent** |
| Realistic Violence | None |
| Horror-Fear Themes | Infrequent |
| Loot Boxes | **None** |
| 광고 / UGC / 웹 접근 | 전부 None |

→ 예상 등급 **13+**. 서바이버즈류는 정의상 전투가 빈번하므로 9+ 로 신고하면 축소 신고다.
**등급은 올릴 수는 있어도 내릴 수 없다. 애매하면 높게 잡는다.**

---

## 2. Android 업로드 키스토어 (20분, Day 7 이전)

> 🔴 **업로드 키를 분실하면 그 앱은 영원히 업데이트할 수 없다.** 생성 즉시 §2.3 백업까지 끝낸다.

### 2.1 생성 (PowerShell)

```powershell
# keytool 위치 확인
$keytool = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot\bin\keytool.exe"
if (-not (Test-Path $keytool)) { $keytool = (Get-Command keytool).Source }

# ⚠ 프로젝트 폴더 "밖"에 만든다 — git 혼입을 원천 차단한다
$keyDir = "$env:USERPROFILE\.android-keys\bloodsworn"
New-Item -ItemType Directory -Force $keyDir | Out-Null

& $keytool -genkeypair -v `
  -keystore "$keyDir\bloodsworn-upload.jks" `
  -storetype PKCS12 `
  -alias bloodsworn-upload `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -dname "CN=BLOODSWORN, OU=Solo, O=Bloodsworn, L=Seoul, S=Seoul, C=KR"
```
> `-validity 10000`(약 27년) 미만으로 잡지 마라. Play 는 키 만료 후 업데이트를 거부한다.
> 비밀번호를 물으면 **키스토어 암호와 키 암호를 같게** 둬도 된다. 반드시 비밀번호 관리자에 즉시 기록.

### 2.2 Gradle 에 연결

`FE/android/key.properties` 를 만든다. **이 파일은 `.gitignore` 가 이미 막고 있다.**

```properties
storeFile=C:/Users/741u7/.android-keys/bloodsworn/bloodsworn-upload.jks
storePassword=여기에_실제_비밀번호
keyAlias=bloodsworn-upload
keyPassword=여기에_실제_비밀번호
```

> ⚠ **경로 구분자는 `/` 또는 `\`.** Windows 경로를 `\` 하나로 쓰면 Java Properties 가
> 이스케이프로 먹어 `C:UsersXXX` 가 되고, 에러 메시지는 "파일 없음"만 나온다.

확인:
```powershell
cd "C:\Users\741u7\OneDrive\바탕 화면\PJT20260810"
git status --short FE/android/key.properties   # 아무것도 안 나와야 정상
```

### 2.3 백업 — 지금 바로, 4곳

1. 로컬 `%USERPROFILE%\.android-keys\bloodsworn\`
2. 클라우드 (암호화 압축)
3. USB 등 오프라인 매체
4. **비밀번호 관리자에 store/key 암호 + alias 기록**

```powershell
$keyDir = "$env:USERPROFILE\.android-keys\bloodsworn"
& "C:\Program Files\7-Zip\7z.exe" a -t7z -mhe=on -p `
  "$env:USERPROFILE\OneDrive\_keys\bloodsworn-key-backup-$(Get-Date -f yyyyMMdd).7z" "$keyDir\*"
```

---

## 3. 🔴 iOS 서명 자산 — Mac 없이 만들기 (60~90분, Day 7 이전)

> **이 프로젝트의 최대 리스크 구간이다.** 여기서 막히면 iOS 는 이번 주에 못 나간다.
> Day 7 당일에 시작하지 마라. 실패해도 Android 는 나갈 수 있도록 §2 를 먼저 끝내 둔다.

### 3.0 왜 별도 절차인가

일반적인 iOS 서명 문서는 전부 macOS 의 **Keychain Access** 로 CSR 을 만든다. Mac 이 없으므로
**openssl 로 같은 일을 한다.** Apple 포털은 CSR 의 출처를 따지지 않으므로 이 경로가 성립한다.

만들어야 하는 것 4가지:

| # | 산출물 | 용도 | 만드는 곳 |
|---|---|---|---|
| 1 | `distribution.p12` | 배포 인증서 + 개인키 | 내 PC (openssl) + Apple 발급 |
| 2 | `.p12` 암호 | 1과 세트 | 내가 정한다 |
| 3 | `bloodsworn.mobileprovision` | 프로비저닝 프로파일 | Apple 포털 |
| 4 | `AuthKey_XXXX.p8` + Issuer ID + Key ID | **업로드 인증** | App Store Connect |

> 🔴 **4번이 없으면 서명이 되어도 업로드 자체가 불가능하다.** Apple ID + 비밀번호는 2FA 때문에
> CI 에서 비대화식으로 쓸 수 없다. **ASC API 키가 2FA 를 우회하는 유일한 방법이다.**

### 3.1 App ID 등록 (Apple Developer Portal)

```
developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → [+]
  → App IDs → App
  Description : BLOODSWORN
  Bundle ID   : Explicit →  com.bloodsworn.game     ← ★ 정확히 이 값
  Capabilities: 아무것도 켜지 않는다 (푸시·게임센터·인앱결제 전부 없음)
  → Continue → Register
```
> 🔴 **한 번 등록한 App ID 는 이름 변경도 재사용도 불가능하다.** 오타를 확인하고 누른다.

### 3.2 개인키 + CSR 생성 (Git Bash)

```bash
# ⚠ 프로젝트 폴더 "밖"에 만든다
mkdir -p ~/.apple-keys/bloodsworn && cd ~/.apple-keys/bloodsworn

# ① 개인키 — 이것만 잃어도 인증서를 처음부터 다시 만들어야 한다
openssl genrsa -out distribution.key 2048

# ② CSR — 이 파일을 Apple 포털에 올린다
openssl req -new -key distribution.key -out distribution.csr \
  -subj "/emailAddress=741u741@gmail.com/CN=BLOODSWORN Distribution/C=KR"

ls -la    # distribution.key / distribution.csr 두 개가 보이면 성공
```

### 3.3 배포 인증서 발급

```
developer.apple.com → Certificates → [+]
  → Software 섹션의 "Apple Distribution" 선택   ← ⚠ "Apple Development" 가 아니다
  → Continue
  → Choose File 로 위에서 만든 distribution.csr 업로드
  → Continue → Download  →  distribution.cer 를 ~/.apple-keys/bloodsworn/ 에 저장
```

### 3.4 `.cer` → `.p12` (CI 가 먹는 형식)

```bash
cd ~/.apple-keys/bloodsworn

# ③ DER(.cer) → PEM
openssl x509 -inform der -in distribution.cer -out distribution.pem

# ④ 인증서 + 개인키 → .p12
#    🔴 반드시 암호를 건다. 암호 없는 .p12 는 유출 즉시 그대로 쓸 수 있는 서명 수단이다.
openssl pkcs12 -export -inkey distribution.key -in distribution.pem -out distribution.p12
#    → Enter Export Password: 를 물으면 강한 암호를 넣고 비밀번호 관리자에 기록

# 검증 — 인증서 정보가 출력되면 성공
openssl pkcs12 -in distribution.p12 -nokeys -info -passin pass:'여기에_암호' 2>/dev/null | head -20
```

> ⚠ openssl 3.x 에서 `.p12` 를 만들면 옛 도구가 못 읽는 알고리즘이 기본값일 수 있다.
> `xcodebuild`/`security` 가 "MAC verification failed" 를 뱉으면 `-legacy` 를 붙여 다시 만든다:
> ```bash
> openssl pkcs12 -export -legacy -inkey distribution.key -in distribution.pem -out distribution.p12
> ```

### 3.5 프로비저닝 프로파일

```
developer.apple.com → Profiles → [+]
  → Distribution 섹션의 "App Store Connect" 선택
  → App ID: com.bloodsworn.game 선택
  → Certificate: §3.3 에서 만든 Apple Distribution 인증서 선택
  → Provisioning Profile Name:  BLOODSWORN AppStore     ← 이름을 기록해 둔다
  → Generate → Download  →  ~/.apple-keys/bloodsworn/bloodsworn.mobileprovision
```
> ⚠ **인증서를 재발급하면 이 프로파일도 무효가 된다.** 순서를 거꾸로 하지 마라.

### 3.6 App Store Connect API 키 (`.p8`)

```
appstoreconnect.apple.com → Users and Access → Integrations 탭
  → App Store Connect API → Team Keys → [+]
  Name   : BLOODSWORN CI
  Access : App Manager        ← Developer 로는 TestFlight 업로드가 막힐 수 있다
  → Generate
  → "Download API Key" 를 눌러 AuthKey_XXXXXXXXXX.p8 저장
  → 같은 화면의 Issuer ID (UUID 형태) 와 Key ID (10자) 를 함께 기록
```
> 🔴 **`.p8` 은 단 한 번만 내려받을 수 있다.** 다시 받을 수 없고, 잃으면 폐기 후 재발급이다.
> 받는 즉시 §3.8 백업을 한다.

### 3.7 base64 인코딩 (CI 시크릿용)

```bash
cd ~/.apple-keys/bloodsworn
base64 -w0 distribution.p12          > p12.b64
base64 -w0 bloodsworn.mobileprovision > profile.b64
base64 -w0 AuthKey_XXXXXXXXXX.p8     > p8.b64
wc -c *.b64        # 세 파일 모두 0 이 아니어야 한다
```
> 🔴 **이 값들을 터미널에 `cat` 하지 마라.** 스크롤 버퍼·로그에 그대로 남는다.
> 클립보드로만 옮긴다: `clip.exe < p12.b64` (Git Bash on Windows)
> 🔴 **CI 에 시크릿을 echo 하는 스텝을 만들지 마라.** base64 를 조각내 출력하면 자동 마스킹을 빠져나간다.

### 3.8 백업 + 커밋 금지 확인

```bash
cd "/c/Users/741u7/OneDrive/바탕 화면/PJT20260810"
git status --porcelain | grep -Ei '\.(key|csr|cer|pem|p12|p8|mobileprovision)$' && echo "🔴 서명 파일이 노출됐다" || echo "OK — 서명 파일 없음"
git log --all --name-only --pretty=format: | grep -Ei '\.(p12|p8|mobileprovision|jks|keystore)$' | sort -u
# 두 번째 명령이 아무것도 출력하지 않아야 한다. 나오면 그 인증서/키는 폐기(revoke)하고 다시 만든다.
```

체크리스트:
- [ ] App ID `com.bloodsworn.game` 등록됨
- [ ] `distribution.p12` + 암호 (비밀번호 관리자에 기록)
- [ ] `bloodsworn.mobileprovision` + 프로파일 이름 기록
- [ ] `AuthKey_*.p8` + Issuer ID + Key ID
- [ ] 위 4종 **2곳 이상**에 백업 (키스토어와 동일 강도)
- [ ] `git status` / `git log` 에 서명 파일 0건

---

## 4. CI 시크릿 등록 (20분)

### 4.1 필요한 시크릿 전량

| 시크릿 이름 | 값 | 어디서 얻는가 |
|---|---|---|
| `IOS_DIST_P12_BASE64` | `p12.b64` 의 내용 | §3.7 |
| `IOS_DIST_P12_PASSWORD` | `.p12` 에 건 암호 | §3.4 에서 내가 정한 값 |
| `IOS_PROVISION_PROFILE_BASE64` | `profile.b64` 의 내용 | §3.7 |
| `APP_STORE_CONNECT_PRIVATE_KEY` | `p8.b64` 의 내용 | §3.7 |
| `APP_STORE_CONNECT_KEY_IDENTIFIER` | Key ID (10자) | §3.6 화면 |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID (UUID) | §3.6 화면 |

> ⚠ **이름이 `14` §5.5.6 의 예시(`ASC_KEY_P8_BASE64` 등)와 다르다.**
> Codemagic 은 `APP_STORE_CONNECT_*` 3종을 **자동으로 인식**해 `publishing.app_store_connect` 에
> 연결한다. 다른 이름을 쓰면 값을 손으로 옮기는 스텝을 하나 더 만들어야 한다 — 실패 지점만 늘어난다.
> GitHub Actions 워크플로는 `ASC_KEY_P8_BASE64` / `ASC_KEY_ID` / `ASC_ISSUER_ID` 이름을 쓴다(§4.3).

### 4.2 Codemagic (주 경로)

```
codemagic.io → 로그인(GitHub 계정) → Add application → GitHub 저장소 선택
  → "codemagic.yaml" 방식 선택 (UI 설정 방식 아님)

  Teams/App settings → Environment variables
    Group name 을 정확히  apple_signing  으로 만들고 아래를 넣는다:
      IOS_DIST_P12_BASE64              [Secure ✅]
      IOS_DIST_P12_PASSWORD            [Secure ✅]
      IOS_PROVISION_PROFILE_BASE64     [Secure ✅]
      APP_STORE_CONNECT_PRIVATE_KEY    [Secure ✅]
      APP_STORE_CONNECT_KEY_IDENTIFIER [Secure ✅]
      APP_STORE_CONNECT_ISSUER_ID      [Secure ✅]
```
> 🔴 **Secure 체크를 빠뜨리면 값이 빌드 로그에 평문으로 찍힌다.** 6개 전부 확인.
> 그룹 이름 `apple_signing` 은 `codemagic.yaml` 의 `environment.groups` 와 문자 단위로 일치해야 한다.

### 4.3 GitHub Actions (예비 경로)

```
GitHub 저장소 → Settings → Secrets and variables → Actions → New repository secret
  IOS_DIST_P12_BASE64
  IOS_DIST_P12_PASSWORD
  IOS_PROVISION_PROFILE_BASE64
  ASC_KEY_P8_BASE64          ← .p8 의 base64
  ASC_KEY_ID
  ASC_ISSUER_ID
```

### 4.4 관통 리허설 — 실제 릴리스 전에 한 번 돌린다

```bash
git tag v0.0.1-ci-test && git push origin v0.0.1-ci-test
```
판정 7단계. **여기서 멈춘 곳이 Day 7 에도 멈출 곳이다.**

1. 태그 push 로 빌드가 트리거된다
2. `pod install` 성공
3. `xcodebuild archive` 가 **서명까지** 통과
4. `.ipa` 아티팩트가 생성된다
5. App Store Connect 가 업로드를 수락한다
6. TestFlight 에 빌드가 "테스트 가능"으로 뜬다
7. 내부 테스터 기기에 설치·실행된다

> 실패 시 §12 의 증상별 색인으로 간다. **로그를 반드시 아티팩트에서 내려받아 읽는다** —
> Mac 이 없으므로 로그가 유일한 진단 근거다.

---

## 5. 개인정보 처리방침 게시 (15분)

> Play 는 **필수**다. 내부 TestFlight 에는 불필요하지만, 외부 TestFlight·App Store 제출에 필요하므로 지금 만든다.
> 🔴 등록한 URL 이 나중에 404 가 되면 **앱이 정지될 수 있다.**

### 5.1 별도의 public 저장소를 만든다

```bash
# GitHub 웹에서 새 저장소 생성:  bloodsworn-privacy   (Public, README 없이 빈 저장소)

cd /c/Users/741u7/Documents            # 소스 저장소 밖 아무 곳
git clone https://github.com/JH201421228/bloodsworn-privacy.git
cd bloodsworn-privacy
cp "/c/Users/741u7/OneDrive/바탕 화면/PJT20260810/privacy/index.html" .
git add index.html
git commit -m "docs: 개인정보 처리방침 게시"
git push
```

> 🔴 **소스 저장소(private)와 반드시 분리한다.** 처리방침은 public 이어야 하고 소스는 private 여야 한다.
> 한 저장소에 섞으면 둘 중 하나가 반드시 틀린 상태가 된다.

### 5.2 GitHub Pages 켜기

```
저장소 → Settings → Pages
  Source : Deploy from a branch
  Branch : main  /  (root)     → Save
```
1~2분 뒤 게시된다. **URL:**
```
https://jh201421228.github.io/bloodsworn-privacy/
```
> ⚠ GitHub Pages 의 호스트명은 **전부 소문자**다. 사용자명이 대문자를 포함해도 URL 은 소문자다.

### 5.3 게시 확인 — 반드시 한다

- [ ] 시크릿 창(로그인 안 된 상태)에서 URL 이 열린다
- [ ] 한국어/영어 두 절이 다 보인다
- [ ] `bloodsworn.save.v1` 과 `@capacitor/preferences` 언급이 있다
      (본문이 `localStorage` 만 말하면 **실제 동작과 어긋난다** — 이게 반려 최다 원인이다)

### 5.4 내용이 사실인지 마지막 확인

```bash
cd "/c/Users/741u7/OneDrive/바탕 화면/PJT20260810/FE"
# ① 네트워크 호출 0건이어야 한다
grep -rn "fetch(\|XMLHttpRequest\|WebSocket\|sendBeacon\|axios" src/ ; echo "위에 아무것도 없으면 OK"
# ② 분석/광고 SDK 0건
grep -rni "firebase\|analytics\|gtag\|admob\|sentry" src/ package.json ; echo "위에 아무것도 없으면 OK"
```
> 🔴 하나라도 나오면 처리방침·데이터 보안 양식·스토어 설명이 **동시에 허위 기재**가 된다.
> (2026-08-11 검증 시점 기준 두 명령 모두 0건이었다.)

---

# ═══ 여기서부터 Day 7 당일 ═══

## 6. Android 릴리스 빌드 (60분)

### 6.0 🔴 먼저 — JDK 21 인지 확인한다 (30초, 건너뛰면 §6.3 에서 죽는다)

```powershell
java -version    # "21.0.x" 여야 한다
$env:JAVA_HOME
```
21 이 아니면 이렇게 잡는다.

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot"
$env:PATH      = "$env:JAVA_HOME\bin;$env:PATH"
```

> **왜 21 인가** — Capacitor 7 의 `:capacitor-android` 모듈이 소스 레벨 21 로 컴파일된다.
> JDK 17 로 돌리면 `error: invalid source release: 21` 로 즉시 실패한다.
> ⚠ **Android Studio 내장 JBR 은 17 이라 쓰면 안 된다.** 근거와 전체 표는 `14-BUILD-AND-DEPLOY.md` §6.0.
> ⚠ `JAVA_HOME` 을 바꾸고도 같은 에러가 나면 `.\gradlew --stop` 으로 데몬을 죽인다.

### 6.1 코드 프리즈 + 아이콘 재생성

```powershell
cd "C:\Users\741u7\OneDrive\바탕 화면\PJT20260810\FE"
npm run build:icons        # store/_raw/ 원본에서 33개 산출물 재생성 + 규격 자동 검증
```
> 이 스크립트는 실패해야 할 때 실패한다 — iOS 아이콘에 알파가 남거나, Play 아이콘이
> 32비트가 아니거나 1MB 를 넘으면 **예외를 던지고 멈춘다.** 조용히 잘못된 파일을 만들지 않는다.

### 6.2 버전 확인 — `versionCode` 는 **손대지 않는다** (T243)

`FE/android/version.properties` 를 연다. **`versionName` 이 §0.3 에서 정한 값인지만** 확인한다.

```properties
versionCode=1          # ← 손대지 마라. bundleRelease 가 자동으로 +1 한다
versionName=1.0.0      # ← 이것만 확인. iOS MARKETING_VERSION 과 같아야 한다
```

**`versionCode` 는 §6.3 의 `bundleRelease` 가 알아서 올린다.** `app/build.gradle` 의 `[T243]` 블록이
릴리스 태스크에서만 이 파일을 +1 하고 되쓴다. 빌드 로그에 이렇게 찍힌다:

```
[T243] versionCode 1 -> 2 (릴리스 태스크 자동 증가) — version.properties 가 갱신됐다. ★ 이 변경을 커밋하라.
```

- [ ] **AAB 를 Play 에 올린 뒤 `version.properties` 를 커밋한다** (§10.3 최종 커밋에 포함).
      커밋을 빠뜨리면 다음 빌드가 같은 값에서 다시 시작해 "이미 사용된 버전 코드" 로 돌아온다.
- 같은 번호로 빌드를 재현해야 하면 `.\gradlew bundleRelease -PskipVersionBump`.
- `assembleDebug` 는 이 값을 건드리지 않는다. 개발 중 빌드로 번호가 튀는 일은 없다.
- 상세 규칙(주입·하한 보정)은 `14-BUILD-AND-DEPLOY.md` §11.1.

> ⚠ 자동 증가는 **`bundleRelease` / `assembleRelease` 계열 태스크 이름**에만 반응한다.
> `gradlew build` 로는 올라가지 않는다. 업로드용 산출물은 반드시 §6.3 의 명령으로 만든다.

### 6.3 릴리스 AAB 생성

```powershell
cd "C:\Users\741u7\OneDrive\바탕 화면\PJT20260810\FE"

# ① 클린 — 패키지명이 바뀐 뒤 첫 빌드라면 필수다. 안 하면 옛 패키지 잔재로 이상한 에러가 난다
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Set-Location android; .\gradlew clean; Set-Location ..

# ② 웹 빌드
npm run build
Get-ChildItem dist | Select-Object Name, Length      # index.html 이 루트에 있어야 한다

# ③ 네이티브 동기화
npx cap sync android

# ④ 동기화 검증 — 이 폴더가 비어 있으면 흰 화면 앱이 나온다
Get-ChildItem android\app\src\main\assets\public | Select-Object Name

# ⑤ AAB 빌드
Set-Location android
.\gradlew bundleRelease

# ⑥ 결과
$aab = "app\build\outputs\bundle\release\app-release.aab"
Get-Item $aab | Select-Object FullName, @{n='MB';e={"{0:N2}" -f ($_.Length/1MB)}}, LastWriteTime
```

### 6.4 서명 확인 — 디버그 키로 서명된 걸 올리는 사고를 막는다

```powershell
& "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot\bin\jarsigner.exe" -verify -verbose -certs `
  "app\build\outputs\bundle\release\app-release.aab" | Select-String -Pattern "jar verified|CN="
```
- [ ] `jar verified.` 가 출력된다
- [ ] `CN=BLOODSWORN` 이 보인다 (`CN=Android Debug` 이면 **디버그 키다. 절대 올리지 마라**)

### 6.5 매니페스트 병합 결과 확인 (T740 항목)

```powershell
# 최종 병합된 매니페스트에 예상치 못한 권한이 끼어들지 않았는지 본다
Select-String -Path "app\build\intermediates\merged_manifests\release\*\AndroidManifest.xml" `
  -Pattern "uses-permission" 
```
- [ ] `android.permission.INTERNET` **하나뿐**이다
- [ ] 🔴 `com.google.android.gms.permission.AD_ID` 가 **없다**
      (있으면 광고 ID 권한이 자동 추가된 것 → 데이터 보안 신고와 모순된다)
- [ ] `android:screenOrientation="landscape"` 가 살아 있다

### 6.6 bundletool 로 실기기 검증 (T721) — 건너뛰지 마라

**릴리스 빌드에서만 나는 버그가 있다.** AAB 를 그대로 설치할 수는 없으므로 APK 로 변환한다.

```powershell
# bundletool 준비 (1회) — github.com/google/bundletool/releases 에서 bundletool-all-*.jar 다운로드
$tools = "$env:USERPROFILE\tools"; New-Item -ItemType Directory -Force $tools | Out-Null
$bt = "$tools\bundletool.jar"

cd "C:\Users\741u7\OneDrive\바탕 화면\PJT20260810\FE\android"
$aab    = "app\build\outputs\bundle\release\app-release.aab"
$keyDir = "$env:USERPROFILE\.android-keys\bloodsworn"

# 연결된 기기 전용 APK 세트 생성
java -jar $bt build-apks `
  --bundle="$aab" --output="build\bloodsworn.apks" --overwrite `
  --connected-device --local-testing `
  --ks="$keyDir\bloodsworn-upload.jks" --ks-key-alias=bloodsworn-upload

# 설치 (⚠ --local-testing 으로 만든 세트는 반드시 install-apks 로 설치해야 한다)
java -jar $bt install-apks --apks="build\bloodsworn.apks"

# 실행
adb shell am start -n com.bloodsworn.game/com.bloodsworn.game.MainActivity

# 스토어 표시 용량 추정
java -jar $bt get-size total --apks="build\bloodsworn.apks"
```

**설치 후 실기기에서 확인 (5분):**
- [ ] 세로로 들고 실행해도 **가로로 뜬다**
- [ ] 상태바·내비게이션 바가 보이지 않는다 (전체화면)
- [ ] 흰 화면이 아니다 (흰 화면이면 §12-A)
- [ ] 소리가 난다
- [ ] 런 1회 완주 → 결과 화면 → 재시작
- [ ] 앱 종료 후 재실행 시 진행도 유지

---

## 7. iOS — CI 실행 → TestFlight (T750~T753)

> ⏱ **오전에 가장 먼저 쏜다.** 빌드 + 처리 대기 동안 §6·§8 을 병행한다.
> 이 순서가 Day 7 일정의 핵심이다 — 순서를 바꾸면 대기 시간이 그대로 손실이 된다.

### 7.1 버전 맞추기

`FE/ios/App/App.xcodeproj/project.pbxproj` 에서 `MARKETING_VERSION` **2곳**이
`version.properties` 의 `versionName` 과 같은지 확인한다.

```powershell
Select-String -Path "FE\ios\App\App.xcodeproj\project.pbxproj" `
  -Pattern "MARKETING_VERSION|PRODUCT_BUNDLE_IDENTIFIER"
```
- [ ] `MARKETING_VERSION = 1.0.0;` × 2 (Debug/Release)
- [ ] `PRODUCT_BUNDLE_IDENTIFIER = com.bloodsworn.game;` × 2

> `CURRENT_PROJECT_VERSION` 은 손대지 않는다 — CI 가 빌드마다 덮어쓴다.
> **`versionCode` 와 `CURRENT_PROJECT_VERSION` 을 억지로 일치시키지 마라.** 한쪽에서 "이미 사용된 번호" 에러가 난다.

### 7.2 태그를 쏜다

```bash
cd "/c/Users/741u7/OneDrive/바탕 화면/PJT20260810"
git add -A
git commit -m "chore(build): v1.0.0 릴리스 빌드 설정"
git tag v1.0.0
git push origin main --tags
```
> ⚠ 태그를 다시 쏴야 하면 **새 태그를 만든다**(`v1.0.0-rc2`). 같은 태그를 지웠다 다시 밀면
> CI 가 안 돌거나 빌드 번호가 꼬인다.

### 7.3 CI 로그를 열어두고 다음 작업으로 간다

`codemagic.io` → 해당 앱 → 빌드 진행 상황. **정상이면 8~12분.**
25분을 넘기면 뭔가 잘못된 것이다(§12).

**스텝별로 확인할 것:**

| 스텝 | 성공 신호 |
|---|---|
| 웹 빌드 + iOS 동기화 | `dist/index.html` 존재 체크 통과 |
| CocoaPods 설치 | `Pod installation complete` |
| 서명 자산 설치 | `xcode-project use-profiles` 가 프로파일을 찾았다는 출력 |
| 빌드 번호 결정 | `agvtool` 이 새 번호를 출력 |
| archive + export | `.ipa` 경로가 출력 |
| publishing | App Store Connect 업로드 성공 |

### 7.4 빌드 번호에 대한 주의

`CFBundleVersion` 은 같은 `CFBundleShortVersionString` 안에서 **유일**해야 한다.
Codemagic 은 `$BUILD_NUMBER`, GitHub Actions 는 `github.run_number` 를 쓴다.

> 🔴 **두 CI 를 번갈아 쓰면 카운터가 어긋나 "이미 사용된 빌드 번호" 로 업로드가 거부된다.**
> 예비 경로로 넘어갈 때는 App Store Connect 에서 마지막 빌드 번호를 확인하고,
> 워크플로의 `agvtool new-version -all` 인자에 **그보다 큰 수**를 직접 넣어라.

### 7.5 App Store Connect 앱 레코드 (최초 1회, CI 전에 해두면 좋다)

```
appstoreconnect.apple.com → 나의 앱 → [+] → 신규 앱
  Platforms        : iOS
  App Name         : BLOODSWORN: 피의 서약     ← Play 와 통일
  Primary Language : 한국어
  Bundle ID        : com.bloodsworn.game       ← §3.1 에서 등록한 App ID 가 목록에 떠야 한다
  SKU              : bloodsworn-001            ← 내부 식별자. 공개되지 않지만 변경 불가
  User Access      : Full Access
```
> ⚠ Bundle ID 가 목록에 없으면 §3.1 이 안 끝난 것이다. 몇 분 뒤 새로고침해도 없으면 다시 등록.

### 7.6 빌드 처리 확인 + 수출 규정

```
App Store Connect → 앱 → TestFlight 탭
```
1. 빌드가 **"처리 중(Processing)"** 으로 나타난다 — 수 분~수십 분. 즉시일 때도 있다.
2. 처리 완료 후 상태가 **"테스트 가능"** 이 된다.
3. **수출 규정 질문이 뜨지 않아야 정상이다.**
   `Info.plist` 의 `ITSAppUsesNonExemptEncryption = false` 가 자동 응답한다.

> 🔴 **"Missing Compliance" 가 뜬다면** 그 빌드의 `Info.plist` 에 키가 안 들어간 것이다.
> 한 번은 웹에서 손으로 답해 넘길 수 있지만, 근본 해결은 키를 넣고 재빌드하는 것이다.
> (이번 프로젝트는 이미 넣어뒀다 — 뜨면 `cap sync` 가 plist 를 덮었는지 확인한다.)

### 7.7 내부 테스터 배포 (T753)

```
TestFlight 탭 → 내부 테스트 → 그룹 [+]
  그룹 이름 : Internal
  테스터 추가: App Store Connect 사용자 중에서 선택
  → 빌드 할당
```
> 🔴 **아무 지인이나 안 된다.** 내부 테스터는 **App Store Connect 사용자**(Account Holder /
> Admin / App Manager / Developer / Marketing)여야 한다. 최대 100명, 1인당 30대.
> 🔴 **테스터에게 보상을 주지 마라** (가이드라인 2.2 위반).

**실기기 확인:**
- [ ] TestFlight 앱에서 BLOODSWORN 이 보인다
- [ ] 설치 → 기동 → **가로로 뜬다**
- [ ] 노치/Dynamic Island 가 캔버스를 침범하지 않는다
- [ ] 레터박스 색이 `#0b0710` 이다
- [ ] **무음 스위치를 끄면 소리가 난다** (스위치 켠 상태에서 무음인 것은 정상이다 — 여기서 시간 쓰지 마라)
- [ ] 홈 인디케이터와 대시 버튼이 겹치지 않는다
- [ ] 런 1회 완주

> ★ **업로드만으로는 "출시"가 아니다.** 내부 테스터 기기에 실제로 설치·기동되어야 T753 이 끝난다.

---

## 8. Play Console 등록 (T722~T725, 100분)

### 8.1 앱 만들기

```
play.google.com/console → 앱 만들기
  앱 이름       : BLOODSWORN: 피의 서약
  기본 언어     : 한국어 (대한민국) — ko-KR
  앱 또는 게임  : 게임
  무료 또는 유료: 무료          ← 🔴 유료로 만들면 나중에 무료로 바꿀 수 없다
  선언          : 개발자 프로그램 정책 / 미국 수출법 동의
```

### 8.2 대시보드 과제 (순서 무관, 전부 완료해야 출시 가능)

| 과제 | 답 |
|---|---|
| 앱 액세스 권한 | **모든 기능을 제한 없이 사용 가능** (로그인 없음) |
| 광고 | **광고 포함 안 함** |
| 콘텐츠 등급 (IARC) | 이메일 입력 → 카테고리 **게임** → 설문. 폭력: **판타지 폭력 있음 / 유혈 표현 있음** 을 **정직하게** 신고 |
| 타겟층 및 콘텐츠 | **13세 이상** (유혈·다크 판타지) |
| 뉴스 앱 | 아니오 |
| 데이터 보안 | §8.3 |
| 정부 앱 | 아니오 |
| 금융 기능 | 없음 |
| 스토어 등록정보 | §8.4 |

> 예상 등급: **GRAC 12+~15+ / ESRB Teen / PEGI 12**.
> 🔴 **축소 신고는 삭제·정지 사유다.** 13+ 는 상업적으로 손해가 없다.

### 8.3 데이터 보안 양식 — 반려 최다 원인 구간

```
데이터 수집 및 공유
  이 앱이 필수 사용자 데이터 유형을 수집하거나 공유하나요?   →  아니요
    → 이후 데이터 유형 문항 전체가 사라진다

보안 관행
  데이터가 전송 중에 암호화되나요?        →  해당 없음 (전송하는 데이터가 없다)
  사용자가 데이터 삭제를 요청할 수 있나요? →  해당 없음

개인정보처리방침 URL
  https://jh201421228.github.io/bloodsworn-privacy/
```

> 🔴 **양식 응답과 처리방침 본문이 어긋나면 반려된다.** 위 응답의 근거:
> 게임 진행도(`bloodsworn.save.v1`)는 **기기 밖으로 나가지 않으므로 "수집"이 아니다.**
> Play 의 "수집" 정의는 *개발자의 서버로 전송되는 것*이다. 로컬 저장은 해당하지 않는다.
> §5.4 의 grep 두 개가 0건이었음을 확인한 상태여야 한다.

### 8.4 스토어 등록정보

`docs/store/listing-ko.md` 를 열어 그대로 복사한다.

| 칸 | 파일의 어느 부분 | 값 |
|---|---|---|
| 앱 이름 | `## 앱 이름` | `BLOODSWORN: 피의 서약` |
| 간단한 설명 | `## 짧은 설명` | 47자 |
| 자세한 설명 | `## 자세한 설명` | 934자 |
| 앱 아이콘 | — | `store/play/icon-512.png` |
| 그래픽 이미지 | — | `store/play/feature-1024x500.png` |
| 휴대전화 스크린샷 | — | `store/play/shot-1..6*.png` (가로 이미지도 이 칸이다) |
| 카테고리 | — | 게임 > 액션 |
| 태그 | — | 로그라이크 / 액션 / 픽셀 그래픽 |
| 이메일 | — | 741u741@gmail.com |

> ⚠ 스크린샷은 **최소 2장**이 없으면 저장이 안 된다. 촬영은 `docs/store/screenshot-plan.md`.

### 8.5 내부 테스트 트랙 업로드 (T725)

```
테스트 → 내부 테스트 → 테스터 탭
  → 이메일 목록 만들기 (본인 Google 계정 포함)  → 저장

  → 릴리스 탭 → 새 릴리스 만들기
     App Bundle : app-release.aab 업로드
     릴리스 이름 : 1.0.0 (1)
     출시 노트   : 첫 내부 테스트 빌드입니다.
  → 다음 → 저장 → 검토 → 내부 테스트로 출시 시작
```
검토는 보통 수 분~수 시간.

### 8.6 옵트인 링크로 설치 확인

```
내부 테스트 → 테스터 탭 하단의 "테스터 URL 복사"
  → 테스터 계정으로 링크 접속 → "테스터 되기" → Play 스토어에서 설치
```
- [ ] 링크로 실제 설치된다
- [ ] 설치된 앱이 가로로 뜨고 1런이 완주된다

### 8.7 오늘 같이 해두면 좋은 것 — 폐쇄형 테스트 초대

프로덕션까지 가려면 **테스터 12명 × 14일 연속 옵트인**이 필요하다. **Day 8부터 카운트가 시작되게**
오늘 초대를 발송해 둔다. 하루 늦으면 프로덕션이 하루 늦는다.

```
테스트 → 폐쇄형 테스트 → 트랙 만들기 → 테스터 12명 이상 이메일 등록 → AAB 업로드 → 출시
```

---

## 9. 릴리스 게이트 체크리스트 (T740)

> 정본은 `13-QA-TEST-PLAN.md` §8 이다. 아래는 **배포 관련 항목만** 뽑은 실행용 축약본이다.
> ⛔ = 하나라도 실패하면 출시 보류 / ⚠️ = 기록 후 진행 가능.

### 9.1 공통

- [ ] ⛔ `appId` = `com.bloodsworn.game` (Android `applicationId` = iOS bundle ID)
- [ ] ⛔ `appName` = `BLOODSWORN`
- [ ] ⛔ 개발 빌드 흔적 제거 — `window.BS` 치트, 디버그 오버레이, `console.log` 가 프로덕션에서 비활성
- [ ] ⛔ 소스맵이 번들에 없다 (`vite.config.js` 의 `sourcemap: false` — 확인됨)
- [ ] ⚠️ `.env` / API 키가 번들에 없다
- [ ] ⚠️ 미사용 의존성 없음 (firebase / axios / react-query)

### 9.2 Android

- [ ] ⛔ `versionCode` / `versionName` 확인 (§0.3 에서 정한 값)
- [ ] ⛔ 키스토어 백업 **2곳 이상**
- [ ] ⛔ 릴리스 서명된 AAB (`jarsigner -verify` 에 `CN=BLOODSWORN`)
- [ ] ⛔ 서명된 빌드를 실기기에 설치해 **1런 완주** (§6.6)
- [ ] ⛔ 권한 목록에 `INTERNET` 하나뿐, `AD_ID` 없음 (§6.5)
- [ ] ⛔ `android:screenOrientation="landscape"` + `layoutInDisplayCutoutMode="shortEdges"`
- [ ] ⛔ 16:9 / 19.5:9 / 20:9 에서 UI 잘림 0건
- [ ] ⛔ 가로 고정 — 세로로 들고 실행/회전해도 가로 유지
- [ ] ⛔ 하단 제스처 바와 버튼 충돌 없음

### 9.3 iOS

- [ ] ⛔ `Info.plist` 에 `ITSAppUsesNonExemptEncryption = false`
- [ ] ⛔ `UISupportedInterfaceOrientations` = landscape 2종만 (iPhone·iPad 양쪽)
- [ ] ⛔ `MARKETING_VERSION` = Android `versionName` 과 동일
- [ ] ⛔ 최소 배포 타겟 14.0 — pbxproj 와 `ios/App/Podfile` **양쪽**
- [ ] ⛔ **릴리스 설정에 `server.url` 이 없다** — 원격 URL 로딩이 가이드라인 4.2.2 "web clipping" 패턴이다
- [ ] ⛔ 서명 자산 4종이 **CI 시크릿으로만** 존재
- [ ] ⛔ `.key`/`.p12`/`.p8`/`.mobileprovision` 이 저장소에 없다 (`git log` 까지 확인 — §3.8)
- [ ] ⛔ `.ipa` 업로드 + **빌드 처리 완료**
- [ ] ⛔ 컷아웃이 레터박스 안에만 있고 캔버스 미침범
- [ ] ⛔ 레터박스 색 `#0b0710`
- [ ] ⚠️ 무음 스위치 OFF 에서 소리가 난다

### 9.4 스토어

- [ ] ⛔ Play: 아이콘 512(32bit) / 피처 1024×500 / 스크린샷 ≥2장 / 짧은설명 / 자세한설명
- [ ] ⛔ Play: 콘텐츠 등급 · 타겟 연령 13+ · 데이터 보안 · 처리방침 URL
- [ ] ⛔ ASC: 앱 레코드 · 처리 완료된 서명 빌드 · 수출 규정 · 내부 테스터 그룹
- [ ] ⛔ ASC: 아이콘 1024×1024 **알파 없음** (`build:icons` 가 자동 검증)
- [ ] ⛔ **연령 등급 문항 응답** (§1.4)

### 9.5 최종

- [ ] ⛔ `BUGS.md` 에 S1 = 0건, S2 ≤ 2건
- [ ] ⛔ **제출할 바로 그 AAB 로** 1런 완주
- [ ] ⛔ 키스토어 백업 2곳 · iOS 서명 자산 백업 2곳
- [ ] ⛔ **TestFlight 내부 테스터에게 실제 배포되어 설치·기동 확인**
- [ ] ⛔ 크레딧 화면에 전 에셋 저작자·라이선스 표기

---

## 10. 마무리 — 최종 커밋 / 태그 / README (T741, 30분)

### 10.1 릴리스 기록

`docs/RELEASES.md` 를 만들고(없다면) 아래 양식으로 추가한다. **양 플랫폼을 묶는 유일한 끈은 git commit 해시다.**

```markdown
## v1.0.0 — 2026-08-16
- git commit : <해시>
- git tag    : v1.0.0

### Android
- 트랙     : 내부 테스트 (versionCode 1)
- AAB 크기 : __ MB
- 옵트인 링크: <URL>

### iOS
- 트랙          : TestFlight 내부 테스트
- CFBundleVersion: <CI 빌드 번호>
- 처리 완료     : __:__
- 설치 확인 기기: <기기명>

### 남은 CI 무료분
- Codemagic: ___ / 500분
```

### 10.2 README

루트에 `README.md` 가 없다. 만든다면 **실행 방법 10줄**이면 충분하다 — 아키텍처 설명은 `docs/06` 이 한다.

```markdown
# BLOODSWORN / 피의 서약
가로형 모바일 로그라이트 서바이버즈. Phaser 3 + React 19 + Vite 7 + Capacitor 7.

## 개발
    cd FE && npm install && npm run dev

## 배포
    docs/19-RELEASE-RUNBOOK.md 를 따른다.

문서: docs/README.md
```

### 10.3 최종 커밋

```bash
cd "/c/Users/741u7/OneDrive/바탕 화면/PJT20260810"
git status --porcelain | grep -Ei '\.(key|csr|cer|pem|p12|p8|mobileprovision|jks|keystore)$' \
  && echo "🔴 중단 — 서명 파일이 스테이징에 있다" || echo "OK"
git add -A
git commit -m "chore(build): v1.0.0 내부 테스트 배포"
git push origin main --tags
```

---

## 11. 사용자가 직접 해야 하는 작업 — 순서대로

> 코드로 끝낼 수 없는 것만 모았다. **위에서부터 순서대로** 한다. 앞이 안 끝나면 뒤가 막힌다.

### Day 7 이전 (약 3시간)

| # | 작업 | 절 | 예상 | 막히면 |
|---|---|---|---|---|
| 1 | `.gitignore` 에 `*.csr` `*.pem` 추가 | §1.1 | 2분 | — |
| 2 | git 원격 저장소 확인/생성 + push | §1.2 | 10분 | **iOS CI 자체가 불가능** |
| 3 | Play Console 계정 승인 확인 | §1.3 | — | 승인에 수일 |
| 4 | Apple 계약(Agreements) 서명 확인 | §1.3 | 5분 | **업로드가 조용히 거부됨** |
| 5 | Apple 연령 등급 문항 응답 | §1.4 | 10분 | Day 7 에 막힘 |
| 6 | **Android 키스토어 생성 + `key.properties` + 백업** | §2 | 20분 | 서명 빌드 불가 |
| 7 | **Apple App ID 등록** | §3.1 | 5분 | 이후 전부 막힘 |
| 8 | **openssl 로 개인키 + CSR 생성** | §3.2 | 5분 | — |
| 9 | **배포 인증서 발급 → `.p12` 조립** | §3.3~3.4 | 20분 | 서명 불가 |
| 10 | **프로비저닝 프로파일 발급** | §3.5 | 10분 | 서명 불가 |
| 11 | **ASC API 키 `.p8` 발급 + Issuer/Key ID 기록** | §3.6 | 10분 | **업로드 불가** |
| 12 | base64 인코딩 + 백업 + 커밋 여부 확인 | §3.7~3.8 | 15분 | — |
| 13 | **Codemagic 계정 + `apple_signing` 시크릿 6개** | §4.2 | 20분 | CI 불가 |
| 14 | **관통 리허설 태그 push → 7단계 판정** | §4.4 | 30분+ | 여기서 멈춘 곳이 Day 7 에도 멈춘다 |
| 15 | `bloodsworn-privacy` public 저장소 + Pages 게시 | §5 | 15분 | Play 등록 불가 |
| 16 | App Store Connect 앱 레코드 생성 | §7.5 | 10분 | 업로드 불가 |
| 17 | bundletool.jar 다운로드 | §6.6 | 5분 | 실기기 검증 불가 |

### Day 7 당일

| # | 작업 | 절 | 시각 |
|---|---|---|---|
| 18 | 코드 프리즈 + 최종 QA | §9 | 09:00 |
| 19 | 버전 확정 → **태그 push → iOS CI 발사** | §7.1~7.2 | 10:30 ★ **가장 먼저** |
| 20 | 스크린샷 6장 촬영 + 후처리 | `docs/store/screenshot-plan.md` | 10:50 |
| 21 | `npm run build:icons` → 릴리스 AAB 빌드 + 서명 확인 | §6 | 11:50 |
| 22 | bundletool 로 실기기 검증 | §6.6 | 13:00 |
| 23 | **TestFlight 처리 확인 → 내부 테스터 배포 → 실기기 설치** | §7.6~7.7 | 13:40 |
| 24 | Play Console 등록정보 + 대시보드 과제 | §8.1~8.4 | 14:40 |
| 25 | **Play 내부 테스트 트랙 AAB 업로드 + 테스터 초대** | §8.5~8.6 | 16:20 |
| 26 | 폐쇄형 테스트 12명 초대 발송 (Day 8 카운트 시작) | §8.7 | 17:40 |
| 27 | 릴리스 게이트 체크리스트 전항목 | §9 | 17:00 |
| 28 | RELEASES.md 기록 · 최종 커밋 · 백업 확인 | §10 | 18:00 |

---

## 12. 트러블슈팅 — 증상별 색인

| 증상 | 원인 1순위 | 확인/조치 |
|---|---|---|
| **A. 흰 화면** | `base` 가 `'/'` 로 바뀜 / `cap sync` 누락 | `dist/index.html` 의 스크립트 경로가 `./assets/...` 인지. `android/app/src/main/assets/public/` 이 비었는지 |
| **B. 세로로 뜬다** | 태블릿(≥600dp) + targetSdk 36 | Android 16 은 대화면에서 방향 제한을 무시한다. 매니페스트의 `PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY` 가 살아 있는지. **폰에서는 정상이어야 한다** |
| **C. 아이콘이 흰 배경** | `ic_launcher_background.xml` | `#0B0710` 인지 확인. 템플릿 기본값은 `#FFFFFF` 였다 |
| **D. `pod install` 실패** | Podfile.lock 미커밋 / repo 캐시 | CI 로그에서 `--repo-update` 가 돌았는지 |
| **E. `xcodebuild archive` 서명 실패** | `.p12` 와 프로파일이 짝이 아님 | 인증서를 재발급했다면 **프로파일도 다시 만들어야 한다**(§3.5) |
| **F. "MAC verification failed"** | openssl 3.x 기본 알고리즘 | `.p12` 를 `-legacy` 로 다시 만든다(§3.4) |
| **G. 업로드 거부: 잘못된 아이콘** | iOS 아이콘에 알파 | `npm run build:icons` 가 검증한다. 통과했는데도 나면 `cap sync` 가 xcassets 를 덮었는지 확인 |
| **H. "Missing Compliance"** | `ITSAppUsesNonExemptEncryption` 누락 | 해당 빌드의 plist 확인. 웹에서 1회 수동 응답 후 재빌드 |
| **I. "이미 사용된 빌드 번호"** | 두 CI 카운터 불일치 | §7.4 |
| **J. Play "버전 코드가 이미 사용됨"** | T243 자동 증가분을 **커밋하지 않아** 값이 되돌아갔다 | `FE/android/version.properties` 를 확인 → `bundleRelease` 재실행이면 자동으로 +1 된다(§6.2). 급하면 그 파일의 숫자를 직접 올려도 된다 |
| **K. 소리가 안 남 (iOS)** | 하드웨어 무음 스위치 | **스위치 ON 에서 무음은 정상이다.** 여기서 시간 쓰지 마라 |
| **L. 세이브가 사라짐 (iOS)** | `localStorage` 가 OS 에 의해 비워짐 | `@capacitor/preferences` write-through 가 동작하는지 (`FE/src/save/save.js`) |

> 상세는 `14-BUILD-AND-DEPLOY.md` §10(iOS) / §12(공통).

---

## 13. 관련 문서

| 문서 | 언제 보나 |
|---|---|
| `14-BUILD-AND-DEPLOY.md` | **왜** 그렇게 하는지, 근거와 출처가 필요할 때 |
| `13-QA-TEST-PLAN.md` §8 | 릴리스 게이트 정본 |
| `docs/store/listing-ko.md` | 스토어 문안 복사 |
| `docs/store/screenshot-plan.md` | 스크린샷 촬영 |
| `FE/tools/build-icons.mjs` | 아이콘 규격이 왜 그런지 |
| `codemagic.yaml` | iOS CI 주 경로 |
| `.github/workflows/ios-testflight.yml` | iOS CI 예비 경로 |
| `privacy/index.html` | 처리방침 원본 |
