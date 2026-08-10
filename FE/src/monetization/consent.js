/**
 * consent — 광고 동의(EEA/UK UMP)와 iOS 추적 투명성(ATT) 처리. (M-1)
 *
 * ★ 이 파일이 없으면 EEA 유저에게 광고를 띄우는 순간 정책 위반이다.
 *   Google 은 EEA/UK 트래픽에 대해 **인증 CMP(Consent Management Platform)** 를 요구하고,
 *   AdMob 이 무료로 제공하는 것이 UMP(User Messaging Platform)다.
 *   `@capacitor-community/admob` 의 requestConsentInfo/showConsentForm 이 그 UMP 래퍼다.
 *
 * ★ 소프트런치 방침(docs/20-MONETIZATION.md §9):
 *   - **개인화 광고를 요청하지 않는다(npa=1).** 동의를 못 받았거나 모르는 상태도 전부 비개인화.
 *   - **iOS ATT 프롬프트를 띄우지 않는다.** 추적을 안 하므로 띄울 이유가 없고,
 *     Apple 개인정보 라벨을 "추적 안 함"으로 유지할 수 있다. eCPM 을 일부 포기하는 대신
 *     심사 리스크와 문서 작업을 통째로 없앤다. 1인 개발 6개월에서는 이쪽이 남는 장사다.
 *   개인화 광고로 전환할 때 고칠 곳은 이 파일과 privacy/ 표, 스토어 데이터 보안 양식이다.
 *
 * ★ 모든 함수는 실패해도 던지지 않는다. 동의 흐름이 막히면 광고만 못 띄우면 되고,
 *   게임은 아무 일 없이 계속돼야 한다.
 */

/** 비개인화 광고 고정. true 로 바꾸는 순간 개인정보 처리방침·데이터 보안 양식을 함께 고쳐야 한다. */
export const PERSONALIZED_ADS = false;

let consentState = { status: "unknown", canRequestAds: true, npa: true, formShown: false };

export function getConsentState() {
    return { ...consentState };
}

/**
 * UMP 동의 흐름. EEA/UK 밖에서는 status 가 NOT_REQUIRED 로 즉시 끝난다.
 * @param {object} AdMob capacitor-community/admob 핸들 (없으면 호출하지 않는다)
 * @param {{debugGeography?:string, testDeviceIdentifiers?:string[]}} opts
 */
export async function ensureConsent(AdMob, opts = {}) {
    if (!AdMob || typeof AdMob.requestConsentInfo !== "function") {
        // 웹/미설치. 광고 자체가 없으므로 동의도 필요 없다.
        consentState = { status: "not_required", canRequestAds: true, npa: true, formShown: false };
        return consentState;
    }
    try {
        const info = await AdMob.requestConsentInfo({
            debugGeography: opts.debugGeography, // 개발 중 EEA 흉내: "EEA"
            testDeviceIdentifiers: opts.testDeviceIdentifiers ?? [],
        });
        const status = String(info?.status ?? "UNKNOWN").toUpperCase();

        // REQUIRED = 동의 폼을 보여줘야 하는 지역(EEA/UK). 폼이 준비돼 있을 때만 띄운다.
        if (status === "REQUIRED" && info?.isConsentFormAvailable && typeof AdMob.showConsentForm === "function") {
            const after = await AdMob.showConsentForm();
            const s2 = String(after?.status ?? status).toUpperCase();
            consentState = {
                status: s2.toLowerCase(),
                // ★ 거부해도 광고를 아예 끄지는 않는다. 비개인화 광고는 동의 없이도 허용된다.
                //   대신 이 게임은 어차피 항상 비개인화이므로 실질 차이가 없다.
                canRequestAds: true,
                npa: true,
                formShown: true,
            };
            return consentState;
        }

        consentState = { status: status.toLowerCase(), canRequestAds: true, npa: true, formShown: false };
        return consentState;
    } catch (e) {
        // 폼 로드 실패·네트워크 없음 등. 비개인화 광고로 계속 간다.
        console.info("[consent] UMP 흐름 실패 — 비개인화 광고로 계속한다", e?.message ?? e);
        consentState = { status: "error", canRequestAds: true, npa: true, formShown: false };
        return consentState;
    }
}

/**
 * 설정 화면의 "광고 동의 다시 설정". EEA 유저에게 반드시 제공해야 한다(동의 철회권).
 * EEA 밖 유저에게는 버튼을 숨겨도 된다 — getConsentState().status 로 판단한다.
 */
export async function resetConsent(AdMob) {
    try {
        await AdMob?.resetConsentInfo?.();
        consentState = { status: "unknown", canRequestAds: true, npa: true, formShown: false };
        return true;
    } catch {
        return false;
    }
}

/**
 * iOS ATT. 현재 방침상 **프롬프트를 띄우지 않고 상태만 읽는다.**
 * 추적을 하지 않으므로 권한이 없어도 광고는 정상 동작한다(비개인화).
 */
export async function readTrackingStatus(AdMob) {
    try {
        const r = await AdMob?.trackingAuthorizationStatus?.();
        return String(r?.status ?? "notDetermined");
    } catch {
        return "notDetermined";
    }
}
