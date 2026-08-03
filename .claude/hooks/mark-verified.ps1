<#
.SYNOPSIS
  写入验证标记，标记本轮验证已完成。

.DESCRIPTION
  当交付验收检查通过后，此脚本写入一个时间戳标记文件。
  delivery-check.ps1（Stop hook）会检查此标记的存在和时效性。

  用法：
    PowerShell:   & "$env:USERPROFILE\.claude\hooks\mark-verified.ps1"
    Claude:       运行 mark-verified 命令

  此标记仅用于交付验收 hook 的检测，不影响任何其他功能。
  标记文件位置：~/.claude/.verified
#>

$ErrorActionPreference = 'Stop'
$markerPath = Join-Path $env:USERPROFILE '.claude\.verified'

try {
    # 写入当前时间戳
    Get-Date | Out-File -FilePath $markerPath -Encoding utf8 -Force
    Write-Host "✅ 验证标记已写入：$markerPath"
    Write-Host "   时间戳：$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Write-Host ""
    Write-Host "下次 Stop hook 触发时，交付验收检查将通过。"
}
catch {
    Write-Host "❌ 写入验证标记失败：$($_.Exception.Message)"
    exit 1
}
