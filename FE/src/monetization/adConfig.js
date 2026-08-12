/**
 * adConfig — 광고 단위 ID 의 **유일한 정본**. (M-1)
 *
 * ★ 이 파일 하나만 고치면 테스트 광고 → 실제 광고로 넘어간다.
 *   ID 문자열을 ads.js 나 UI 어디에도 다시 적지 마라. 두 곳에 적히는 순간
 *   한쪽만 바꾸고 배포해서 **테스트 트래픽이 실 단위로 들어가고 계정이 정지된다.**
 *
 * ── 지금 상태 ──
 *   REAL_UNITS 가 전부 빈 문자열이다 → 자동으로 아래 TEST_UNITS 를 쓰고 isTesting=true 가 된다.
 *   즉 「AdMob」 계정 없이도 APK 에서 보상형 광고가 실제로 뜬다.
 *
 * ── 실제 ID 로 바꾸는 법 (계정을 만든 뒤) ──
 *   1) REAL_UNITS.android 에 「AdMob」 콘솔의 보상형 광고 단위 ID 를 넣는다
 *      (형식: ca-app-pub-XXXXXXXXXXXXXXXX/NNNNNNNNNN — 슬래시다)
 *   2) android/app/src/main/AndroidManifest.xml 의
 *      com.google.android.gms.ads.APPLICATION_ID 값을 앱 ID 로 바꾼다
 *      (형식: ca-app-pub-XXXXXXXXXXXXXXXX~NNNNNNNNNN — **물결표다.** 광고 단위 ID 와 다른 값이다)
 *   3) 그 둘은 반드시 같은 계정의 같은 앱이어야 한다. 어긋나면 no_fill 로 조용히 실패한다.
 *   자세한 단계는 docs/20-MONETIZATION.md §10.3.
 *
 * ★ 빌드 환경변수로 덮어쓸 수도 있다(저장소에 실 ID 를 커밋하지 않으려면 이쪽이 낫다):
 *   VITE_ADMOB_REWARDED_ANDROID / VITE_ADMOB_REWARDED_IOS — src/App.jsx 가 읽어 opts 로 넘긴다.
 *   우선순위: opts(환경변수) > REAL_UNITS > TEST_UNITS.
 */

/**
 * 「Google」 공식 데모 광고 단위. 계정 없이도 실제 광고가 나오고, 무효 트래픽으로 잡히지 않는다.
 *
 * 출처 (2026-08 확인):
 *   Android — https://developers.google.com/admob/android/test-ads  ("Rewarded" 행)
 *   iOS     — https://developers.google.com/admob/ios/test-ads      ("Rewarded" 행)
 *
 * ⚠ 이 값을 기억으로 고치지 마라. 한 글자만 틀려도 no_fill 로 조용히 실패해서 원인 추적이 지옥이다.
 */
export const TEST_UNITS = Object.freeze({
    android: "ca-app-pub-3940256099942544/5224354917",
    ios: "ca-app-pub-3940256099942544/1712485313",
});

/**
 * 「Google」 공식 데모 **앱** ID. AndroidManifest.xml 의 메타데이터에 들어가는 값이다.
 * 광고 단위 ID 와 형식이 다르다(물결표 구분자). 여기 적어 두는 이유는 매니페스트 값과
 * 대조할 근거를 코드 쪽에도 남기기 위해서다 — 실제로 읽어 쓰는 곳은 매니페스트다.
 *
 * 출처: https://developers.google.com/admob/android/quick-start
 *       ("Sample AdMob app ID: ca-app-pub-3940256099942544~3347511713")
 */
export const TEST_APP_ID_ANDROID = "ca-app-pub-3940256099942544~3347511713";

/**
 * ★★ 사용자가 채울 자리. 「AdMob」 계정을 만든 뒤 여기에 실제 광고 단위 ID 를 넣는다. ★★
 * 비워 두면 자동으로 TEST_UNITS 를 쓴다 — 비운 채로 배포해도 앱은 정상 동작한다(테스트 광고가 뜬다).
 */
export const REAL_UNITS = Object.freeze({
    android: "",
    ios: "",
});

/** 「AdMob」 광고 단위 ID 형식 검사. 오타를 배포 전에 잡는다. */
const UNIT_RE = /^ca-app-pub-\d{16}\/\d{6,12}$/;

/**
 * 이 플랫폼에서 쓸 보상형 광고 단위를 정한다.
 *
 * ★ **실 ID 가 확정되지 않으면 무조건 isTesting=true 다.** 이 규칙을 절대 느슨하게 하지 마라 —
 *   개발 중 클릭이 실 단위에 쌓이면 「AdMob」 계정이 정지된다. 되돌릴 방법이 없다.
 *
 * @param {"android"|"ios"|"web"} platform
 * @param {string} [override] opts 로 넘어온 값(환경변수 경유). 최우선.
 * @returns {{unitId:string, isTesting:boolean, source:"opts"|"real"|"test"}}
 */
export function resolveRewardedUnit(platform, override) {
    const key = platform === "ios" ? "ios" : "android";

    const candidates = [
        { v: String(override ?? "").trim(), source: "opts" },
        { v: String(REAL_UNITS[key] ?? "").trim(), source: "real" },
    ];

    for (const c of candidates) {
        if (!c.v) continue;
        if (!UNIT_RE.test(c.v)) {
            // 형식이 틀린 ID 로 요청하면 SDK 가 no_fill 만 돌려주고 이유를 알려주지 않는다.
            // 조용히 테스트 ID 로 떨어뜨리되, 이유는 반드시 남긴다.
            console.warn("[ads] 광고 단위 ID 형식이 잘못됐다 — 테스트 ID 로 대체한다:", c.source, c.v);
            continue;
        }
        return { unitId: c.v, isTesting: false, source: c.source };
    }

    return { unitId: TEST_UNITS[key], isTesting: true, source: "test" };
}
