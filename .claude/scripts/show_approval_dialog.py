#!/usr/bin/env python3
"""PC 端高危审批弹窗 — 由 pre-tool-check.py 后台调用
显示模态对话框，告知用户此操作已推送微信审批"""
import json, sys, os, ctypes

if len(sys.argv) < 2:
    sys.exit(1)

info_file = sys.argv[1]
if not os.path.exists(info_file):
    sys.exit(1)

with open(info_file, encoding="utf-8") as f:
    info = json.load(f)

message = (
    f"风险：{info.get('risk', 'N/A')}\n"
    f"工具：{info.get('tool', 'N/A')}\n"
    f"文件：{info.get('file_path', 'N/A')}\n"
    f"命令：{info.get('command', 'N/A')[:200]}\n\n"
    f"已推送微信审批，请在微信回复「同意」或「拒绝」\n"
    f"（15 分钟超时自动拒绝）"
)

MB_ICONWARNING = 0x30
MB_OK = 0x0
MB_SYSTEMMODAL = 0x1000

ctypes.windll.user32.MessageBoxW(
    0,
    message,
    "⚠️ 高危操作审批 — 等待微信确认",
    MB_ICONWARNING | MB_OK | MB_SYSTEMMODAL,
)
