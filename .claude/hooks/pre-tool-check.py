#!/usr/bin/env python3
"""PreToolUse Hook：高危操作拦截 + 微信审批（文件协议）
与 cc-weixin 通过 ~/.claude/state/ 目录通信，15 分钟超时自动拒绝"""
import json, sys, os, time, re

STATE_DIR = os.path.expanduser("~/.claude/state")
os.makedirs(STATE_DIR, exist_ok=True)

input_data = json.loads(sys.stdin.buffer.read().decode("utf-8"))
tool_name = input_data.get("tool_name", "")
tool_input = input_data.get("tool_input", {})
command = tool_input.get("command", "") or str(tool_input)
file_path = tool_input.get("file_path", "") or tool_input.get("path", "")

# ====== 高危模式匹配 ======
DANGEROUS = [
    (r"rm\s+-rf", "强制递归删除"),
    (r"rmdir\s+/s", "强制删除目录"),
    (r"del\s+/f", "强制删除文件"),
    (r"del\s+/s", "递归删除"),
    (r"git\s+push\s+--force", "强制推送"),
    (r"git\s+push\s+-f", "强制推送"),
    (r"chmod\s+777", "权限全开"),
    (r"chmod\s+-R", "递归改权"),
    (r"\bDROP\s+", "删除数据库/表"),
    (r"\bDELETE\s+FROM", "批量删数据"),
    (r"\bTRUNCATE\b", "清空表数据"),
    (r"format\s+[a-zA-Z]:", "格式化磁盘"),
    (r">\s*/dev/(?!null\b)", "裸写设备"),
    (r"dd\s+if=", "磁盘镜像写入"),
]

SENSITIVE_FILES = [".env", "credentials", "secrets", "settings.json",
                   "package-lock.json", "yarn.lock", ".gitignore",
                   ".claude/settings.json", ".claude/settings.local.json"]

risk_desc = None

# 检查命令模式
if tool_name == "Bash":
    for pattern, desc in DANGEROUS:
        if re.search(pattern, command, re.IGNORECASE):
            risk_desc = desc
            break

# 检查敏感文件（Write/Edit）
if tool_name in ("Write", "Edit") and file_path:
    for sf in SENSITIVE_FILES:
        if sf in file_path.lower():
            risk_desc = f"修改敏感文件: {sf}"
            break

# 安全操作，直接放行
if not risk_desc:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "allow"
        }
    }))
    sys.exit(0)

# ====== 高危操作：发起审批 ======
approval_id = str(int(time.time()))
req = {
    "id": approval_id,
    "tool": tool_name,
    "command": command[:500],
    "file_path": file_path,
    "risk": risk_desc,
    "timestamp": time.time(),
    "status": "pending"
}

with open(os.path.join(STATE_DIR, "pending_approval.json"), "w", encoding="utf-8") as f:
    json.dump(req, f, ensure_ascii=False)

print(f"[PreToolUse] 审批已发起: {risk_desc}", file=sys.stderr)

# 等待审批结果
result_file = os.path.join(STATE_DIR, f"approval_result_{approval_id}.json")
timeout = 900  # 15 分钟
elapsed = 0

while elapsed < timeout:
    if os.path.exists(result_file):
        with open(result_file, encoding="utf-8") as f:
            result = json.load(f)
        os.remove(result_file)
        # 清理 pending
        pf = os.path.join(STATE_DIR, "pending_approval.json")
        if os.path.exists(pf):
            os.remove(pf)
        if result.get("approved"):
            print(json.dumps({
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "allow"
                }
            }))
        else:
            print(json.dumps({
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": f"微信端已拒绝: {risk_desc}"
                }
            }))
        sys.exit(0)

    time.sleep(2)
    elapsed += 2

# 超时：自动拒绝
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": f"审批超时(15分钟)，自动拒绝: {risk_desc}"
    }
}))
sys.exit(0)
