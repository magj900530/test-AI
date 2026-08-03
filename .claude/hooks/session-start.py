#!/usr/bin/env python3
"""SessionStart Hook：更新活跃项目 + 根据模式注入系统提示词"""
import json, sys, os

sys.path.insert(0, os.path.join(os.path.expanduser("~"), ".claude", "scripts"))
from state_manager import get_mode

STATE_DIR = os.path.expanduser("~/.claude/state")

# 读取 hook 输入
try:
    input_data = json.loads(sys.stdin.buffer.read().decode("utf-8"))
except:
    input_data = {}

# 从 hook 输入提取 cwd，自动更新活跃项目
cwd = input_data.get("cwd", "") or input_data.get("working_directory", "")
if cwd:
    active_file = os.path.join(STATE_DIR, "active_project.json")
    try:
        with open(active_file, "w", encoding="utf-8") as f:
            json.dump({"cwd": cwd, "set_at": __import__("time").time()}, f)
        print(f"[SessionStart] 活跃项目已更新: {cwd}", file=sys.stderr)
    except Exception as e:
        print(f"[SessionStart] 更新活跃项目失败: {e}", file=sys.stderr)

mode = get_mode()

if mode == "remote":
    sys_msg = (
        "【远程模式 - 微信已连接】\n"
        "- 所有任务完成、编译结果、审查报告需通过以下命令推送到微信：\n"
        "  `python ~/.claude/scripts/notify_wechat.py \"任务摘要\" \"结果详情(可选)\"`\n"
        "- 在执行完每个重要任务后，主动调用上述命令推送结果\n"
        "- 高危操作已配置自动审批转发，你正常执行即可\n"
        "- 非高危操作直接执行，无需确认\n"
        "- 上下文占用达 40% 时自动 compact\n"
        "- 微信端发送的指令会写入 state/inbox/，你可以用 Bash 查看"
    )
else:
    sys_msg = (
        "【本地模式】\n"
        "- 所有交互、弹窗、进度、日志仅 PC 端可见\n"
        "- 不要向微信 iLink Bot 推送任何消息\n"
        "- 正常执行开发任务"
    )

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "permissionDecision": "allow"
    },
    "systemMessage": sys_msg,
}, ensure_ascii=False))
