# 스토어 스크린샷 촬영 계획 (T712)

> 규격 근거: `14-BUILD-AND-DEPLOY.md` §8.1 / `13-QA-TEST-PLAN.md` §8.7
> **Day 7 오전 50분 작업.** 이 문서를 열어놓고 순서대로 찍는다.

---

## 0. 결론부터

| | Google Play | App Store |
|---|---|---|
| **Day 7 필요 여부** | 🔴 **필수 (최소 2장)** | ⚪ **불필요** — 내부 TestFlight 은 스크린샷을 요구하지 않는다 |
| 규격 | 가로, 최소 변 320px / 최대 변 3840px | (정식 제출 시) 6.9″ 가로 **2868×1320** |
| 목표 | **6장** | Day 7 이후 |

> ★ **오늘 iOS 스크린샷을 만들지 마라.** 규격이 1픽셀만 틀려도 거부되는 작업이고,
>   내부 TestFlight 배포에는 아예 필요가 없다. 이번 주 경로 밖이다.

---

## 1. 해상도 — 왜 1920×1080 인가

논리 해상도가 **640×360** 이다. 스토어 캡처는 **정확히 3배인 1920×1080** 으로 찍는다.

- 3의 정수배라 픽셀아트가 보간 없이 딱 떨어진다. 1080p 기기에서 `adb screencap` 하면 그대로 나온다.
- 2560×1440(4배)는 Play 상한 3840 안이지만 파일이 커지고 얻는 게 없다.
- ⚠ **비정수배 기기(예: 2340×1080)에서 찍으면 레터박스가 함께 캡처된다.**
  검은 띠가 들어간 스크린샷은 "화면을 못 채우는 게임"으로 보인다. 반드시 크롭한다(§4).

---

## 2. 찍을 화면 6장 (우선순위 순)

**앞의 3장이 ⛔ 필수다.** 시간이 없으면 여기서 멈춰도 Play 요건(최소 2장)은 충족한다.

| # | 화면 | 무엇이 보여야 하는가 | 촬영 시점 |
|---|---|---|---|
| 1 ⛔ | **PACT 카드 선택** | 축복 3장이 펼쳐지고 **각 카드 하단에 대가 배지**가 보인다. Epic(심홍) 1장 포함 | 첫 레벨업 |
| 2 ⛔ | **각성 발동** | 각성 연출 플래시 + 각성 아이콘. 화면이 가장 화려한 순간 | 같은 대가 3회 누적 직후 |
| 3 ⛔ | **최대 난전** | 적 80체 이상 + 무기 이펙트 다중 발동. HP 바·타이머가 함께 보인다 | 04:00~05:00 구간 |
| 4 | **보스전** | 처형자 보스 + 텔레그래프 인디케이터 | 05:30 이후 |
| 5 | **성소(은신처)** | 영구 강화 트리 — "죽어도 남는 게 있다"를 보여준다 | 런 종료 후 |
| 6 | **타이틀** | 로고 + 봉인묘 배경 | 앱 기동 직후 |

> ★ 1번과 2번이 이 게임의 유일한 차별점이다(정본 §5.2). 다른 서바이버즈 스크린샷과
>   구분되는 지점이 여기뿐이므로, 목록의 **첫 장은 반드시 1번**이어야 한다.

### 촬영 전 체크
- [ ] **디버그 오버레이 / FPS 카운터 / `window.BS` 흔적이 화면에 없다** (릴리스 빌드로 찍으면 자동 해결)
- [ ] HP 가 만피가 아니다 — 만피 스크린샷은 긴장감이 없어 보인다
- [ ] 화면 상단 시스템 바가 없다(전체화면 정상 동작 확인을 겸한다)

---

## 3. 촬영 명령 (Android 실기기)

```powershell
# 기기 연결 확인
adb devices

# 캡처 → PC 로 바로 받기 (기기 저장소를 거치지 않는다)
adb exec-out screencap -p > shot-1-pact.png
adb exec-out screencap -p > shot-2-awaken.png
adb exec-out screencap -p > shot-3-horde.png
adb exec-out screencap -p > shot-4-boss.png
adb exec-out screencap -p > shot-5-sanctum.png
adb exec-out screencap -p > shot-6-title.png
```

> ⚠ **`adb exec-out` 이다. `adb shell screencap -p > file` 이 아니다.**
> `shell` 을 거치면 Windows 에서 개행이 CRLF 로 변환되어 PNG 가 깨진다. 열리지 않는 파일이 나온다.

> ★ 각성 순간(2번)은 몇 프레임뿐이라 손으로 맞추기 어렵다.
>   화면 녹화 후 프레임을 뽑는 편이 확실하다:
>   ```powershell
>   adb shell screenrecord --size 1920x1080 /sdcard/rec.mp4   # Ctrl+C 로 종료
>   adb pull /sdcard/rec.mp4 .
>   magick rec.mp4[120] shot-2-awaken.png    # 120 = 프레임 번호
>   ```

---

## 4. 후처리 (레터박스 제거 + 규격 정규화)

기기 해상도가 16:9 가 아니면 캡처에 검은 띠가 포함된다. 게임 영역만 남긴다.

```bash
MAGICK="C:/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe"

# ① 검은 테두리 자동 제거 → ② 1920x1080 으로 정규화 → ③ 알파 제거
for f in shot-*.png; do
  "$MAGICK" "$f" \
    -bordercolor "#0b0710" -border 1 -trim +repage \
    -filter Point -resize 1920x1080! \
    -background "#0b0710" -alpha remove -alpha off \
    -define png:color-type=2 -strip "../store/play/$f"
done
```

> `-filter Point`(최근접)를 쓰는 이유: 픽셀아트는 확대/축소에 Lanczos 를 쓰면 뭉개진다.
> 아이콘(축소)과 정반대 선택이다 — `FE/tools/build-icons.mjs` 의 주석과 함께 읽어라.
> `-trim` 앞에 1px 테두리를 두르는 것은 **가장자리까지 검은 화면일 때 trim 이 전체를 지워버리는 사고**를 막는다.

**검증**
```bash
node -e "
const fs=require('fs');
for(const f of fs.readdirSync('store/play').filter(x=>x.startsWith('shot-'))){
  const b=fs.readFileSync('store/play/'+f);
  console.log(f, b.readUInt32BE(16)+'x'+b.readUInt32BE(20), (b.length/1024).toFixed(0)+'KB');
}"
```
- [ ] 전부 `1920x1080`
- [ ] 각 파일 8MB 이하 (Play 상한)

---

## 5. 산출물 위치

```
store/play/shot-1-pact.png   … shot-6-title.png    ← Play Console 에 이 순서로 업로드
```

업로드 위치: Play Console → **스토어 설정 아님 주의** → `기본 스토어 등록정보` →
`휴대전화 스크린샷` (가로 이미지도 이 칸에 올린다. 별도의 가로 칸은 없다).

---

## 6. Day 7 이후 — App Store 스크린샷

정식 제출 시점에만 필요하다. 규격: **6.9인치 리드 사이즈 2868×1320 (가로)**.

이미 찍은 1920×1080 을 재활용한다 — 다시 찍지 않는다.
```bash
# 좌우 (2868-1920)/2 = 474px, 상하 (1320-1080)/2 = 120px 를 VOID 로 채운다
"$MAGICK" store/play/shot-1-pact.png \
  -background "#0b0710" -gravity center -extent 2868x1320 \
  -alpha remove -alpha off -define png:color-type=2 \
  store/appstore/shot-1-pact.png
```
> ⚠ **1픽셀만 틀려도 거부된다.** 업로드 전에 반드시 크기를 다시 출력해 확인할 것.
