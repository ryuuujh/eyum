# 정기 확인을 이 PC의 작업 스케줄러에 등록 (Claude, 11/27). 로컬 점검용. 배포 서버가 정해지면 그쪽 정기 실행으로 옮긴다.
#   등록:  powershell -ExecutionPolicy Bypass -File scripts\register_hs_check_task.ps1
#   해제:  schtasks /Delete /TN heyum_hs_check /F
$script = Join-Path $PSScriptRoot 'run_hs_check.ps1'
schtasks /Create /F /SC DAILY /ST 09:00 /TN heyum_hs_check /TR "powershell -NoProfile -ExecutionPolicy Bypass -File `"$script`""
