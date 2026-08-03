#!/usr/bin/env python3
"""共享状态管理模块 — Hook 脚本 + cc-weixin 共用
模式管理 / 项目检测 / 密钥脱敏 / 状态报告"""
import json, os, time, re, subprocess

STATE_DIR = os.path.expanduser("~/.claude/state")
MODE_FILE = os.path.join(STATE_DIR, "mode_state.json")
os.makedirs(STATE_DIR, exist_ok=True)

# ====== 模式管理 ======
def get_mode():
    try:
        with open(MODE_FILE, encoding="utf-8") as f:
            return json.load(f).get("mode", "local")
    except:
        return "local"

def set_mode(mode):
    with open(MODE_FILE, "w", encoding="utf-8") as f:
        json.dump({"mode": mode, "updated_at": time.time()}, f, ensure_ascii=False)

# ====== 项目检测 ======
def get_active_project():
    """读取 cc-weixin 写入的 active_project.json，提取目录名"""
    try:
        apf = os.path.join(STATE_DIR, "active_project.json")
        if os.path.exists(apf):
            with open(apf, encoding="utf-8") as f:
                cwd = json.load(f).get("cwd", "")
                if cwd:
                    return os.path.basename(cwd)
    except:
        pass
    return "未知"

# ====== 密钥脱敏 ======
SENSITIVE_PATTERNS = [
    (r'sk-[a-zA-Z0-9]{20,}', 'sk-***'),
    (r'Bearer [a-zA-Z0-9_\-\.]{20,}', 'Bearer ***'),
    (r'ANTHROPIC_AUTH_TOKEN[=:]\s*["\']?[a-zA-Z0-9_\-]{10,}', 'ANTHROPIC_AUTH_TOKEN=***'),
    (r'password["\']?\s*[:=]\s*["\'][^"\']+["\']', 'password=***'),
    (r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', '[IP]'),
]

def sanitize(text):
    for pattern, replacement in SENSITIVE_PATTERNS:
        text = re.sub(pattern, replacement, text)
    return text

# ====== 状态报告 ======
def get_status():
    """生成完整状态报告"""
    mode = get_mode()
    project = get_active_project()

    # 上下文占比（从 Claude 日志估算）
    ctx_pct = "N/A"

    # 运行时长
    uptime = "N/A"
    try:
        with open(os.path.join(STATE_DIR, "started_at"), "r") as f:
            started = float(f.read().strip())
            uptime = f"{int((time.time() - started) / 60)}m"
    except:
        pass

    # 审批队列
    pending = "0"
    pf = os.path.join(STATE_DIR, "pending_approval.json")
    if os.path.exists(pf):
        try:
            with open(pf, encoding="utf-8") as f:
                pdata = json.load(f)
                if pdata.get("status") in ("pending", "sent"):
                    pending = "1"
        except:
            pass

    # cc-weixin 进程检测 — 通过 PID 文件
    ccwx_running = False
    pid_file = os.path.join(STATE_DIR, "cc-weixin.pid")
    try:
        if os.path.exists(pid_file):
            with open(pid_file) as f:
                pid = int(f.read().strip())
            if pid > 0:
                # 检查该 PID 是否仍在运行
                result = subprocess.run(
                    ["tasklist", "/fi", f"PID eq {pid}"],
                    capture_output=True, text=True, timeout=5
                )
                ccwx_running = "node.exe" in result.stdout
    except:
        pass

    return {
        "mode": mode,
        "project": project or "未知",
        "context_pct": ctx_pct,
        "uptime": uptime,
        "pending_approvals": pending,
        "cc_weixin": "运行中" if ccwx_running else "未运行",
    }

def format_status():
    s = get_status()
    return (
        f"📊 远程状态报告\n"
        f"━━━━━━━━━━━━━━━━\n"
        f"模式：{'🟢 远程' if s['mode'] == 'remote' else '🔵 本地'}\n"
        f"项目：{s['project']}\n"
        f"上下文：{s['context_pct']}\n"
        f"运行时长：{s['uptime']}\n"
        f"审批队列：{s['pending_approvals']} 个\n"
        f"cc-weixin：{s['cc_weixin']}\n"
        f"━━━━━━━━━━━━━━━━"
    )

# ====== 初始化 ======
def init_state():
    """首次运行时初始化状态文件"""
    if not os.path.exists(MODE_FILE):
        set_mode("local")
    # 记录启动时间
    started_at = os.path.join(STATE_DIR, "started_at")
    if not os.path.exists(started_at):
        with open(started_at, "w") as f:
            f.write(str(time.time()))

if __name__ == "__main__":
    init_state()
    print(format_status())
