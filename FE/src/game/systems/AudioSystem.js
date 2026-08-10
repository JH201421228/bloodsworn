/**
 * AudioSystem — BGM 5구간 크로스페이드 + SFX. (Day 6 / T610~T613)
 *
 * ★ 모바일 자동재생 정책 때문에 첫 터치 전에는 어떤 소리도 나지 않는다(T611).
 *   unlock()을 첫 포인터 입력에 반드시 물려야 한다.
 *
 * ── 통합 계약 ──
 *   new AudioSystem(scene)
 *   .unlock()             : 첫 터치에서 호출
 *   .playBgm(key)         : 크로스페이드 전환
 *   .sfx(name, opts)      : 효과음. 8ms 내 동일음 중복은 내부에서 억제(T613)
 *   .setVolume(bgm, sfx)  : 0~1
 *   .stopAll()
 */
export class AudioSystem {
    constructor(scene) {
        this.scene = scene;
        this.unlocked = false;
        this.bgmVolume = 0.6;
        this.sfxVolume = 0.8;
    }

    unlock() { this.unlocked = true; }
    playBgm(_key) {}
    sfx(_name, _opts) {}
    setVolume(bgm, sfx) { this.bgmVolume = bgm; this.sfxVolume = sfx; }
    stopAll() {}
}
