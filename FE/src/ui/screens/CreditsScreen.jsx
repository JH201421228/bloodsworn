/**
 * CreditsScreen — 크레딧. (Day 6 / T604 · 17-LICENSES §5 M2/LC-11)
 *
 * ★ 이 화면은 기능이 아니라 **배포 요건**이다. 크레딧이 빠진 빌드는 Play/App Store 어느 쪽으로도
 *   나가면 안 된다. CC-BY 계열은 표기가 법적 의무이고, 나머지도 재배포 조건이 붙어 있다.
 * ★ "…"로 줄이지 않는다. 팩 이름 / by 제작자 / URL 3줄 세트로 전부 적는다(17 §5 규칙 C1).
 *   라이선스명은 의무이거나 유의미할 때만 병기한다(C2).
 * ★ 오프라인에서도 읽히도록 링크가 아니라 텍스트로 노출한다(C6).
 *
 * ⚠ 미확정 항목(17 §1-B): Raven Fantasy Icons(LC-02) / 이펙트 팩(LC-03) / 투사체 팩(LC-04) 은
 *   제작자·라이선스가 아직 확정되지 않았다. 실제 사용 중이라 지금은 표기해 두되,
 *   **출시 전에 LC-02~04를 끝내고 이 배열을 확정**해야 한다. 사용을 접으면 항목을 지운다(C5).
 */
import { APP_VERSION } from "@/ui/screens/screenUtils";

const GROUPS = [
    {
        title: "A R T   A S S E T S",
        items: [
            {
                role: "플레이어 캐릭터",
                name: "Adventurer 2D Top-Down",
                by: "xzany",
                url: "https://xzany.itch.io/top-down-adventurer-character",
            },
            {
                role: "적 스프라이트",
                name: "Undead / Vermin / Demon Asset Pack [16x16]",
                by: "DeepDiveGameStudio",
                url: "https://deepdivegamestudio.itch.io",
            },
            {
                role: "보스 「여명의 처형인」",
                name: "Bringer of Death",
                by: "Clembod",
                url: "https://clembod.itch.io",
            },
            {
                role: "배경 타일셋",
                name: "Dungeon Tileset",
                by: "Szadi art",
                url: "https://szadiart.itch.io",
                lic: "Public domain",
            },
            {
                role: "UI 아이콘",
                name: "Raven Fantasy Icons",
                by: "Clockwork Raven Studios (Caio)",
                url: "https://clockworkraven.itch.io/raven-fantasy-icons",
            },
        ],
    },
    {
        title: "A U D I O",
        items: [
            {
                role: "배경음악",
                name: "universfield / SoundReality / NCPrime / 5xBeatz / AudioKnap / SimpleSound / Grand_Project / Dragon-Studio",
                by: "via Pixabay",
                url: "https://pixabay.com",
                lic: "Pixabay Content License",
            },
            {
                role: "효과음",
                name: "절차적 생성 (WebAudio API)",
                by: "본 프로젝트",
            },
        ],
    },
    {
        title: "F O N T",
        items: [
            {
                role: "본문 폰트",
                name: "물마루 Mono (Mulmaru Mono)",
                by: "Mushsooni",
                url: "https://github.com/mushsooni/mulmaru",
                // OFL 은 재배포 시 라이선스 전문 동봉이 사실상 의무다. 표기만으로 끝나지 않는다(LC-09).
                lic: "SIL Open Font License 1.1",
            },
        ],
    },
    {
        title: "E N G I N E   &   T O O L S",
        items: [
            { role: "", name: "Phaser 3.90", url: "https://phaser.io" },
            { role: "", name: "React 19", url: "https://react.dev" },
            { role: "", name: "Capacitor 7", url: "https://capacitorjs.com" },
            { role: "", name: "Vite 7", url: "https://vite.dev" },
            { role: "", name: "Zustand 5", url: "https://zustand.docs.pmnd.rs" },
        ],
    },
];

function Item({ it }) {
    return (
        <div className="credits__item">
            {it.role && <div className="credits__role">{it.role}</div>}
            <div className="credits__name">{it.name}</div>
            {it.by && <div className="credits__by">by {it.by}</div>}
            {it.lic && <div className="credits__lic">{it.lic}</div>}
            {it.url && <div className="credits__url">{it.url}</div>}
        </div>
    );
}

export default function CreditsScreen({ onClose }) {
    return (
        <div className="screen">
            <div className="topbar">
                <button className="btn btn--ghost btn--sm" onClick={onClose}>
                    ◀ 뒤로
                </button>
                <h2 className="topbar__title">ⓘ 크 레 딧</h2>
            </div>

            <div className="credits">
                <div className="credits__left">
                    <h3>BLOODSWORN</h3>
                    피의 서약
                    <br />
                    v{APP_VERSION} · 2026
                    <br />
                    <br />
                    기획 · 프로그래밍 · 디자인
                    <br />
                    SOLO DEV
                    <br />
                    <br />
                    모든 축복에는 대가가 따른다.
                    <br />
                    <br />
                    Made in 7 days.
                </div>

                {/* ★ 이 게임에서 세로 스크롤이 허용된 유일한 영역이다(10-UIUX 2.11).
                    전역 touch-action:none 을 CSS 에서 pan-y 로 되돌려 놓았다. */}
                <div className="credits__scroll">
                    {GROUPS.map((g) => (
                        <section key={g.title}>
                            <h4 className="credits__group">{g.title}</h4>
                            {g.items.map((it) => (
                                <Item key={it.name} it={it} />
                            ))}
                        </section>
                    ))}
                    <div className="credits__foot">
                        이 게임은 광고 · 인터넷 연결 · 개인정보 수집이 없습니다.
                        <br />© 2026 SOLO DEV
                    </div>
                </div>
            </div>
        </div>
    );
}
