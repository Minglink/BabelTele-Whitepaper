"""Flask Graphical Web Server + SSE Streaming Engine for BabelTele Super Agent."""
from __future__ import annotations

from dataclasses import asdict
import json
import os
from pathlib import Path
import queue
import string
import threading
from typing import Any

from flask import Flask, Response, jsonify, request, send_from_directory

from babeltele_agent.agent.llm_provider import LLMProviderError, UniversalOpenAIProvider
from babeltele_agent.agent.runner import BabelTeleSuperAgent
from babeltele_agent.config import (
    DEFAULT_SANDBOX_ROOT,
    MODEL_PRESETS,
    AgentSettings,
    load_settings,
    probe_ollama,
    save_settings,
)
from babeltele_agent.protocol.neutralizer import neutralize_prompt

STATIC_DIR = Path(__file__).resolve().parent / "static"


def _list_windows_drives_and_shortcuts(current_workspace: Path) -> dict[str, Any]:
    shortcuts: list[dict[str, str]] = []
    desktop = Path.home() / "Desktop"
    if desktop.exists():
        shortcuts.append({"name": "🖥️ 桌面 (Desktop)", "path": str(desktop.resolve())})
    DEFAULT_SANDBOX_ROOT.mkdir(parents=True, exist_ok=True)
    shortcuts.append({"name": "🧪 默认项目沙箱 (workspaces)", "path": str(DEFAULT_SANDBOX_ROOT.resolve())})
    shortcuts.append({"name": "📂 当前工作区", "path": str(current_workspace.resolve())})

    drives: list[dict[str, str]] = []
    if os.name == "nt":
        for letter in string.ascii_uppercase:
            dp = Path(f"{letter}:\\")
            if dp.exists():
                drives.append({"name": f"磁盘 ({letter}:\\)", "path": str(dp)})
    else:
        drives.append({"name": "根目录 (/)", "path": "/"})
        drives.append({"name": "主目录 (~)", "path": str(Path.home())})

    return {"shortcuts": shortcuts, "drives": drives}


def create_app(initial_settings: AgentSettings | None = None, persist_config: bool = True) -> Flask:
    app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="/static")
    app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0

    settings = initial_settings or load_settings()
    agent = BabelTeleSuperAgent(settings)
    app.config["BT_AGENT"] = agent
    app.config["PERSIST_CONFIG"] = persist_config

    @app.after_request
    def _no_cache(resp: Response) -> Response:
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        resp.headers["Pragma"] = "no-cache"
        return resp

    def _serialize_state() -> dict[str, Any]:
        return {
            "ok": True,
            "settings": agent.settings.masked_dict(),
            "presets": MODEL_PRESETS,
            "running": agent._running,
            "workspace_dir": str(agent.workspace_path),
            "files": agent.env.build_file_tree(),
            "file_changes": [asdict(fc) for fc in agent.env.file_changes[-40:]],
            "terminal_logs": [asdict(tl) for tl in agent.env.terminal_logs[-40:]],
            "header_digest": agent.header_index.render_digest(),
            "telemetry": agent.get_telemetry(),
        }

    @app.get("/")
    def index() -> Response:
        return send_from_directory(str(STATIC_DIR), "index.html")

    @app.get("/api/state")
    def api_state() -> Response:
        return jsonify(_serialize_state())

    @app.post("/api/settings")
    def api_save_settings() -> Response:
        payload = request.get_json(silent=True) or {}
        if app.config["PERSIST_CONFIG"]:
            updated = save_settings(payload)
        else:
            # In-memory update for isolated unit tests
            updated = agent.settings
            for k, v in payload.items():
                if k == "api_key":
                    if isinstance(v, str) and v.strip():
                        updated.api_key = v.strip()
                    elif v == "__CLEAR__":
                        updated.api_key = ""
                elif hasattr(updated, k) and v is not None:
                    setattr(updated, k, v)
            updated.ensure_workspace()

        old_ws = str(agent.workspace_path)
        agent.settings = updated
        agent.env.command_timeout = updated.command_timeout
        if updated.workspace_dir and Path(updated.workspace_dir).resolve() != Path(old_ws).resolve():
            agent.switch_workspace(updated.workspace_dir)

        return jsonify({
            "ok": True,
            "settings": agent.settings.masked_dict(),
            "workspace_dir": str(agent.workspace_path),
            "files": agent.env.build_file_tree(),
            "telemetry": agent.get_telemetry(),
        })

    @app.post("/api/settings/test")
    def api_test_settings() -> Response:
        payload = request.get_json(silent=True) or {}
        temp = AgentSettings(
            provider_id=str(payload.get("provider_id") or agent.settings.provider_id),
            base_url=str(payload.get("base_url") or agent.settings.base_url),
            api_key=(
                str(payload["api_key"]).strip()
                if isinstance(payload.get("api_key"), str) and payload["api_key"].strip()
                else agent.settings.api_key
            ),
            model=str(payload.get("model") or agent.settings.model),
            workspace_dir=str(agent.workspace_path),
        )
        try:
            res = UniversalOpenAIProvider(temp).test_connection()
            return jsonify(res)
        except LLMProviderError as exc:
            return jsonify({"ok": False, "error": str(exc)})
        except Exception as exc:
            return jsonify({"ok": False, "error": f"连接异常：{exc}"})

    @app.get("/api/ollama/probe")
    def api_ollama_probe() -> Response:
        base_url = request.args.get("base_url", "http://127.0.0.1:11434")
        return jsonify(probe_ollama(base_url))

    @app.get("/api/fs/browse")
    def api_fs_browse() -> Response:
        raw_path = (request.args.get("path") or "").strip()
        nav_meta = _list_windows_drives_and_shortcuts(agent.workspace_path)
        if not raw_path:
            target = agent.workspace_path
        elif raw_path == "__ROOT__":
            return jsonify({
                "ok": True,
                "current": "",
                "parent": "",
                "dirs": [],
                **nav_meta,
            })
        else:
            target = Path(raw_path).expanduser()

        try:
            target = target.resolve()
            if not target.exists() or not target.is_dir():
                target = agent.workspace_path
        except Exception:
            target = agent.workspace_path

        skip_names = {"$Recycle.Bin", "System Volume Information", "node_modules", "__pycache__", ".git"}
        dirs: list[dict[str, str]] = []
        try:
            for item in sorted(target.iterdir(), key=lambda p: p.name.lower()):
                if item.name in skip_names or item.name.startswith("."):
                    continue
                try:
                    if item.is_dir():
                        dirs.append({"name": item.name, "path": str(item.resolve())})
                except PermissionError:
                    continue
                if len(dirs) >= 200:
                    break
        except PermissionError:
            pass

        parent_str = str(target.parent.resolve()) if target.parent != target else "__ROOT__"
        return jsonify({
            "ok": True,
            "current": str(target),
            "parent": parent_str,
            "dirs": dirs,
            **nav_meta,
        })

    @app.post("/api/workspace/select")
    def api_workspace_select() -> Response:
        payload = request.get_json(silent=True) or {}
        base_path = str(payload.get("path") or "").strip()
        create_name = str(payload.get("create_name") or "").strip()
        if not base_path:
            return jsonify({"ok": False, "error": "请选择有效的文件夹路径。"}), 400

        target = Path(base_path).expanduser().resolve()
        if create_name:
            safe_name = "".join(c for c in create_name if c not in r'<>:"/\|?*').strip()
            if not safe_name:
                return jsonify({"ok": False, "error": "新建项目文件夹名称不合法。"}), 400
            target = (target / safe_name).resolve()

        try:
            new_ws = agent.switch_workspace(str(target))
            if app.config["PERSIST_CONFIG"]:
                save_settings({"workspace_dir": str(new_ws)})
            return jsonify(_serialize_state())
        except Exception as exc:
            return jsonify({"ok": False, "error": f"切换工作区失败：{exc}"}), 400

    @app.get("/api/workspace/file")
    def api_workspace_file() -> Response:
        rel_path = (request.args.get("path") or "").strip()
        if not rel_path:
            return jsonify({"ok": False, "error": "缺少文件路径参数"}), 400
        try:
            target = agent.env._resolve_safe(rel_path)
            if not target.exists() or not target.is_file():
                return jsonify({"ok": False, "error": f"文件不存在：{rel_path}"}), 404
            rel_norm = str(target.relative_to(agent.workspace_path)).replace("\\", "/")
            text = target.read_text(encoding="utf-8", errors="replace")
            agent.header_index.update_file(rel_norm, text)

            latest_diff = ""
            pure_code = True
            purity_issues: list[str] = []
            for fc in reversed(agent.env.file_changes):
                if fc.path == rel_norm:
                    latest_diff = fc.diff
                    pure_code = fc.pure_code
                    purity_issues = fc.purity_issues
                    break

            hdr_entry = agent.header_index.headers.get(rel_norm)
            return jsonify({
                "ok": True,
                "path": rel_norm,
                "size": target.stat().st_size,
                "content": text[:120_000],
                "diff": latest_diff,
                "pure_code": pure_code,
                "purity_issues": purity_issues,
                "bt_header": str(hdr_entry["bt_header"]) if hdr_entry else "",
            })
        except Exception as exc:
            return jsonify({"ok": False, "error": str(exc)}), 400

    @app.post("/api/neutralize")
    def api_neutralize() -> Response:
        payload = request.get_json(silent=True) or {}
        text = str(payload.get("text") or "").strip()
        use_llm = bool(payload.get("use_llm", False))
        if not text:
            return jsonify({"ok": False, "error": "请先输入需要提纯的需求描述。"}), 400

        llm_fn = None
        if use_llm and agent.settings.is_configured():
            provider = UniversalOpenAIProvider(agent.settings)
            llm_fn = lambda msgs: provider.complete_text(msgs, max_tokens=420)

        result = neutralize_prompt(text, llm_call=llm_fn)
        return jsonify({"ok": True, **result})

    @app.post("/api/agent/stream")
    def api_agent_stream() -> Response:
        payload = request.get_json(silent=True) or {}
        prompt = str(payload.get("prompt") or "").strip()
        auto_neutralize = bool(payload.get("auto_neutralize", False))

        if not prompt:
            return jsonify({"ok": False, "error": "任务指令不能为空。"}), 400

        event_q: queue.Queue[dict[str, Any] | None] = queue.Queue()

        def _sse_pack(obj: dict[str, Any]) -> str:
            return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"

        if not agent.settings.is_configured():
            def _unconfigured_gen():
                yield _sse_pack({
                    "type": "error",
                    "error_kind": "unconfigured",
                    "message": "尚未配置大模型 API Key！请在自动弹出的「模型与密钥设置」中填入 DeepSeek / 通义千问 / OpenAI 密钥，或一键探测本机 Ollama 模型。",
                })
                yield _sse_pack({"type": "done", **_serialize_state()})

            return Response(_unconfigured_gen(), mimetype="text/event-stream")

        if agent._running:
            def _busy_gen():
                yield _sse_pack({
                    "type": "error",
                    "error_kind": "busy",
                    "message": "当前已有任务正在执行，请等待完成或点击「停止执行」。",
                })
                yield _sse_pack({"type": "done", **_serialize_state()})

            return Response(_busy_gen(), mimetype="text/event-stream")

        def _worker() -> None:
            try:
                agent.run_task(
                    user_prompt=prompt,
                    emit=lambda ev: event_q.put(ev),
                    auto_neutralize_input=auto_neutralize,
                )
            finally:
                event_q.put(None)

        threading.Thread(target=_worker, daemon=True).start()

        def _event_stream():
            yield _sse_pack({"type": "task_accepted", "prompt": prompt})
            while True:
                try:
                    ev = event_q.get(timeout=0.8)
                    if ev is None:
                        break
                    yield _sse_pack(ev)
                except queue.Empty:
                    yield ": heartbeat\n\n"
            yield _sse_pack({"type": "done", **_serialize_state()})

        headers = {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
        return Response(_event_stream(), headers=headers)

    @app.post("/api/agent/stop")
    def api_agent_stop() -> Response:
        agent.cancel()
        return jsonify({"ok": True})

    @app.post("/api/agent/reset")
    def api_agent_reset() -> Response:
        if agent._running:
            agent.cancel()
        agent.reset_session()
        return jsonify(_serialize_state())

    @app.post("/api/memory/compact")
    def api_memory_compact() -> Response:
        res = agent.compact_now(keep_recent=2)
        return jsonify({"ok": True, **res, "telemetry": agent.get_telemetry()})

    @app.get("/api/memory/deref")
    def api_memory_deref() -> Response:
        node_id = (request.args.get("node_id") or "").strip()
        raw_msgs = agent.smft.dereference(node_id)
        return jsonify({"ok": True, "node_id": node_id, "messages": raw_msgs})

    return app


def run_server(host: str = "127.0.0.1", port: int = 3720, open_browser: bool = False) -> None:
    app = create_app()
    url = f"http://{host}:{port}"
    print("=" * 68)
    print("  ⚡ BabelTele Super Agent (巴别语极速超级 Agent 图形工作台)")
    print(f"  🌐 本地控制台地址: {url}")
    print("  📦 内核架构: SWE-agent/mini-swe-agent + HKUDS/nanobot + BT-Spec v1.0")
    print("=" * 68)
    if open_browser:
        import webbrowser

        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    app.run(host=host, port=port, debug=False, threaded=True, use_reloader=False)
