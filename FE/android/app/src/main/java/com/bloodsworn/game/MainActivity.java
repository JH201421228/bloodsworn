package com.bloodsworn.game;

import android.os.Bundle;
import android.view.View;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * T705 — 전체화면(immersive) 진입점.
 *
 * ★ 테마의 windowFullscreen 은 상태바만 없앤다. 내비게이션 바(제스처 바 포함)는 남는다.
 *   논리 해상도 640x360 을 가로로 꽉 채워야 하는 게임에서 하단 바는 캔버스를 실제로 잘라먹는다.
 * ★ BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE 를 쓰는 이유:
 *   유저가 실수로 화면 가장자리를 스와이프해 바를 띄워도 잠시 뒤 자동으로 다시 숨는다.
 *   기본 동작(계속 표시)이면 한 번 나온 바가 게임 내내 남는다.
 * ★ onWindowFocusChanged 에서 다시 거는 이유:
 *   알림 셰이드를 내렸다 올리거나 앱 전환에서 돌아오면 시스템이 바를 복원한다.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 컨텐츠를 시스템 바 영역 아래까지 그린다(노치 대응은 테마의 shortEdges 와 짝).
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        applyImmersive();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersive();
        }
    }

    private void applyImmersive() {
        View decor = getWindow().getDecorView();
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), decor);
        controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
