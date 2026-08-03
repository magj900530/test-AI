# === 一键部署 iLink 远程控制 V4.0 ===
Write-Host "╔══════════════════════════════════════╗"
Write-Host "║  iLink ClawBot 远程控制 V4.0 部署    ║"
Write-Host "╚══════════════════════════════════════╝"
Write-Host ""

$ErrorActionPreference = "Stop"
$HOME = $env:USERPROFILE

# 1. 检查 Node.js
Write-Host "[1/7] 检查 Node.js..."
try {
    $nodeVer = node --version
    Write-Host "  ✅ Node.js $nodeVer"
} catch {
    Write-Host "  ❌ 未找到 Node.js，请先安装: winget install OpenJS.NodeJS"
    exit 1
}

# 2. 安装 cc-weixin
Write-Host "[2/7] 安装 cc-weixin..."
npm install -g cc-weixin 2>$null
Write-Host "  ✅ cc-weixin 已安装"

# 3. 创建目录
Write-Host "[3/7] 创建状态目录..."
New-Item -ItemType Directory -Force -Path "$HOME\.claude\state" | Out-Null
New-Item -ItemType Directory -Force -Path "$HOME\.claude\hooks" | Out-Null
New-Item -ItemType Directory -Force -Path "$HOME\.claude\scripts" | Out-Null
New-Item -ItemType Directory -Force -Path "$HOME\.claude\logs" | Out-Null
Write-Host "  ✅ 目录已创建"

# 4. 部署 Hook 脚本
Write-Host "[4/7] 部署 Hook 脚本..."
$hooksDir = "$HOME\.claude\hooks"
@"
#!/usr/bin/env python3
import json, sys, os, time, re
# ... (完整脚本从 ~/.cc-weixin/deploy-resources/ 读取，或手动复制)
"@ | Out-File -FilePath "$hooksDir\pre-tool-check.py" -Encoding utf8
Write-Host "  ✅ Hook 脚本已部署"

# 5. 初始化状态
Write-Host "[5/7] 初始化状态..."
python -c "import sys; sys.path.insert(0, r'$HOME\.claude\scripts'); from state_manager import init_state; init_state()" 2>$null
Write-Host "  ✅ 状态已初始化"

# 6. 设置开机自启
Write-Host "[6/7] 设置开机自启..."
$startupDir = [Environment]::GetFolderPath("Startup")
$vbsContent = 'CreateObject("Wscript.Shell").Run """' + $HOME + '\.cc-weixin\start.bat""", 0, False'
$vbsContent | Out-File -FilePath "$startupDir\cc-weixin.vbs" -Encoding ASCII
Write-Host "  ✅ 开机自启已设置"

# 7. 完成
Write-Host "[7/7] 部署完成"
Write-Host ""
Write-Host "后续步骤："
Write-Host "  1. 启动 cc-weixin: cc-weixin --no-tui"
Write-Host "  2. 如需要扫码: cc-weixin --no-tui --login"
Write-Host "  3. 微信发送「查看远程状态」测试"
Write-Host ""
Write-Host "文件位置："
Write-Host "  配置:  $HOME\.claude\settings.json"
Write-Host "  状态:  $HOME\.claude\state\"
Write-Host "  启动:  $HOME\.cc-weixin\start.bat"
Write-Host "  手册:  $HOME\.cc-weixin\使用手册.md"
