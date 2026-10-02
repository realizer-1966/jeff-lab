# 한국어 어댑터 학습 — jeff-train (0.8B v1.2 베이스 고정)
# 실행: powershell -ExecutionPolicy Bypass -File .\train-ko-adapter.ps1
$ErrorActionPreference = "Stop"
cd C:\Users\dydtn\jeff

# 데이터 파일(커런트 폴더에 받아둔 상태) 확인
foreach ($f in "train.jsonl","development.jsonl","calibration.jsonl") {
  if (-not (Test-Path $f)) { Write-Host "없음: $f — curl로 먼저 받으세요"; exit 1 }
}

uv run jeff-train `
  --train train.jsonl --development development.jsonl --temperature calibration.jsonl `
  --run runs/ko-triage-1 --output checkpoints/ko-triage-1 `
  --base-model Qwen/Qwen3.5-0.8B `
  --initial-checkpoint Jeff-Qwen3.5-0.8B-v1.2 `
  --lora-rank 16 --epochs 1 --lr 5e-6 --batch-size 32 --effective-batch-size 256 `
  --token-budget 8192 --max-length 8192 --eval-every 40
