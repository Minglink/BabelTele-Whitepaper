#!/usr/bin/env python3
"""Unified Entrypoint for BabelTele Super Agent (Graphical Web IDE & Headless CLI)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Ensure package import works directly without pip install -e .
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from babeltele_agent.agent.runner import BabelTeleSuperAgent
from babeltele_agent.config import load_settings
from babeltele_agent.web.server import run_server


def main() -> int:
    parser = argparse.ArgumentParser(
        description="BabelTele Super Agent — 巴别语极速超级 Agent (Web 图形工作台 + CLI)"
    )
    parser.add_argument("--host", default="127.0.0.1", help="Web 服务监听地址 (默认 127.0.0.1)")
    parser.add_argument("--port", type=int, default=3720, help="Web 服务端口 (默认 3720)")
    parser.add_argument("--open", action="store_true", help="启动后自动在默认浏览器打开控制台")
    parser.add_argument("--task", type=str, default="", help="可选：以命令行无头模式直接执行单次工程任务")
    parser.add_argument("--workspace", type=str, default="", help="可选：指定任务目标工作区文件夹")
    args = parser.parse_args()

    if args.task.strip():
        settings = load_settings()
        if args.workspace.strip():
            settings.workspace_dir = str(Path(args.workspace).expanduser().resolve())
        agent = BabelTeleSuperAgent(settings)

        def _cli_emit(ev: dict) -> None:
            t = ev.get("type")
            if t == "bt_thought":
                print(f"  [Step {ev['step']} #BT] {ev['bt_text']}  ({ev['thought_tokens']} tok)")
            elif t == "tool_start":
                print(f"  [Tool -> {ev['tool']}] {ev.get('args')}")
            elif t == "final_answer":
                print("\n=== 交付结果 ===\n" + str(ev.get("content", "")))
            elif t == "error":
                print(f"\n[ERROR] {ev.get('message')}", file=sys.stderr)

        res = agent.run_task(args.task, emit=_cli_emit, auto_neutralize_input=True)
        return 0 if res.get("ok") else 1

    run_server(host=args.host, port=args.port, open_browser=args.open)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
