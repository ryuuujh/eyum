# 공식 HS 데이터 정기 확인 (Claude, 11/27) — Windows 작업 스케줄러가 하루 한 번 부른다.
# 실제 확인 간격은 DB(hs_data_checks.next_check_at)가 정한다: HSK 7일, 표준품명 한 달, 실패하면 다음 날 다시.
# 접속 주소는 저장소의 .env.local에 있는 HS_REFRESH_DATABASE_URL을 쓴다 (Git에 안 올라감).
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$line = Get-Content (Join-Path $repo '.env.local') | Where-Object { $_ -match '^\s*HS_REFRESH_DATABASE_URL\s*=' } | Select-Object -First 1
if (-not $line) { throw '.env.local에 HS_REFRESH_DATABASE_URL이 없어요' }
$env:HS_REFRESH_DATABASE_URL = ($line -split '=', 2)[1].Trim().Trim('"')
$env:PYTHONDONTWRITEBYTECODE = '1'
$env:PYTHONIOENCODING = 'utf-8'
$log = Join-Path $repo 'supabase\.temp\hs_check.log'
New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null
$out = & python (Join-Path $PSScriptRoot 'hs_metadata_check.py') 2>&1
"$(Get-Date -Format s) $out" | Add-Content -Encoding utf8 $log
