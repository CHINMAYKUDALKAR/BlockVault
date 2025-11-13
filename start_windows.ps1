<#
    BlockVault Windows Startup Script
    Mirrors the behavior of start.sh for PowerShell users.

    Requirements:
      - PowerShell 5.1+ (or PowerShell Core)
      - Python 3 available on PATH (either `python` or `py`)
      - Node.js and npm available on PATH
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info($Message)    { Write-Host "[INFO ] $Message" -ForegroundColor Cyan }
function Write-Success($Message) { Write-Host "[ OK  ] $Message" -ForegroundColor Green }
function Write-WarningMsg($Message) { Write-Host "[WARN ] $Message" -ForegroundColor Yellow }
function Write-ErrorMsg($Message)   { Write-Host "[ERROR] $Message" -ForegroundColor Red }

function Get-ScriptRoot {
    if ($PSScriptRoot) {
        return $PSScriptRoot
    }
    return Split-Path -Parent $MyInvocation.MyCommand.Path
}

function Ensure-Command($Name) {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $cmd) {
        throw "Required command '$Name' not found on PATH."
    }
    return $cmd
}

function Ensure-Venv($ProjectDir, $VenvDir) {
    $python = Get-Command python -ErrorAction SilentlyContinue
    if (-not $python) {
        $python = Get-Command py -ErrorAction SilentlyContinue
        if (-not $python) {
            throw "Python is not installed or not on PATH. Install Python 3 and try again."
        }
        $createArgs = @('-3', '-m', 'venv', $VenvDir)
        $pythonExecutable = Join-Path $VenvDir 'Scripts\python.exe'
    } else {
        $createArgs = @('-m', 'venv', $VenvDir)
        $pythonExecutable = Join-Path $VenvDir 'Scripts\python.exe'
    }

    if (-not (Test-Path $VenvDir)) {
        Write-WarningMsg "Python virtual environment not found."
        Write-Info "Creating virtual environment..."
        & $python.Source $createArgs
        Write-Info "Installing Python dependencies..."
        & $pythonExecutable -m pip install -r (Join-Path $ProjectDir 'requirements.txt')
    } else {
        Write-Success "Virtual environment found."
    }

    if (-not (Test-Path $pythonExecutable)) {
        throw "Failed to locate python executable at $pythonExecutable"
    }

    return $pythonExecutable
}

function Ensure-FrontendDependencies($FrontendDir) {
    if (-not (Test-Path (Join-Path $FrontendDir 'package.json'))) {
        throw "package.json not found in $FrontendDir"
    }

    if (-not (Test-Path (Join-Path $FrontendDir 'node_modules'))) {
        Write-WarningMsg "Frontend dependencies not installed."
        Write-Info "Installing frontend dependencies with npm install..."
        Push-Location $FrontendDir
        try {
            & (Ensure-Command 'npm').Source 'install'
        } finally {
            Pop-Location
        }
    } else {
        Write-Success "Frontend dependencies present."
    }
}

function Free-Port($Port) {
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction Stop
    } catch {
        return
    }

    if ($connections) {
        Write-WarningMsg "Port $Port is in use. Attempting to free it..."
        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($pid in $pids) {
            try {
                Stop-Process -Id $pid -Force -ErrorAction Stop
                Write-Info "Stopped process $pid using port $Port."
            } catch {
                Write-WarningMsg "Failed to stop process $pid on port $Port: $($_.Exception.Message)"
            }
        }
        Start-Sleep -Seconds 1
    }
}

function Wait-ForService($Url, $Name, $TimeoutSeconds = 30) {
    Write-Info "Waiting for $Name to become available..."
    $attempt = 0
    while ($attempt -lt $TimeoutSeconds) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                Write-Success "$Name is ready."
                return $true
            }
        } catch {
            # swallow and retry
        }
        Start-Sleep -Seconds 1
        $attempt++
    }
    Write-ErrorMsg "$Name did not respond within $TimeoutSeconds seconds."
    return $false
}

function Start-Backend($ProjectDir, $PythonExe) {
    Write-Info "Starting Flask backend..."
    $backendOutLog = Join-Path $ProjectDir 'backend.log'
    $backendErrLog = Join-Path $ProjectDir 'backend-error.log'
    $env:FLASK_ENV = 'development'

    $process = Start-Process -FilePath $PythonExe `
        -ArgumentList 'app.py' `
        -WorkingDirectory $ProjectDir `
        -RedirectStandardOutput $backendOutLog `
        -RedirectStandardError $backendErrLog `
        -NoNewWindow `
        -PassThru

    Write-Info "Backend PID: $($process.Id)"
    Write-Info "Backend stdout: $backendOutLog"
    Write-Info "Backend stderr: $backendErrLog"
    return $process
}

function Start-Frontend($FrontendDir) {
    Write-Info "Starting Vite frontend..."
    $frontendOutLog = Join-Path $FrontendDir 'frontend.log'
    $frontendErrLog = Join-Path $FrontendDir 'frontend-error.log'

    $npm = Ensure-Command 'npm'
    $process = Start-Process -FilePath $npm.Source `
        -ArgumentList 'run', 'dev' `
        -WorkingDirectory $FrontendDir `
        -RedirectStandardOutput $frontendOutLog `
        -RedirectStandardError $frontendErrLog `
        -NoNewWindow `
        -PassThru

    Write-Info "Frontend PID: $($process.Id)"
    Write-Info "Frontend stdout: $frontendOutLog"
    Write-Info "Frontend stderr: $frontendErrLog"
    return $process
}

$ProjectDir = Get-ScriptRoot
$FrontendDir = Join-Path $ProjectDir 'blockvault-frontend-new'
$VenvDir = Join-Path $ProjectDir 'venv'

Write-Host ''
Write-Host '===============================================' -ForegroundColor Blue
Write-Host '    BlockVault Startup (Windows / PowerShell)   ' -ForegroundColor Blue
Write-Host '===============================================' -ForegroundColor Blue
Write-Host ''

Write-Info "Checking prerequisites..."
$pythonExe = Ensure-Venv -ProjectDir $ProjectDir -VenvDir $VenvDir
Ensure-FrontendDependencies -FrontendDir $FrontendDir

Write-Info "Ensuring ports 5000 and 3000 are free..."
Free-Port -Port 5000
Free-Port -Port 3000
Write-Success "Ports cleared."

$backendProcess = $null
$frontendProcess = $null

try {
    $backendProcess = Start-Backend -ProjectDir $ProjectDir -PythonExe $pythonExe
    if (-not (Wait-ForService -Url 'http://localhost:5000' -Name 'Backend (Flask)')) {
        throw "Backend failed to start. Check backend logs for details."
    }

    $frontendProcess = Start-Frontend -FrontendDir $FrontendDir
    if (-not (Wait-ForService -Url 'http://localhost:3000' -Name 'Frontend (Vite)')) {
        throw "Frontend failed to start. Check frontend logs for details."
    }

    Write-Success "Both services started successfully."
    Write-Info "Opening browser at http://localhost:3000 ..."
    Start-Process 'http://localhost:3000'

    Write-WarningMsg "Press Ctrl+C to stop both services."
    if ($backendProcess -and $frontendProcess) {
        Wait-Process -Id $backendProcess.Id, $frontendProcess.Id
    } elseif ($backendProcess) {
        Wait-Process -Id $backendProcess.Id
    } elseif ($frontendProcess) {
        Wait-Process -Id $frontendProcess.Id
    }
} finally {
    Write-Info "Shutting down services..."
    if ($frontendProcess -and -not $frontendProcess.HasExited) {
        try {
            Stop-Process -Id $frontendProcess.Id -Force
            Write-Info "Stopped frontend (PID $($frontendProcess.Id))."
        } catch {
            Write-WarningMsg "Failed to stop frontend: $($_.Exception.Message)"
        }
    }
    if ($backendProcess -and -not $backendProcess.HasExited) {
        try {
            Stop-Process -Id $backendProcess.Id -Force
            Write-Info "Stopped backend (PID $($backendProcess.Id))."
        } catch {
            Write-WarningMsg "Failed to stop backend: $($_.Exception.Message)"
        }
    }
    Write-Success "Cleanup complete."
}


