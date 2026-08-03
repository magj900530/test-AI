#!/usr/bin/env python3
"""PostToolUse Hook：记录工具执行 + 远程模式写进度到 last_action.json"""
import json, sys, os, time

sys.path.insert(0, os.path.join(os.path.expanduser("~"), ".claude", "scripts"))
from state_manager import get_mode

STATE_DIR = os.path.expanduser("~/.claude/state")
os.makedirs(STATE_DIR, exist_ok=True)

try:
    input_data = json.loads(sys.stdin.read())
except:
    input_data = {}

tool_name = input_data.get("tool_name", "unknown")
tool_input = input_data.get("tool_input", {})

# 记录动作
action = {
    "tool": tool_name,
    "timestamp": time.time(),
    "mode": get_mode(),
}

with open(os.path.join(STATE_DIR, "last_action.json"), "w", encoding="utf-8") as f:
    json.dump(action, f, ensure_ascii=False)

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PostToolUse",
        "permissionDecision": "allow"
    }
}))
