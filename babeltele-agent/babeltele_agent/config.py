"""Persistent local configuration & model preset management for BabelTele Super Agent."""
from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import requests

CONFIG_PATH = Path(__file__).resolve().parent.parent / ".bt_agent_config.json"
DEFAULT_SANDBOX_ROOT = Path(__file__).resolve().parent.parent / "workspaces"

MODEL_PRESETS: list[dict[str, Any]] = [
    {
        "id": "deepseek",
        "name": "DeepSeek 官方 API (推荐 · 极速高性价比)",
        "base_url": "https://api.deepseek.com/v1",
        "default_model": "deepseek-chat",
        "models": ["deepseek-chat", "deepseek-reasoner"],
        "requires_key": True,
    },
    {
        "id": "qwen",
        "name": "阿里云通义千问 (DashScope 兼容接口)",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "default_model": "qwen-plus",
        "models": ["qwen-plus", "qwen-max", "qwen-turbo", "qwen3-coder-plus"],
        "requires_key": True,
    },
    {
        "id": "openai",
        "name": "OpenAI 官方 / 兼容中转网关",
        "base_url": "https://api.openai.com/v1",
        "default_model": "gpt-4o",
        "models": ["gpt-4o", "gpt-4o-mini", "o3-mini"],
        "requires_key": True,
    },
    {
        "id": "openrouter",
        "name": "OpenRouter 聚合网关 (Claude / Gemini / GPT)",
        "base_url": "https://openrouter.ai/api/v1",
        "default_model": "anthropic/claude-3.7-sonnet",
        "models": ["anthropic/claude-3.7-sonnet", "google/gemini-2.5-pro", "deepseek/deepseek-chat"],
        "requires_key": True,
    },
    {
        "id": "ollama",
        "name": "本机 Ollama 离线模型 (免 API Key)",
        "base_url": "http://127.0.0.1:11434/v1",
        "default_model": "qwen2.5:7b",
        "models": ["qwen2.5:7b", "qwen2.5-coder:7b", "qwen3:8b", "llama3.1:8b"],
        "requires_key": False,
    },
    {
        "id": "custom",
        "name": "自定义 OpenAI 兼容端点 (本地网关 / POPO / vLLM)",
        "base_url": "http://127.0.0.1:8000/v1",
        "default_model": "default",
        "models": [],
        "requires_key": False,
    },
]


@dataclass
class AgentSettings:
    provider_id: str = "deepseek"
    base_url: str = "https://api.deepseek.com/v1"
    api_key: str = ""
    model: str = "deepseek-chat"
    workspace_dir: str = ""
    bt_mode: bool = True  # True = BabelTele Kernel, False = Verbose Natural Language baseline
    auto_smft_threshold_tokens: int = 12000
    max_steps: int = 25
    command_timeout: int = 45
    temperature: float = 0.1
    extra_headers: dict[str, str] = field(default_factory=dict)

    def ensure_workspace(self) -> Path:
        if self.workspace_dir and Path(self.workspace_dir).exists():
            return Path(self.workspace_dir).resolve()
        default_proj = DEFAULT_SANDBOX_ROOT / "default-project"
        default_proj.mkdir(parents=True, exist_ok=True)
        self.workspace_dir = str(default_proj.resolve())
        return default_proj.resolve()

    def is_configured(self) -> bool:
        if self.provider_id in ("ollama", "custom"):
            return bool(self.base_url and self.model)
        return bool(self.base_url and self.model and self.api_key.strip())

    def masked_dict(self) -> dict[str, Any]:
        d = asdict(self)
        key = d.get("api_key", "")
        d["has_api_key"] = bool(key.strip())
        if len(key) > 8:
            d["api_key_masked"] = f"{key[:4]}...{key[-4:]}"
        elif key:
            d["api_key_masked"] = "****"
        else:
            d["api_key_masked"] = ""
        # Never expose full raw key unnecessarily in GET logs, though keep editable flag
        d.pop("api_key", None)
        d["is_ready"] = self.is_configured()
        return d


def load_settings() -> AgentSettings:
    settings = AgentSettings()
    # Pre-populate from environment variables if present
    if os.getenv("OPENAI_API_KEY") or os.getenv("DEEPSEEK_API_KEY"):
        settings.api_key = os.getenv("DEEPSEEK_API_KEY") or os.getenv("OPENAI_API_KEY", "")
    if os.getenv("OPENAI_BASE_URL"):
        settings.base_url = os.getenv("OPENAI_BASE_URL", settings.base_url)
    if os.getenv("OPENAI_MODEL"):
        settings.model = os.getenv("OPENAI_MODEL", settings.model)

    if CONFIG_PATH.exists():
        try:
            raw = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            for k, v in raw.items():
                if hasattr(settings, k) and v is not None:
                    setattr(settings, k, v)
        except Exception:
            pass

    settings.ensure_workspace()
    return settings


def save_settings(updates: dict[str, Any]) -> AgentSettings:
    current = load_settings()
    for k, v in updates.items():
        if k == "api_key":
            # Only overwrite api_key if explicitly provided (non-None)
            if isinstance(v, str) and v.strip() != "":
                current.api_key = v.strip()
            elif v == "__CLEAR__":
                current.api_key = ""
        elif hasattr(current, k) and v is not None:
            setattr(current, k, v)
    current.ensure_workspace()
    CONFIG_PATH.write_text(json.dumps(asdict(current), ensure_ascii=False, indent=2), encoding="utf-8")
    return current


def probe_ollama(base_url: str = "http://127.0.0.1:11434") -> dict[str, Any]:
    clean = base_url.rstrip("/")
    if clean.endswith("/v1"):
        clean = clean[:-3]
    try:
        resp = requests.get(f"{clean}/api/tags", timeout=1.5)
        resp.raise_for_status()
        data = resp.json()
        models = [m.get("name", "") for m in data.get("models", []) if m.get("name")]
        return {"online": True, "models": models, "base_url": f"{clean}/v1"}
    except Exception as exc:
        return {"online": False, "models": [], "error": str(exc)}
