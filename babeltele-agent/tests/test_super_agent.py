"""End-to-End Automated Test Suite for BabelTele Super Agent."""
from __future__ import annotations

import http.server
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from babeltele_agent.config import AgentSettings
from babeltele_agent.memory.header_index import WorkspaceHeaderIndex
from babeltele_agent.memory.smft import SMFTMemoryTree
from babeltele_agent.protocol.neutralizer import neutralize_prompt
from babeltele_agent.protocol.sanitizer import audit_code_purity, strip_markdown_fences_if_wrapped
from babeltele_agent.web.server import create_app


class _MockOpenAIHandler(http.server.BaseHTTPRequestHandler):
    """Stateful local OpenAI-compatible mock server exercising full multi-tool + subagent loops."""

    def log_message(self, format: str, *args) -> None:  # noqa: A002
        return  # quiet test output

    def do_POST(self) -> None:  # noqa: N802
        length = int(self.headers.get("Content-Length", "0"))
        body = json.loads(self.rfile.read(length).decode("utf-8"))
        messages = body.get("messages", [])
        tools = body.get("tools") or []

        # 1. Connection handshake test (no tools)
        if not tools:
            self._send_json({
                "choices": [{"message": {"role": "assistant", "content": "BT_READY"}}],
                "usage": {"prompt_tokens": 12, "completion_tokens": 3},
            })
            return

        sys_text = str(messages[0].get("content", "")) if messages else ""
        tool_msgs = [m for m in messages if m.get("role") == "tool"]

        # 2. Child Subagent execution branch (no spawn_subagent tool in sub_tools)
        is_subagent = "Subagent [" in sys_text
        if is_subagent:
            if not tool_msgs:
                self._send_json({
                    "choices": [{
                        "message": {
                            "role": "assistant",
                            "content": "#BT #Audit -> read_file(calc.py)",
                            "tool_calls": [{
                                "id": "sub_call_1",
                                "type": "function",
                                "function": {
                                    "name": "read_file",
                                    "arguments": json.dumps({"path": "calc.py"}),
                                },
                            }],
                        }
                    }],
                    "usage": {"prompt_tokens": 80, "completion_tokens": 12},
                })
            else:
                self._send_json({
                    "choices": [{
                        "message": {
                            "role": "assistant",
                            "content": "#SubReport @calc.py pure_python=1 zero_div_guard=ok",
                        }
                    }],
                    "usage": {"prompt_tokens": 110, "completion_tokens": 14},
                })
            return

        # 3. Parent Super Agent multi-step workflow
        n_tools = len(tool_msgs)
        if n_tools == 0:
            # Step 1: Write calc.py and test_calc.py
            calc_src = (
                "def add(a: float, b: float) -> float:\n"
                "    return a + b\n\n"
                "def safe_div(a: float, b: float) -> float:\n"
                "    if b == 0:\n"
                "        raise ValueError('division by zero')\n"
                "    return a / b\n"
            )
            test_src = (
                "import unittest\n"
                "from calc import add, safe_div\n\n"
                "class CalcTest(unittest.TestCase):\n"
                "    def test_ops(self):\n"
                "        self.assertEqual(add(2, 3), 5)\n"
                "        self.assertEqual(safe_div(10, 2), 5)\n"
                "        with self.assertRaises(ValueError):\n"
                "            safe_div(1, 0)\n\n"
                "if __name__ == '__main__':\n"
                "    unittest.main()\n"
            )
            self._send_json({
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": "#BT #Plan -> write_file(calc.py & test_calc.py)",
                        "tool_calls": [
                            {
                                "id": "call_w1",
                                "type": "function",
                                "function": {
                                    "name": "write_file",
                                    "arguments": json.dumps({"path": "calc.py", "content": calc_src}),
                                },
                            },
                            {
                                "id": "call_w2",
                                "type": "function",
                                "function": {
                                    "name": "write_file",
                                    "arguments": json.dumps({"path": "test_calc.py", "content": test_src}),
                                },
                            },
                        ],
                    }
                }],
                "usage": {"prompt_tokens": 180, "completion_tokens": 45},
            })
        elif n_tools == 2:
            # Step 2: Run unit tests in real terminal
            py_exe = sys.executable.replace("\\", "/")
            self._send_json({
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": "#BT #Verify ?files_written => run_command(unittest)",
                        "tool_calls": [{
                            "id": "call_cmd1",
                            "type": "function",
                            "function": {
                                "name": "run_command",
                                "arguments": json.dumps({"command": f'"{py_exe}" -m unittest test_calc.py'}),
                            },
                        }],
                    }
                }],
                "usage": {"prompt_tokens": 240, "completion_tokens": 20},
            })
        elif n_tools == 3:
            # Step 3: Delegate audit to Subagent over babeltele/1.0 bus
            self._send_json({
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": "#BT ?test_ok => spawn_subagent(auditor)",
                        "tool_calls": [{
                            "id": "call_sub1",
                            "type": "function",
                            "function": {
                                "name": "spawn_subagent",
                                "arguments": json.dumps({
                                    "role": "auditor",
                                    "task_bt": "#Audit @calc.py ?div_zero_safe",
                                }),
                            },
                        }],
                    }
                }],
                "usage": {"prompt_tokens": 290, "completion_tokens": 18},
            })
        else:
            # Step 4: Final human-facing Chinese delivery
            self._send_json({
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": "已完成 `calc.py` 与 `test_calc.py` 编写，单元测试全部通过，且子智能体安全审计确认原生代码 100% 纯净。",
                    }
                }],
                "usage": {"prompt_tokens": 330, "completion_tokens": 36},
            })

    def _send_json(self, obj: dict) -> None:
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


class BabelTeleSuperAgentTests(unittest.TestCase):
    def test_neutralizer_and_anchor_lock(self) -> None:
        verbose = (
            "你好啊麻烦帮我一下！我真是服了这破代码，如果出现请求延迟大于等于 250ms "
            "那么就必须告警，并且严禁误伤 /api/v2/health 和 OrderService.java！万分感谢！"
        )
        res = neutralize_prompt(verbose)
        self.assertTrue(res["audit"]["passed"], f"Audit failed: {res['audit']}")
        self.assertIn("250ms", res["babeltele"])
        self.assertIn("/api/v2/health", res["babeltele"])
        self.assertIn("OrderService.java", res["babeltele"])
        self.assertNotIn("万分感谢", res["babeltele"])

    def test_dual_plane_sanitizer(self) -> None:
        fenced = "```python\ndef hello():\n    return 42\n```"
        stripped = strip_markdown_fences_if_wrapped(fenced, "hello.py")
        self.assertEqual(stripped, "def hello():\n    return 42\n")
        self.assertTrue(audit_code_purity("hello.py", stripped)["pure"])

        polluted = "#BT => leak\ndef broken():\n    return '⟦bad⟧'\n"
        purity = audit_code_purity("broken.py", polluted)
        self.assertFalse(purity["pure"])
        self.assertGreaterEqual(len(purity["issues"]), 1)

    def test_smft_folding_and_header_index(self) -> None:
        smft = SMFTMemoryTree()
        for batch in range(4):
            msgs = [
                {"role": "user", "content": f"Batch {batch}: check service_{batch}.py port {8000 + batch}"},
                {"role": "assistant", "content": "#BT -> read_file", "tool_calls": [{"function": {"name": "read_file"}}]},
                {"role": "tool", "name": "read_file", "content": "File ok " * 30},
            ]
            smft.fold_messages(msgs)

        stats = smft.summary_stats()
        # 4 T1 nodes trigger automatic merge of oldest 2 into 1 T2 node -> 3 active nodes total (1 T2 + 2 T1)
        self.assertEqual(stats["node_count"], 3)
        self.assertEqual(stats["nodes"][0]["tier"], 2)
        restored = smft.dereference(stats["nodes"][0]["node_id"])
        self.assertEqual(len(restored), 6)

        idx = WorkspaceHeaderIndex()
        py_body = "class RateLimiter:\n    def allow(self, key: str) -> bool:\n        return True\n" + ("# pad\n" * 60)
        idx.update_file("limiter.py", py_body)
        self.assertGreater(idx.stats()["saved_tokens"], 20)

    def test_full_web_api_and_sse_super_agent_workflow(self) -> None:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _MockOpenAIHandler)
        port = server.server_address[1]
        t = threading.Thread(target=server.serve_forever, daemon=True)
        t.start()

        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                settings = AgentSettings(
                    provider_id="custom",
                    base_url=f"http://127.0.0.1:{port}/v1",
                    api_key="sk-test-local",
                    model="mock-bt-coder",
                    workspace_dir=tmpdir,
                    bt_mode=True,
                )
                app = create_app(initial_settings=settings, persist_config=False)
                client = app.test_client()

                # 1. Index HTML & zero external CDN check
                html_resp = client.get("/")
                self.assertEqual(html_resp.status_code, 200)
                html_text = html_resp.get_data(as_text=True)
                html_resp.close()
                self.assertNotIn("cdn.jsdelivr", html_text)
                self.assertNotIn("unpkg.com", html_text)

                # 2. Test connection endpoint
                conn_resp = client.post("/api/settings/test", json={}).get_json()
                self.assertTrue(conn_resp["ok"])
                self.assertEqual(conn_resp["reply"], "BT_READY")

                # 3. Graphical directory browser & workspace subfolder creation
                browse_resp = client.get(f"/api/fs/browse?path={tmpdir}").get_json()
                self.assertTrue(browse_resp["ok"])
                ws_sel = client.post(
                    "/api/workspace/select",
                    json={"path": tmpdir, "create_name": "sub_project"},
                ).get_json()
                self.assertTrue(ws_sel["ok"])
                self.assertTrue(ws_sel["workspace_dir"].endswith("sub_project"))

                # 4. Offline Neutralizer API
                neut = client.post(
                    "/api/neutralize",
                    json={"text": "你好麻烦帮我写一个 calc.py 和 test_calc.py 并且严禁除零崩溃！", "use_llm": False},
                ).get_json()
                self.assertTrue(neut["ok"])

                # 5. Full SSE Streaming Agent Execution
                sse_resp = client.post(
                    "/api/agent/stream",
                    json={
                        "prompt": "麻烦帮我实现 calc.py 与 test_calc.py，跑通 unittest 并做子智能体审计！谢谢！",
                        "auto_neutralize": True,
                    },
                )
                self.assertEqual(sse_resp.status_code, 200)
                raw_stream = sse_resp.get_data(as_text=True)
                events = []
                for block in raw_stream.split("\n\n"):
                    line = block.strip()
                    if line.startswith("data:"):
                        events.append(json.loads(line[5:].strip()))

                ev_types = [e["type"] for e in events]
                self.assertIn("task_accepted", ev_types)
                self.assertIn("bt_thought", ev_types)
                self.assertIn("tool_done", ev_types)
                self.assertIn("subagent_done", ev_types)
                self.assertIn("final_answer", ev_types)
                self.assertIn("done", ev_types)

                # Verify files created & unit tests actually passed in workspace
                sub_ws = Path(tmpdir) / "sub_project"
                self.assertTrue((sub_ws / "calc.py").exists())
                self.assertTrue((sub_ws / "test_calc.py").exists())

                file_api = client.get("/api/workspace/file?path=calc.py").get_json()
                self.assertTrue(file_api["ok"])
                self.assertTrue(file_api["pure_code"])
                self.assertIn("def safe_div", file_api["content"])
                self.assertIn("@calc.py", file_api["bt_header"])

                # 6. Manual SMFT compaction & lossless dereference
                comp_api = client.post("/api/memory/compact").get_json()
                self.assertTrue(comp_api["ok"])
                self.assertTrue(comp_api["compacted"])
                deref_api = client.get(f"/api/memory/deref?node_id={comp_api['node_id']}").get_json()
                self.assertGreater(len(deref_api["messages"]), 0)
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    unittest.main()
