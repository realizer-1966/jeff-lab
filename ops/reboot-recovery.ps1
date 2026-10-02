# =====================================================================
#  jeff-lab 노트북 재부팅 복구 스크립트  (작성 2026-10-02)
#  실행:   powershell -ExecutionPolicy Bypass -File .\reboot-recovery.ps1
#  하는 일:
#    [1/5] 모델·패치 파일 존재 확인
#    [2/5] jeff 소스 세대 확인 (v1.2 = d0173b4)
#    [3/5] tailscale serve /jeff /jeff2 /jeff3 재등록 (재실행 안전=멱등)
#    [4/5] 서버 3개를 새 PowerShell 창으로 기동 (start-p1/2/3.ps1 생성)
#    [5/5] 35초 대기 후 3포트 헬스체크
#  포트 구성:
#    8765 /jeff  = 0.8B 공식 v1.2 + 어댑터 9종
#    8766 /jeff2 = 2B 단독
#    8767 /jeff3 = gemma4 (vision) 단독
# =====================================================================

$JEFF = "C:\Users\dydtn\jeff"

Write-Host ""
Write-Host "== [1/5] 파일 존재 확인 ==" -ForegroundColor Cyan
$need = @(
  "Jeff-Qwen3.5-0.8B-v1.2",
  "adapters\guard",
  "checkpoints\jeff-2b",
  "checkpoints\jeff-gemma4",
  "cors_patch.py"
)
foreach ($f in $need) {
  $p = Join-Path $JEFF $f
  if (Test-Path $p) { Write-Host "  OK   $f" }
  else { Write-Host "  없음 $f" -ForegroundColor Yellow }
}
Write-Host "  (없음 표시가 있으면 아래 절차 뒤 '파일 다시 받기' 섹션 참고 — 안내 md)"

Write-Host ""
Write-Host "== [2/5] jeff 소스 세대 확인 (v1.2 = d0173b4) ==" -ForegroundColor Cyan
Push-Location $JEFF
$head = git log --oneline -1
Write-Host "  HEAD: $head"
if ($head -notmatch "d0173b4") {
  Write-Host "  d0173b4(v1.2)가 아니다 — 업데이트됐거나 구버전. 어댑터 9종 검증 환경은 v1.2 기준:" -ForegroundColor Yellow
  Write-Host "    git stash ; git pull origin main ; uv sync --no-default-groups --extra cuda --extra lora ; uv run python cors_patch.py"
}
Pop-Location

Write-Host ""
Write-Host "== [3/5] tailscale serve 재등록 (/jeff /jeff2 /jeff3 — 재실행 안전) ==" -ForegroundColor Cyan
tailscale status | Select-Object -First 1
tailscale serve --bg --set-path /jeff  http://127.0.0.1:8765
tailscale serve --bg --set-path /jeff2 http://127.0.0.1:8766
tailscale serve --bg --set-path /jeff3 http://127.0.0.1:8767
tailscale serve status

Write-Host ""
Write-Host "== [4/5] 서버 3개 새 PowerShell 창 기동 ==" -ForegroundColor Cyan

$p1 = @'
cd C:\Users\dydtn\jeff
$env:JEFF_CHECKPOINT = "Jeff-Qwen3.5-0.8B-v1.2"
$env:JEFF_ADAPTERS   = "adapters"
$env:JEFF_API_KEY    = "***"
$env:JEFF_BACKEND    = "pytorch"
$env:PORT            = "8765"
$env:JEFF_HOST       = "127.0.0.1"
Write-Host "== 포트1: 0.8B v1.2 + 어댑터 9종 (8765) =="
uv run --no-default-groups --extra cuda jeff-serve
'@
Set-Content -Path "$JEFF\start-p1.ps1" -Value $p1 -Encoding UTF8
Start-Process powershell -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-File',"$JEFF\start-p1.ps1"

$p2 = @'
cd C:\Users\dydtn\jeff
$env:JEFF_CHECKPOINT = "checkpoints/jeff-2b"
$env:JEFF_API_KEY    = "***"
$env:JEFF_BACKEND    = "pytorch"
$env:PORT            = "8766"
$env:JEFF_HOST       = "127.0.0.1"
Write-Host "== 포트2: 2B 단독 (8766) =="
uv run --no-default-groups --extra cuda jeff-serve
'@
Set-Content -Path "$JEFF\start-p2.ps1" -Value $p2 -Encoding UTF8
Start-Process powershell -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-File',"$JEFF\start-p2.ps1"

$p3 = @'
cd C:\Users\dydtn\jeff
$env:JEFF_CHECKPOINT = "checkpoints/jeff-gemma4"
$env:JEFF_API_KEY    = "***"
$env:JEFF_BACKEND    = "pytorch"
$env:PORT            = "8767"
$env:JEFF_HOST       = "127.0.0.1"
Write-Host "== 포트3: gemma4 vision 단독 (8767) =="
uv run --no-default-groups --extra cuda jeff-serve
'@
Set-Content -Path "$JEFF\start-p3.ps1" -Value $p3 -Encoding UTF8
Start-Process powershell -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-File',"$JEFF\start-p3.ps1"

Write-Host "  서버 창 3개를 열었다. 가중치/어댑터 로딩 ~10초"

Write-Host ""
Write-Host "== [5/5] 35초 후 3포트 헬스체크 ==" -ForegroundColor Cyan
Start-Sleep -Seconds 35
foreach ($port in 8765,8766,8767) {
  try {
    $h = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 10
    Write-Host ("  포트 $port OK   " + ($h | ConvertTo-Json -Compress)) -ForegroundColor Green
  } catch {
    Write-Host "  포트 $port 미응답 — 로딩 중일 수 있다. 30초 뒤 아래 1줄만 재실행:" -ForegroundColor Yellow
    Write-Host "    Invoke-RestMethod http://127.0.0.1:$port/health"
  }
}

Write-Host ""
Write-Host "완료. PWA 새로고침 2회 후 카드 배지 확인." -ForegroundColor Green
Write-Host "서버 창 3개는 닫지 말 것. 종료할 때는 각 창 Ctrl+C 후 창 닫기."
#  강제 재설치가 필요하면:  uv sync --no-default-groups --extra cuda --extra lora
