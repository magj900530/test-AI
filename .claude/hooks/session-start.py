#!/usr/bin/env python3
"""SessionStart Hook：根据模式注入系统提示词"""
import json, sys, os

sys.path.insert(0, os.path.join(os.path.expanduser("~"), ".claude", "scripts"))
from state_manager import get_mode

mode = get_mode()

if mode == "remote":
    sys_msg = (
        "【远程模式】\n"
        "- 所有任务进度、编译结果、报错信息需简洁推送至微信 iLink Bot\n"
        "- 高危操作已配置自动审批转发，你正常执行即可，无需询问用户\n"
        "- 非高危操作直接执行，无需确认\n"
        "- 任务完成后自动运行编译/测试并通知用户\n"
        "- 上下文占用达 40% 时自动 compact"
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
