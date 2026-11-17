"""Universal OpenAI-Compatible LLM Provider (Refactored from SWE-agent/mini-swe-agent OpenRouterModel).

Supports DeepSeek, Qwen, OpenAI, OpenRouter, custom local proxies, and local Ollama,
with dual native `tool_calls` + fallback JSON block parsing and clear Chinese diagnostics.
"""
from __future__ import annotations

import json
import re
import time
import uuid
from typing import Any

import requests

from babeltele_agent.config import AgentSettings
from babeltele_agent.protocol.tokenizer import count_tokens


class LLMProviderError(RuntimeError):
    """Raised with human-friendly diagnostics when LLM API call fails."""


_THINK_TAG_RE = re.compile(r"<think>([\s\S]*?)</think>", re.I)
_FALLBACK_TOOL_JSON_RE = re.compile(r"```(?:json|tool_call)\s*\r?\n(\{[\s\S]*?\})\r?\n```")


class UniversalOpenAIProvider:
    def __init__(self, settings: AgentSettings) -> None:
        self.settings = settings

    @property
    def endpoint(self) -> str:
        base = self.settings.base_url.rstrip("/")
        if base.endswith("/chat/completions"):
            return base
        if not base.endswith("/v1") and "ollama" in base:
            base = f"{base}/v1"
        return f"{base}/chat/completions"

    def _headers(self) -> dict[str, str]:
        h = {"Content-Type": "application/json"}
        if self.settings.api_key.strip():
            h["Authorization"] = f"Bearer {self.settings.api_key.strip()}"
        h.update(self.settings.extra_headers or {})
        return h

    def complete_text(self, messages: list[dict[str, Any]], max_tokens: int = 512) -> str:
        """Lightweight single-turn completion without tools (for Neutralizer / test connection)."""
        payload: dict[str, Any] = {
            "model": self.settings.model,
            "messages": messages,
            "temperature": 0.1,
            "max_tokens": max_tokens,
        }
        data = self._post(payload, timeout=30)
        msg = (data.get("choices") or [{}])[0].get("message") or {}
        content = str(msg.get("content") or "")
        return _THINK_TAG_RE.sub("", content).strip()

    def chat_step(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Execute one agent step with tool definitions and usage accounting."""
        t0 = time.perf_counter()
        clean_msgs = []
        for m in messages:
            item = {k: v for k, v in m.items() if k in ("role", "content", "tool_calls", "tool_call_id", "name")}
            if item.get("content") is None and "tool_calls" in item:
                item["content"] = ""
            clean_msgs.append(item)

        payload: dict[str, Any] = {
            "model": self.settings.model,
            "messages": clean_msgs,
            "temperature": self.settings.temperature,
        }
        if tools:
            payload["tools"] = tools

        data = self._post(payload, timeout=90)
        latency_ms = round((time.perf_counter() - t0) * 1000, 1)

        choice = (data.get("choices") or [{}])[0]
        msg = choice.get("message") or {}
        raw_content = str(msg.get("content") or "")
        reasoning_content = str(msg.get("reasoning_content") or "")

        think_match = _THINK_TAG_RE.search(raw_content)
        if think_match and not reasoning_content:
            reasoning_content = think_match.group(1).strip()
        clean_content = _THINK_TAG_RE.sub("", raw_content).strip()

        tool_calls = msg.get("tool_calls") or []
        parsed_calls: list[dict[str, Any]] = []
        for tc in tool_calls:
            fn = tc.get("function") or {}
            raw_args = fn.get("arguments") or "{}"
            try:
                args_dict = json.loads(raw_args) if isinstance(raw_args, str) else dict(raw_args)
            except Exception:
                args_dict = {}
            parsed_calls.append({
                "id": tc.get("id") or f"call_{uuid.uuid4().hex[:8]}",
                "name": fn.get("name", ""),
                "arguments": args_dict,
                "raw": {
                    "id": tc.get("id") or f"call_{uuid.uuid4().hex[:8]}",
                    "type": "function",
                    "function": {
                        "name": fn.get("name", ""),
                        "arguments": json.dumps(args_dict, ensure_ascii=False),
                    },
                },
            })

        # Fallback parser if an open-weight model emitted ```tool_call {"name":..., "arguments":...} ```
        if not parsed_calls and clean_content:
            m_fb = _FALLBACK_TOOL_JSON_RE.search(clean_content)
            if m_fb:
                try:
                    fb_obj = json.loads(m_fb.group(1))
                    if "name" in fb_obj:
                        cid = f"call_{uuid.uuid4().hex[:8]}"
                        args_d = fb_obj.get("arguments") or {}
                        parsed_calls.append({
                            "id": cid,
                            "name": fb_obj["name"],
                            "arguments": args_d,
                            "raw": {
                                "id": cid,
                                "type": "function",
                                "function": {
                                    "name": fb_obj["name"],
                                    "arguments": json.dumps(args_d, ensure_ascii=False),
                                },
                            },
                        })
                        clean_content = _FALLBACK_TOOL_JSON_RE.sub("", clean_content).strip()
                except Exception:
                    pass

        usage = data.get("usage") or {}
        prompt_tok = int(usage.get("prompt_tokens") or sum(count_tokens(str(x.get("content", ""))) for x in clean_msgs))
        comp_tok = int(usage.get("completion_tokens") or count_tokens(clean_content + reasoning_content))

        return {
            "content": clean_content,
            "reasoning_content": reasoning_content,
            "tool_calls": parsed_calls,
            "prompt_tokens": prompt_tok,
            "completion_tokens": comp_tok,
            "latency_ms": latency_ms,
        }

    def test_connection(self) -> dict[str, Any]:
        t0 = time.perf_counter()
        reply = self.complete_text(
            [{"role": "user", "content": "Reply with exact string: BT_READY"}],
            max_tokens=16,
        )
        ms = round((time.perf_counter() - t0) * 1000, 1)
        return {
            "ok": True,
            "model": self.settings.model,
            "endpoint": self.endpoint,
            "reply": reply[:80],
            "latency_ms": ms,
        }

    def _post(self, payload: dict[str, Any], timeout: int = 60) -> dict[str, Any]:
        if not self.settings.is_configured():
            raise LLMProviderError("尚未配置有效的模型 API Key（请点击右上角「⚙️ 模型与密钥设置」填入并保存）。")
        try:
            resp = requests.post(
                self.endpoint,
                headers=self._headers(),
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                timeout=timeout,
            )
        except requests.exceptions.RequestException as exc:
            raise LLMProviderError(f"无法连接到模型端点 ({self.endpoint})：{exc}") from exc

        if resp.status_code == 401:
            raise LLMProviderError(f"API Key 鉴权失败 (HTTP 401)：请检查右上角配置的密钥是否正确。")
        if resp.status_code == 402:
            raise LLMProviderError("模型账户余额不足 (HTTP 402)：请检查对应平台的 API 额度。")
        if resp.status_code == 404:
            raise LLMProviderError(f"端点或模型名称不存在 (HTTP 404)：请检查 Base URL ({self.settings.base_url}) 与模型名 ({self.settings.model})。")
        if resp.status_code == 429:
            raise LLMProviderError("请求触发速率限制 (HTTP 429)：请稍后重试。")
        if resp.status_code >= 400:
            snippet = resp.text[:260]
            raise LLMProviderError(f"上游模型返回错误 (HTTP {resp.status_code})：{snippet}")

        try:
            return resp.json()
        except Exception as exc:
            raise LLMProviderError(f"上游返回的不是合法 JSON：{resp.text[:200]}") from exc
