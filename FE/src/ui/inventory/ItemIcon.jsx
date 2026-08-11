/**
 * ItemIcon — 아틀라스 한 칸을 잘라 그린다. 등급 후광은 같은 자리 뒤에 깔린다.
 * (Phaser 쪽 ItemSystem 이 halo 를 DEPTH.ORB, 아이콘을 ORB+1 로 두는 것과 같은 순서다.)
 */
import { iconStyle, haloFrame } from "./itemAtlas";

export default function ItemIcon({ frame, size = 16, halo = null, className = "" }) {
    const box = `calc(${size} * var(--u))`;
    const h = halo && halo !== "common" ? haloFrame(halo) : null;
    return (
        <span className={"inv-ico " + className} style={{ width: box, height: box }} aria-hidden="true">
            {h && <span className="inv-icon is-halo" style={iconStyle(h, size)} />}
            {frame && <span className="inv-icon" style={iconStyle(frame, size)} />}
        </span>
    );
}
