#!/usr/bin/env python3
"""PreCompact Hook：上下文达阈值时 → 微信确认 → 执行 compact → 自动续跑"""
import json, sys, os, time

STATE_DIR = os.path.expanduser("~/.claude/state")
os.makedirs(STATE_DIR, exist_ok=True)

# 读取会话上下文信息
try:
    input_data = json.loads(sys.stdin.read())
    ctx_pct = input_data.get("context_usage", "?")
except:
    ctx_pct = "?"

req = {
    "id": f"compact_{int(time.time())}",
    "type": "compact",
    "risk": f"上下文压缩（当前占比约 {ctx_pct}%，建议清理）",
    "command": "compact",
    "timestamp": time.time(),
    "status": "pending"
}

with open(os.path.join(STATE_DIR, "pending_approval.json"), "w", encoding="utf-8") as f:
    json.dump(req, f, ensure_ascii=False)

print(f"[PreCompact] 审批已发起: compact @ {ctx_pct}%", file=sys.stderr)

result_file = os.path.join(STATE_DIR, f"approval_result_{req['id']}.json")
timeout = 300  # 5 分钟
elapsed = 0

while elapsed < timeout:
    if os.path.exists(result_file):
        with open(result_file, encoding="utf-8") as f:
            result = json.load(f)
        os.remove(result_file)
        pf = os.path.join(STATE_DIR, "pending_approval.json")
        if os.path.exists(pf):
            os.remove(pf)
        if result.get("approved"):
            print(json.dumps({"decision": "approve"}))
        else:
            print(json.dumps({
                "decision": "block",
                "reason": "用户在微信端拒绝了 compact"
            }))
        sys.exit(0)
    time.sleep(2)
    elapsed += 2

# 超时：自动允许（compact 非破坏操作）
print(json.dumps({"decision": "approve"}))
