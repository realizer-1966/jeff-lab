# jeff-lab

Jeff (github.com/firelex/jeff) System-1 결정모델 랩 — 5번째 랩 PWA (laya·ollaya-lab·decision-lab·audio-lab 다음).

- **App:** https://jeff-lab.dydtnsp.workers.dev (버전 스트링 ?v14)
- **Repo:** github.com/realizer-1966/jeff-lab (커밋 d5715da)
- **백엔드:** 노트북 GPU(RTX 4090) jeff-serve 3포트 병행, tailscale serve https 서브경로

## 아키텍처 (2026-10-02 · 트라이 포트 병행)

| 포트 | 서브경로 | 서빙 | 용도 |
|---|---|---|---|
| 8765 | /jeff | Jeff-Qwen3.5-0.8B-v1.2 + LoRA 어댑터 9종 | 어댑터 정밀 판정 (guard 0.998 등) |
| 8766 | /jeff2 | checkpoints/jeff-2b 단독 | 자유 판정·한국어 강화 (refund 0.774) |
| 8767 | /jeff3 | checkpoints/jeff-gemma4 단독 | vision 판정 (26 옵션 한도) |

- v1.2 소스: /v1/models·/v1/adapters/reload — 어댑터 선택은 요청 model 필드로(/v1/switch 없음)
- 어댑터는 0.8B v1.2 베이스 전용(weights sha256 해시 검증) — 앱은 0.8b 선택 시에만 어댑터 enable
- score 응답 probabilities는 dict({"0":…}) — 렌더러 dict/배열 양쪽 지원
- orders=2(2회 판정 평균·위치편향 완화) 지원

## 구조

- `public/index.html` — UI (다크네이비·#38bdf8 액센트·탭바 — 기존 4랩과 디자인 언어 통일, JEF 마크로 차별)
- `public/catalog.js` — 카탈로그 12카드(베이스 3 + 어댑터 9)·stateSample 자동채움·refreshInstalled 3포트 health
- `public/app.js` — 판정·모델 선택·targetSrv() 포트 자동 라우팅·프리셋
- `worker/` — Cloudflare Worker (wrangler deploy)

## 노트북 기동 (PowerShell 창 3개)

포트1: JEFF_CHECKPOINT=Jeff-Qwen3.5-0.8B-v1.2 JEFF_ADAPTERS=adapters PORT=8765
포트2: JEFF_CHECKPOINT=checkpoints/jeff-2b PORT=8766 (JEFF_ADAPTERS 없이)
포트3: JEFF_CHECKPOINT=checkpoints/jeff-gemma4 PORT=8767 (JEFF_ADAPTERS 없이)
공통: JEFF_API_KEY=(키) JEFF_BACKEND=pytorch JEFF_HOST=127.0.0.1
기동 후: uv run --no-default-groups --extra cuda jeff-serve
serve 등록: tailscale serve --bg --set-path /jeff{,2,3} http://127.0.0.1:{8765,8766,8767}
CORS: git pull 후 반드시 uv run python cors_patch.py 재실행

## 실측 성능 (RTX 4090)

- guard 어댑터: 인젝션 attack 0.998 / 정상 safe 0.998 (~0.6s)
- spam 어댑터: 0.999
- 베이스 한국어 환불: 2B 0.774 / 0.8B 0.526 / gemma4 0.624
- 베이스 3종 스위치: 0.8b 2.4s·2b 4.6s·gemma4 9.6s

## 남은 확장

- 한국어 LoRA 어댑터 자체 제작 (examples/adapter-kit 6단계 — check-rows→split→leak-check→shortcut-report→replay-mix→evaluate)
- 어댑터당 ~41MB·GPU 1개 0.5~4시간
