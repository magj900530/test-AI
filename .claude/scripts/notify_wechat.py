#!/usr/bin/env python3
"""PC 端 Claude 调用此脚本推送消息到微信
用法: python notify_wechat.py "消息内容" ["结果摘要"]
cc-weixin 轮询 state/notify.json 并转发到微信"""
import json, sys, os, time

STATE_DIR = os.path.expanduser("~/.claude/state")
os.makedirs(STATE_DIR, exist_ok=True)

def main():
    msg = sys.argv[1] if len(sys.argv) > 1 else ""
    result = sys.argv[2] if len(sys.argv) > 2 else ""

    if not msg:
        print("用法: python notify_wechat.py \"消息\" [\"结果摘要\"]", file=sys.stderr)
        sys.exit(1)

    notify = {
        "message": msg,
        "result": result,
        "timestamp": time.time(),
        "sent": False,
    }

    nf = os.path.join(STATE_DIR, "notify.json")
    with open(nf, "w", encoding="utf-8") as f:
        json.dump(notify, f, ensure_ascii=False)

    print(f"[notify] 已写入通知: {msg[:80]}", file=sys.stderr)

if __name__ == "__main__":
    main()
