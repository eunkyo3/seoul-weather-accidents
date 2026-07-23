# Smoke test: docker compose up -d --build 로 스택을 기동한 뒤,
# 6개 페이지 라우트와 /data/meta.json 이 HTTP 200을 반환하는지 확인한다.
# 사용법: pwsh scripts/smoke.ps1  (저장소 루트 또는 아무 위치에서 실행 가능)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

$routes = @("/", "/trend", "/weather", "/map", "/cross", "/about")
$dataChecks = @("/data/meta.json")
$baseUrl = "http://localhost:3000"
$maxWaitSeconds = 180
$pollIntervalSeconds = 3

function Test-Url($url) {
    try {
        $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
        return $resp.StatusCode
    } catch {
        if ($_.Exception.Response) {
            return [int]$_.Exception.Response.StatusCode
        }
        return $null
    }
}

try {
    Write-Host "== docker compose up -d --build ==" -ForegroundColor Cyan
    docker compose up -d --build
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose up failed (exit $LASTEXITCODE)"
    }

    Write-Host "== pipeline 컨테이너 종료 코드 대기 ==" -ForegroundColor Cyan
    $pipelineExit = $null
    $elapsed = 0
    while ($elapsed -lt $maxWaitSeconds) {
        $state = docker compose ps pipeline --format json 2>$null | ConvertFrom-Json
        if ($state -and $state.State -eq "exited") {
            $pipelineExit = $state.ExitCode
            break
        }
        Start-Sleep -Seconds $pollIntervalSeconds
        $elapsed += $pollIntervalSeconds
    }
    if ($null -eq $pipelineExit) {
        Write-Host "WARN: pipeline 종료 상태를 시간 내 확인하지 못함" -ForegroundColor Yellow
    } else {
        Write-Host "pipeline exit code: $pipelineExit" -ForegroundColor $(if ($pipelineExit -eq 0) { "Green" } else { "Red" })
    }

    Write-Host "== web 서버 기동 대기 (최대 ${maxWaitSeconds}s) ==" -ForegroundColor Cyan
    $elapsed = 0
    $webUp = $false
    while ($elapsed -lt $maxWaitSeconds) {
        $code = Test-Url "$baseUrl/"
        if ($code -eq 200) { $webUp = $true; break }
        Start-Sleep -Seconds $pollIntervalSeconds
        $elapsed += $pollIntervalSeconds
    }

    if (-not $webUp) {
        Write-Host "FAIL: web 서버가 ${maxWaitSeconds}초 내에 응답하지 않음" -ForegroundColor Red
        docker compose logs --tail=100 pipeline
        docker compose logs --tail=100 web
        exit 1
    }

    Write-Host "== 라우트 확인 ==" -ForegroundColor Cyan
    $results = @()
    foreach ($r in $routes) {
        $code = Test-Url "$baseUrl$r"
        $ok = $code -eq 200
        $results += [pscustomobject]@{ Path = $r; Status = $code; OK = $ok }
        $color = if ($ok) { "Green" } else { "Red" }
        Write-Host ("  {0,-10} -> {1}" -f $r, $code) -ForegroundColor $color
    }
    foreach ($r in $dataChecks) {
        $code = Test-Url "$baseUrl$r"
        $ok = $code -eq 200
        $results += [pscustomobject]@{ Path = $r; Status = $code; OK = $ok }
        $color = if ($ok) { "Green" } else { "Red" }
        Write-Host ("  {0,-10} -> {1}" -f $r, $code) -ForegroundColor $color
    }

    $failed = $results | Where-Object { -not $_.OK }
    if ($failed.Count -gt 0 -or $pipelineExit -ne 0) {
        Write-Host "`n== SMOKE TEST FAILED ==" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "`n== SMOKE TEST PASSED ==" -ForegroundColor Green
        exit 0
    }
} finally {
    Pop-Location
}
