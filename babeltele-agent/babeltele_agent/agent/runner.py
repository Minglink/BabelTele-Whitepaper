"""BabelTele Super Agent Runner (Refactored from SWE-agent/mini-swe-agent + HKUDS/nanobot).

Implements:
- Dual-Plane BT-Thought reasoning loop (65% shorter intermediate outputs)
- Subagent delegation over `content_encoding: babeltele/1.0` bus
- Automatic SMFT T1->T2 context compaction + BT-Header workspace indexing
- Real-time event emission for SSE graphical streaming & instant cancellation
"""
from __future__ import annotations

import platform
import threading
import time
from pathlib import Path
from typing import Any, Callable

from babeltele_agent.agent.llm_provider import LLMProviderError, UniversalOpenAIProvider
from babeltele_agent.config import AgentSettings
from babeltele_agent.memory.header_index import WorkspaceHeaderIndex
from babeltele_agent.memory.smft import SMFTMemoryTree
from babeltele_agent.protocol.neutralizer import decode_bt_thought_to_zh, neutralize_prompt
from babeltele_agent.protocol.prompts import build_agent_system_prompt
from babeltele_agent.protocol.tokenizer import count_tokens
from babeltele_agent.tools.registry import TOOL_SCHEMAS, execute_tool
from babeltele_agent.tools.workspace import WorkspaceEnvironment

EventCallback = Callable[[dict[str, Any]], None]


class BabelTeleSuperAgent:
    """Persistent stateful Super Agent bound to a workspace session."""

    def __init__(self, settings: AgentSettings) -> None:
        self.settings = settings
        self.workspace_path: Path = settings.ensure_workspace()
        self.header_index = WorkspaceHeaderIndex()
        self.header_index.scan_workspace(self.workspace_path)
        self.smft = SMFTMemoryTree()
        self.env = WorkspaceEnvironment(
            workspace_root=self.workspace_path,
            header_index=self.header_index,
            command_timeout=settings.command_timeout,
        )
        self.conversation: list[dict[str, Any]] = []
        self.total_prompt_tokens = 0
        self.total_completion_tokens = 0
        self.estimated_verbose_thought_tokens_saved = 0
        self._cancel_event = threading.Event()
        self._running = False

    def switch_workspace(self, new_dir: str) -> Path:
        p = Path(new_dir).expanduser().resolve()
        p.mkdir(parents=True, exist_ok=True)
        self.workspace_path = p
        self.settings.workspace_dir = str(p)
        self.header_index = WorkspaceHeaderIndex()
        self.header_index.scan_workspace(p)
        self.env = WorkspaceEnvironment(
            workspace_root=p,
            header_index=self.header_index,
            command_timeout=self.settings.command_timeout,
        )
        return p

    def reset_session(self) -> None:
        self.conversation.clear()
        self.smft = SMFTMemoryTree()
        self.env.file_changes.clear()
        self.env.terminal_logs.clear()
        self.total_prompt_tokens = 0
        self.total_completion_tokens = 0
        self.estimated_verbose_thought_tokens_saved = 0

    def cancel(self) -> None:
        self._cancel_event.set()

    def compact_now(self, keep_recent: int = 4) -> dict[str, Any]:
        """Manually or automatically fold older conversation turns into SMFT T1/T2 nodes."""
        if len(self.conversation) <= keep_recent:
            return {"compacted": False, "reason": "当前活跃消息较少，暂无需折叠", "smft": self.smft.summary_stats()}
        to_fold = self.conversation[:-keep_recent]
        # Avoid splitting right between an assistant tool_call and its tool observation
        while to_fold and to_fold[-1].get("role") == "assistant" and to_fold[-1].get("tool_calls"):
            keep_recent += 1
            to_fold = self.conversation[:-keep_recent]
        if not to_fold:
            return {"compacted": False, "reason": "保持当前活跃工具闭环", "smft": self.smft.summary_stats()}

        node = self.smft.fold_messages(to_fold)
        self.conversation = self.conversation[len(to_fold):]
        return {
            "compacted": node is not None,
            "node_id": node.node_id if node else None,
            "bt_digest": node.bt_digest if node else "",
            "smft": self.smft.summary_stats(),
        }

    def _run_subagent(
        self,
        role: str,
        task_bt: str,
        provider: UniversalOpenAIProvider,
        emit: EventCallback,
    ) -> dict[str, Any]:
        """Execute an isolated child Subagent over the babeltele/1.0 bus (max 6 steps)."""
        emit({
            "type": "subagent_start",
            "role": role,
            "task_bt": task_bt,
            "decoded_zh": decode_bt_thought_to_zh(task_bt),
        })
        os_info = f"{platform.system()} {platform.release()}"
        sub_sys = (
            f"You are Subagent [{role}] invoked over content_encoding='babeltele/1.0'.\n"
            f"Workspace: {self.workspace_path} ({os_info}).\n"
            "Execute the assigned task using tools (`list_dir`, `read_file`, `write_file`, `edit_file`, `search_files`, `run_command`).\n"
            "Keep intermediate thoughts in 1-line `#BT` format. Return your final report in compact BabelTele (`#SubReport ...`) preserving all exact paths/numbers/test outcomes."
        )
        sub_tools = [t for t in TOOL_SCHEMAS if t["function"]["name"] != "spawn_subagent"]
        sub_msgs: list[dict[str, Any]] = [
            {"role": "system", "content": sub_sys},
            {"role": "user", "content": task_bt},
        ]
        final_report = ""
        for _ in range(6):
            if self._cancel_event.is_set():
                break
            step_res = provider.chat_step(sub_msgs, tools=sub_tools)
            self.total_prompt_tokens += step_res["prompt_tokens"]
            self.total_completion_tokens += step_res["completion_tokens"]
            tcs = step_res["tool_calls"]
            if not tcs:
                final_report = step_res["content"] or "#SubReport ok"
                break
            sub_msgs.append({
                "role": "assistant",
                "content": step_res["content"],
                "tool_calls": [tc["raw"] for tc in tcs],
            })
            for tc in tcs:
                obs = execute_tool(tc["name"], tc["arguments"], self.env, subagent_handler=None)
                sub_msgs.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "name": tc["name"],
                    "content": str(obs.get("output") or obs.get("error") or ""),
                })
        if not final_report:
            final_report = "#SubReport completed_max_steps"
        emit({
            "type": "subagent_done",
            "role": role,
            "report_bt": final_report,
            "tokens": count_tokens(final_report),
        })
        return {"ok": True, "output": f"[babeltele/1.0 Subagent={role}] {final_report}"}

    def run_task(
        self,
        user_prompt: str,
        emit: EventCallback,
        auto_neutralize_input: bool = False,
    ) -> dict[str, Any]:
        """Run multi-step Super Agent loop streaming events to graphical Web Console."""
        if self._running:
            raise RuntimeError("当前已有任务正在执行中，请等待完成或点击「停止」。")

        self._running = True
        self._cancel_event.clear()
        t_start = time.perf_counter()
        provider = UniversalOpenAIProvider(self.settings)

        try:
            effective_input = user_prompt.strip()
            neutral_info = None
            if auto_neutralize_input and self.settings.bt_mode:
                neutral_info = neutralize_prompt(effective_input)
                effective_input = neutral_info["babeltele"]
                emit({"type": "input_neutralized", "data": neutral_info})

            self.conversation.append({"role": "user", "content": effective_input})

            os_info = f"{platform.system()} {platform.release()} ({platform.machine()})"
            step_num = 0
            final_answer = ""

            while step_num < self.settings.max_steps:
                if self._cancel_event.is_set():
                    emit({"type": "cancelled", "message": "已按用户指令中止当前任务。"})
                    return {"ok": False, "status": "cancelled"}

                # Auto-SMFT check when history grows large
                hist_tokens = sum(count_tokens(str(m.get("content", ""))) for m in self.conversation)
                if hist_tokens > self.settings.auto_smft_threshold_tokens and len(self.conversation) > 6:
                    comp_res = self.compact_now(keep_recent=4)
                    if comp_res.get("compacted"):
                        emit({"type": "smft_compacted", "data": comp_res})

                sys_prompt = build_agent_system_prompt(
                    workspace_dir=str(self.workspace_path),
                    os_info=os_info,
                    bt_mode=self.settings.bt_mode,
                    smft_digest=self.smft.render_active_digest(),
                    header_index_digest=self.header_index.render_digest(),
                )
                full_messages = [{"role": "system", "content": sys_prompt}, *self.conversation]

                step_num += 1
                emit({"type": "step_start", "step": step_num})

                step_res = provider.chat_step(full_messages, tools=TOOL_SCHEMAS)
                self.total_prompt_tokens += step_res["prompt_tokens"]
                self.total_completion_tokens += step_res["completion_tokens"]

                thought_text = step_res["content"]
                tool_calls = step_res["tool_calls"]

                if not tool_calls:
                    # Final response to human!
                    final_answer = thought_text or "任务已完成。"
                    self.conversation.append({"role": "assistant", "content": final_answer})
                    emit({
                        "type": "final_answer",
                        "step": step_num,
                        "content": final_answer,
                        "latency_ms": step_res["latency_ms"],
                        "telemetry": self.get_telemetry(),
                    })
                    break

                # Intermediate tool-calling step -> track BT-Thought efficiency!
                thought_toks = count_tokens(thought_text)
                if self.settings.bt_mode:
                    # Typical verbose SWE-agent thought averages ~55 tokens per step
                    saved_here = max(0, 55 - thought_toks)
                    self.estimated_verbose_thought_tokens_saved += saved_here

                emit({
                    "type": "bt_thought",
                    "step": step_num,
                    "bt_text": thought_text or f"#BT => {tool_calls[0]['name']}",
                    "decoded_zh": decode_bt_thought_to_zh(thought_text or f"#BT => {tool_calls[0]['name']}"),
                    "thought_tokens": thought_toks,
                    "latency_ms": step_res["latency_ms"],
                })

                self.conversation.append({
                    "role": "assistant",
                    "content": thought_text,
                    "tool_calls": [tc["raw"] for tc in tool_calls],
                })

                for tc in tool_calls:
                    if self._cancel_event.is_set():
                        break
                    t_name = tc["name"]
                    t_args = tc["arguments"]
                    emit({
                        "type": "tool_start",
                        "step": step_num,
                        "tool": t_name,
                        "args": t_args,
                    })
                    obs = execute_tool(
                        t_name,
                        t_args,
                        self.env,
                        subagent_handler=lambda r, tb: self._run_subagent(r, tb, provider, emit),
                    )
                    obs_text = str(obs.get("output") or obs.get("error") or "")
                    self.conversation.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "name": t_name,
                        "content": obs_text,
                    })
                    emit({
                        "type": "tool_done",
                        "step": step_num,
                        "tool": t_name,
                        "ok": bool(obs.get("ok", True)),
                        "preview": obs_text[:600],
                        "file_changes": [
                            {
                                "path": fc.path,
                                "action": fc.action,
                                "pure_code": fc.pure_code,
                                "purity_issues": fc.purity_issues,
                            }
                            for fc in self.env.file_changes[-3:]
                        ],
                        "telemetry": self.get_telemetry(),
                    })
            else:
                final_answer = f"已达到单次最大步数上限 ({self.settings.max_steps} 步)，您可以输入“继续”接着推进。"
                emit({"type": "final_answer", "step": step_num, "content": final_answer, "telemetry": self.get_telemetry()})

            total_ms = round((time.perf_counter() - t_start) * 1000, 1)
            return {
                "ok": True,
                "status": "completed",
                "final_answer": final_answer,
                "steps": step_num,
                "duration_ms": total_ms,
                "telemetry": self.get_telemetry(),
            }
        except LLMProviderError as exc:
            emit({"type": "error", "error_kind": "provider", "message": str(exc)})
            return {"ok": False, "status": "error", "error": str(exc)}
        except Exception as exc:
            emit({"type": "error", "error_kind": "runtime", "message": f"执行异常：{exc}"})
            return {"ok": False, "status": "error", "error": str(exc)}
        finally:
            self._running = False

    def get_telemetry(self) -> dict[str, Any]:
        hdr_stats = self.header_index.stats()
        smft_stats = self.smft.summary_stats()
        total_saved = (
            self.estimated_verbose_thought_tokens_saved
            + int(hdr_stats["saved_tokens"])
            + int(smft_stats["saved_tokens"])
        )
        all_pure = all(fc.pure_code for fc in self.env.file_changes)
        return {
            "bt_mode": self.settings.bt_mode,
            "workspace_dir": str(self.workspace_path),
            "prompt_tokens": self.total_prompt_tokens,
            "completion_tokens": self.total_completion_tokens,
            "thought_tokens_saved": self.estimated_verbose_thought_tokens_saved,
            "header_memory": hdr_stats,
            "smft_memory": smft_stats,
            "total_estimated_tokens_saved": total_saved,
            "files_touched": len(self.env.file_changes),
            "commands_executed": len(self.env.terminal_logs),
            "all_artifacts_pure": all_pure,
        }
