"""3-Stage Hybrid BabelTele Neutralizer, Tier-1 Anchor Auditor & Sidecar Decoder."""
from __future__ import annotations

import re
import time
from typing import Any, Callable

from babeltele_agent.protocol.tokenizer import compare_token_budget

# Polite & emotional conversational padding in CN/EN stripped in <1ms
_NOISE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^(?:(?:你好|您好|嗨|哈喽|请问一下|请问|麻烦你|麻烦帮我|能不能麻烦你|能不能帮我|拜托了?|求求了?)[啊呀呢吧嘛啦，,、！!。\s]*)+"), ""),
    (re.compile(r"(我真是服了|我都快崩溃了|真是烦死了|这破系统|这破代码|太让人头大了|老板又在催命一样逼着改|万分感谢|非常感谢|谢谢啦?|辛苦了)[，,、！!。\s]*"), ""),
    (re.compile(r"(?i)^(hi|hello|hey there|could you please kindly|would you mind helping me to|please help me)\s*[,!]?\s*"), ""),
    (re.compile(r"(麻烦你帮我想个|麻烦帮我|请你帮我写一个|我想让你帮我做一个|能不能帮我实现一个|能不能帮我)"), "实现:"),
    (re.compile(r"如果出现|一旦发生|当满足|只要满足|每当"), "?"),
    (re.compile(r"那么就必须|那么就要|就立即|则必须|则立即|就会导致|从而导致"), " => "),
    (re.compile(r"并且要求|而且要求|同时要求|并且必须|而且必须|同时必须|并且"), " & "),
    (re.compile(r"绝对禁止|严格禁止|严禁|千万不要|绝对不能"), " !禁止:"),
    (re.compile(r"除非|但排除|除了"), " !exc:"),
    (re.compile(r"大于等于|不少于|至少"), ">="),
    (re.compile(r"小于等于|不超过|最多|以内"), "<="),
]

_NUMBER_RE = re.compile(r"(?<![A-Za-z0-9_.])\d+(?:\.\d+)?(?:%|ms|s|MB|GB|KB|K|M|tok)?(?![A-Za-z0-9_.])")
_PATH_URL_RE = re.compile(r"(?:https?://[^\s,，。)\]]+|\b\d{1,3}(?:\.\d{1,3}){2,3}\b|(?:/[A-Za-z0-9_.-]+){1,}|[A-Za-z0-9_-]+\.(?:py|java|ts|tsx|js|go|rs|sql|json|yaml|yml|md|html|css))")
_IDENT_RE = re.compile(r"\b(?:[a-z]+[A-Z][A-Za-z0-9_]*|[A-Z][a-z0-9]+(?:[A-Z][A-Za-z0-9]*)+|[a-z]+_[a-z0-9_]+|BIBREF\w*|TABREF\w*|P99|P95|JWT|MySQL|Redis|PostgreSQL|SQLite|HTTP|REST|SSE)\b")
_NEGATION_RE = re.compile(r"(?<!能)(?:严禁|禁止|不得|不许|绝不|除非|排除|\bnot\b|\bnever\b|\bexcept\b|\bunless\b|\bwithout\b)", re.I)


def extract_hard_anchors(text: str) -> dict[str, list[str]]:
    """Mechanically extract numbers, paths/URLs, code identifiers, and negations."""
    # Mask polite rhetorical '能不能' before scanning
    cleaned = text.replace("能不能", "").replace("好不好", "").replace("行不行", "")
    paths = list(dict.fromkeys(_PATH_URL_RE.findall(cleaned)))
    # Mask paths before extracting standalone numbers so /v2/ doesn't double-count falsely
    masked = cleaned
    for p in paths:
        masked = masked.replace(p, " ")
    nums = list(dict.fromkeys(_NUMBER_RE.findall(masked)))
    idents = list(dict.fromkeys(_IDENT_RE.findall(cleaned)))
    negs = list(dict.fromkeys(m.group(0) for m in _NEGATION_RE.finditer(cleaned)))
    return {
        "numbers": nums,
        "paths": paths,
        "identifiers": idents,
        "negations": negs,
    }


def audit_anchors(source: str, bt_text: str) -> dict[str, Any]:
    """Tier-1 (<2ms) deterministic verification that all exact anchors survive compression."""
    anchors = extract_hard_anchors(source)
    matched: list[str] = []
    missing: list[str] = []

    for token in anchors["paths"] + anchors["identifiers"]:
        if token.lower() in bt_text.lower():
            matched.append(token)
        else:
            missing.append(token)

    for num in anchors["numbers"]:
        raw_digits = re.match(r"^\d+(?:\.\d+)?", num)
        core = raw_digits.group(0) if raw_digits else num
        # Match exact numeric boundary so '80' doesn't match '800'
        pat = re.compile(rf"(?<![0-9.]){re.escape(core)}(?![0-9])")
        if pat.search(bt_text):
            matched.append(num)
        else:
            missing.append(num)

    neg_ok = True
    if anchors["negations"]:
        has_bt_neg = bool(re.search(r"(!|¬|!=|\bnot\b|\bnever\b|禁止|严禁|不|除)", bt_text, re.I))
        if has_bt_neg:
            matched.append(f"否定边界({anchors['negations'][0]})")
        else:
            neg_ok = False
            missing.append(f"否定边界({anchors['negations'][0]})")

    return {
        "passed": len(missing) == 0 and neg_ok,
        "total_anchors": len(matched) + len(missing),
        "matched": matched,
        "missing": missing,
        "negation_preserved": neg_ok,
    }


def compile_offline_neutral(text: str) -> tuple[str, int]:
    """0ms deterministic neutralizer stripping emotional/polite noise into BT-L2 ASCII structure."""
    s = text.strip()
    removed_noise = 0
    for pat, repl in _NOISE_PATTERNS:
        s_new, count = pat.subn(repl, s)
        if count > 0:
            removed_noise += count
            s = s_new

    # Collapse verbose punctuation and whitespace while preserving BT `!禁止:` / `!exc:` operators
    s = re.sub(r"(?:[，,；;。！]|!(?!禁止|exc|\[))+", "; ", s)
    s = re.sub(r"\s+", " ", s).strip(" ;")
    if not s.startswith("#"):
        s = f"#Task {s}"
    return s, removed_noise


NEUTRALIZER_SYS_PROMPT = """Role: BT-Spec v1.0 Formal Neutralizer.
Convert the user's verbose/emotional request into an ultra-compact, emotionally neutral BabelTele (BT-L2) engineering specification for an autonomous coding agent.
Rules:
1. Strip ALL greetings, venting, emotional phrasing, and filler.
2. Use 1-token ASCII operators (#Topic, @Entity(K=V), ->, ?cond=>act, & , |, !forbid/exc). Do NOT use multi-byte decorative emojis.
3. Preserve 100% of exact numbers, file paths, identifiers, API routes, and negations verbatim.
4. Output ONLY the single compact BabelTele specification, nothing else."""


def neutralize_prompt(
    text: str,
    llm_call: Callable[[list[dict[str, str]]], str] | None = None,
) -> dict[str, Any]:
    """Hybrid 3-stage neutralizer: Offline rule pre-pass -> optional LLM -> Tier-1 Anchor Lock & BPE Circuit Breaker."""
    t0 = time.perf_counter()
    rule_bt, noise_stripped = compile_offline_neutral(text)
    engine_used = "offline-rule"
    candidate = rule_bt

    if llm_call is not None and len(text.strip()) > 30:
        try:
            resp = llm_call([
                {"role": "system", "content": NEUTRALIZER_SYS_PROMPT},
                {"role": "user", "content": text},
            ]).strip()
            if resp:
                candidate = resp
                engine_used = "llm-hybrid"
        except Exception:
            candidate = rule_bt
            engine_used = "offline-rule(fallback)"

    audit = audit_anchors(text, candidate)
    if not audit["passed"] and audit["missing"]:
        # Deterministic Anchor Lock repair
        candidate = f"{candidate} ![AnchorLock: {', '.join(audit['missing'])}]"
        audit = audit_anchors(text, candidate)

    budget = compare_token_budget(text, candidate)
    circuit_breaker = False
    final_bt = candidate
    if not budget["net_bpe_gain"] and len(text.strip()) < 60:
        # Short prompt did not gain BPE reduction -> keep concise rule form or original
        if compare_token_budget(text, rule_bt)["net_bpe_gain"]:
            final_bt = rule_bt
            budget = compare_token_budget(text, final_bt)
            audit = audit_anchors(text, final_bt)
        else:
            final_bt = text.strip()
            budget = compare_token_budget(text, final_bt)
            circuit_breaker = True

    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
    return {
        "original": text,
        "babeltele": final_bt,
        "engine": engine_used,
        "noise_stripped_count": noise_stripped,
        "circuit_breaker_triggered": circuit_breaker,
        "audit": audit,
        "budget": budget,
        "elapsed_ms": elapsed_ms,
    }


def decode_bt_thought_to_zh(bt_thought: str) -> str:
    """Instant <1ms local Sidecar Lens translating Agent's BT-Thought shorthand into readable Chinese."""
    if not bt_thought or not bt_thought.strip():
        return "（直接执行工具调用）"
    s = bt_thought.strip()
    replacements = [
        ("#BT", "【硅基思考】"),
        ("#Plan", "【规划】"),
        ("#Diag", "【故障诊断】"),
        ("#Fix", "【修复方案】"),
        ("#Verify", "【测试验收】"),
        ("#Done", "【目标达成】"),
        ("?missing", "若缺失则"),
        ("?err", "若报错则"),
        ("?ok", "校验通过则"),
        ("=>", " ➔ 推导执行："),
        ("->", " → 随后 "),
        ("&", " 且 "),
        ("!exc:", "（排除例外："),
        ("!", " 注意/非："),
    ]
    for k, v in replacements:
        s = s.replace(k, v)
    return s
