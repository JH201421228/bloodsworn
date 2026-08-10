/**
 * AwakeningBanner — 각성 순간의 전면 연출. (Day 4 / T422)
 *
 * ★ 이 게임에서 가장 중요한 0.8초다. 저주가 무기로 뒤집히는 순간을 플레이어가
 *   "봤다"고 느끼지 못하면 PACT 전체가 그냥 불편한 카드 시스템이 된다.
 *
 * 표시 조건: store.awakeningBanner 가 non-null.
 * 히트스톱·심홍 플래시·흑백 반전·충격파는 AwakeningSystem(Phaser)이 담당하고,
 * 여기서는 타이포그래피와 인장만 그린다. 둘의 역할을 섞지 않는다 —
 * 캔버스 안에서 한글 대형 타이포를 그리면 픽셀 폰트가 뭉개진다.
 *
 * ★ 좌표를 % 로 쓰는 이유 (PactOverlay와 동일 규약)
 *   Phaser가 Scale.FIT으로 640x360(16:9)을 중앙 배치한다.
 *   React 오버레이도 같은 16:9 박스(.ui-stage)를 만들면 두 좌표계가 저절로 맞는다.
 *
 * ★ 이름/문구를 이벤트 페이로드가 아니라 tag로 조회하는 이유
 *   AWAKENING_TRIGGERED 페이로드는 { tag, list } 뿐이다(CombatSystem 소유).
 *   정본 데이터가 awakenings.json 하나이므로 여기서 직접 읽으면 페이로드가
 *   어떻게 바뀌든 배너는 깨지지 않는다. name이 실려 오면 그쪽을 우선한다.
 */
import { useEffect } from "react";
import { useStore } from "@/state/store";
import awakeningsData from "@/data/awakenings.json";
import "./awakening.css";

const pct = (v, total) => (v / total) * 100 + "%";

const BY_TAG = {};
for (const a of awakeningsData.awakenings) if (a.tag) BY_TAG[a.tag] = a;

/** 표시 시간. 정본 04-PACT 5.2의 연출 길이(히트스톱 0.2 + 반전 0.15)보다 길어야 한다 */
const BANNER_MS = awakeningsData.presentation.bannerMs ?? 2000;

export default function AwakeningBanner() {
    const banner = useStore((s) => s.awakeningBanner);
    const hideAwakening = useStore((s) => s.hideAwakening);

    // ★ 자동 해제. 게임이 계속 돌고 있으므로 플레이어의 탭을 기다리면 안 된다
    //   (탭을 기다리면 각성 직후 2초가 무방비 시간이 된다).
    useEffect(() => {
        if (!banner) return undefined;
        const t = setTimeout(hideAwakening, BANNER_MS);
        return () => clearTimeout(t);
    }, [banner, hideAwakening]);

    if (!banner) return null;

    const def = BY_TAG[banner.tag] ?? null;
    const name = banner.name ?? def?.name ?? "각성";
    const quote = banner.quote ?? def?.quote ?? "";
    const desc = banner.desc ?? def?.desc ?? "";
    const sigil = banner.sigil ?? def?.sigil ?? "✦";

    return (
        <div className="ui-stage awaken-stage" data-tag={banner.tag ?? ""} aria-hidden="true">
            <div className="awaken-veil" />
            <div
                className="awaken-core"
                style={{ top: pct(84, 360), left: pct(40, 640), width: pct(560, 640) }}
            >
                <span className="awaken-sigil">{sigil}</span>
                <span className="awaken-kicker">각 성</span>
                <span className="awaken-name">{name}</span>
                {quote && <span className="awaken-quote">{quote}</span>}
                {desc && <span className="awaken-desc">{desc}</span>}
            </div>
        </div>
    );
}
