import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// T703 — 릴리스 번들 설정.
export default defineConfig({
    plugins: [react()],
    // ★ base: "./" 는 협상 대상이 아니다.
    //   Capacitor 는 WebView 를 file:// 또는 https://localhost 로 띄우고 dist 를 그대로 복사한다.
    //   기본값 "/" 로 두면 /assets/index-xxx.js 를 절대경로로 찾다가 흰 화면만 뜬다.
    base: "./",
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
    build: {
        // 소스맵은 릴리스 산출물에 넣지 않는다(용량 + 코드 노출). 스택트레이스가 필요하면 로컬에서 재현한다.
        sourcemap: false,
        // Android 5+/iOS 14+ WebView 가 대상이다. esbuild 기본 타깃(esnext)은
        // 구형 WebView 에서 문법 에러로 즉사하므로 명시적으로 낮춘다.
        target: ["es2020", "chrome87", "safari14"],
        chunkSizeWarningLimit: 1500,
        rollupOptions: {
            output: {
                // T706 — phaser 청크 분리.
                //   Phaser 는 압축 후에도 ~350KB 로 번들의 대부분을 차지한다.
                //   게임 코드와 한 덩어리로 두면 소스 한 줄만 고쳐도 전체가 캐시 무효화된다.
                //   벤더를 갈라두면 앱 업데이트 시 WebView 캐시 재사용률이 올라가고,
                //   빌드 로그에서 "내 코드가 커진 건지 Phaser 인지"를 눈으로 구분할 수 있다.
                manualChunks(id) {
                    if (!id.includes("node_modules")) return undefined;
                    if (id.includes("phaser")) return "phaser";
                    if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler"))
                        return "react-vendor";
                    return "vendor";
                },
            },
        },
    },
});
