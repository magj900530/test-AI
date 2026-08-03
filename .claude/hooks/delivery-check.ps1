<#
.SYNOPSIS
  Stop hook: 交付验收检查 — 修改了代码/配置/文档但未验证时阻止停止

.DESCRIPTION
  Claude Code Stop hook，在每次 Claude 结束前执行。
  检测本轮是否有未提交的关键文件变更（源代码、配置、文档），
  如果存在变更但未发现验证证据，则阻止停止并提示继续验证。

  验证通过的判定条件（任一即可）：
    1. 工作区干净（所有变更已提交）
    2. 存在验证标记文件且时间戳晚于最早的关键文件变更

  验证标记文件路径：~/.claude/.verified
  可使用 mark-verified.ps1 手动写入标记。

.OUTPUTS
  JSON 格式输出到 stdout，Claude Code 的 hook 系统读取并响应。
  阻止时输出 {"continue": false, "stopReason": "..."}
  允许时输出 {}
#>

$ErrorActionPreference = 'Continue'

# ===== 配置 =====
$verifiedMarkerPath = Join-Path $env:USERPROFILE '.claude\.verified'

# 需要验证的关键文件扩展名列表
$extensions = @(
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts',
    '.vue', '.svelte', '.astro', '.py', '.rs', '.go', '.java', '.rb',
    '.php', '.kt', '.swift', '.scala', '.ex', '.exs', '.hs',
    '.css', '.scss', '.less', '.sass',
    '.html', '.hbs', '.ejs', '.pug', '.jade',
    '.json', '.yaml', '.yml', '.toml', '.xml', '.env',
    '.ini', '.cfg', '.conf', '.editorconfig', '.prettierrc', '.eslintrc',
    '.md', '.markdown', '.txt', '.rst',
    '.sh', '.ps1', '.bat', '.cmd', '.fish', '.zsh',
    '.gradle', '.sbt', '.cake'
)

# 无扩展名的特殊文件名
$specialFiles = @(
    'Dockerfile', 'Makefile', 'docker-compose'
)

# 构建匹配函数
function Test-IsRelevantFile {
    param([string]$FilePath)
    $name = Split-Path $FilePath -Leaf
    $ext = [System.IO.Path]::GetExtension($FilePath)
    if ($ext -ne '' -and $ext -in $extensions) {
        return $true
    }
    if ($name -in $specialFiles) {
        return $true
    }
    return $false
}

# ===== 检测变更 =====
$repoRoot = & git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) {
    Write-Output '{}'
    exit 0
}

# 获取所有未提交的变更（与 HEAD 对比）
$unstaged = @(& git diff --name-only HEAD 2>$null)
$staged = @(& git diff --cached --name-only 2>$null)
$allChanges = @()
$allChanges += $unstaged | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
$allChanges += $staged | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

if ($allChanges.Count -eq 0) {
    Write-Output '{}'
    exit 0
}

# 过滤出关键文件
$relevantChanges = @()
foreach ($f in $allChanges) {
    $normalized = $f -replace '\\', '/'
    if (Test-IsRelevantFile -FilePath $normalized) {
        $relevantChanges += $normalized
    }
}

if ($relevantChanges.Count -eq 0) {
    Write-Output '{}'
    exit 0
}

# ===== 验证检测 =====

# 条件 1: 工作区是否干净（已提交所有变更）
$isClean = $false
$porcelain = & git status --porcelain 2>$null
if ([string]::IsNullOrWhiteSpace($porcelain)) {
    $isClean = $true
}

# 条件 2: 验证标记文件是否存在且有效
$isMarked = $false
if ((-not $isClean) -and (Test-Path $verifiedMarkerPath)) {
    $markerTime = (Get-Item $verifiedMarkerPath).LastWriteTime
    $earliestChange = $null
    foreach ($f in $relevantChanges) {
        $fullPath = Join-Path $repoRoot $f
        if (Test-Path $fullPath) {
            try {
                $fileTime = (Get-Item $fullPath).LastWriteTime
                if (($null -eq $earliestChange) -or ($fileTime -lt $earliestChange)) {
                    $earliestChange = $fileTime
                }
            } catch {
                # 忽略无法读取的文件
            }
        }
    }
    if (($null -ne $earliestChange) -and ($markerTime -gt $earliestChange)) {
        $isMarked = $true
    }
}

# ===== 判定 =====
if ($isClean -or $isMarked) {
    Write-Output '{}'
    exit 0
}

# ===== 阻止停止 =====
$fileList = $relevantChanges -join "`n  - "
$stopReason = @"
❌ 交付验收未通过

本轮修改了以下关键文件（需要验证）：
  - $fileList

根据项目规则，修改代码/配置/文档后必须完成以下验证才能结束：
1. 运行测试（npm test / pytest / cargo test 等）
2. 运行 lint 检查
3. 运行类型检查（typecheck）
4. 功能验证
5. 检查 TODO 遗留项

请继续完成上述验证。完成后：
- 提交变更（git add + git commit）使工作区干净，或
- 运行 mark-verified 命令写入验证标记

如需强行退出（不推荐），请先确认所有修改已暂存或提交。
"@

$output = @{
    continue = $false
    stopReason = $stopReason
}
Write-Output ($output | ConvertTo-Json -Compress)
exit 0
"@
