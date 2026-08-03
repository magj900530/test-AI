#!/usr/bin/env python3
"""Stop Hook：会话结束时自动 git add → commit → push，防止离开电脑后丢代码"""
import subprocess, os, sys, json

# 读取 hook 输入
try:
    input_data = json.loads(sys.stdin.read())
except:
    input_data = {}

# 活跃项目根目录（从 state 读取，fallback 到 hotel-compare）
STATE_DIR = os.path.expanduser("~/.claude/state")
active_project = "D:/AI项目/hotel-compare"
try:
    apf = os.path.join(STATE_DIR, "active_project.json")
    if os.path.exists(apf):
        with open(apf) as f:
            ap = json.load(f)
        active_project = ap.get("cwd", active_project)
except:
    pass

os.chdir(active_project)

# 检查是否有改动
r = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True)
if not r.stdout.strip():
    print("[auto-save] 无未提交改动，跳过", file=sys.stderr)
    sys.exit(0)

changes = r.stdout.strip().split("\n")
print(f"[auto-save] 检测到 {len(changes)} 个文件有改动", file=sys.stderr)

# git add -A
subprocess.run(["git", "add", "-A"], capture_output=True)

# 生成 commit message
from datetime import datetime
ts = datetime.now().strftime("%Y-%m-%d %H:%M")
msg = f"auto: session snapshot {ts}"
subprocess.run(["git", "commit", "-m", msg], capture_output=True)

# git push
r = subprocess.run(["git", "push"], capture_output=True, text=True)
if r.returncode == 0:
    print(f"[auto-save] ✅ 已提交并推送: {msg}", file=sys.stderr)
else:
    print(f"[auto-save] ⚠️ push 失败: {r.stderr[:200]}", file=sys.stderr)
